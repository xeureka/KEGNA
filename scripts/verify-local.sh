#!/usr/bin/env bash
set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_PID=""
API_LOG="/tmp/zola-verify-api.log"
STARTED_AT="$(date +%s)"
declare -a RESULTS=()

cleanup() {
	if [[ -n "$API_PID" ]] && kill -0 "$API_PID" 2>/dev/null; then
		kill "$API_PID" 2>/dev/null || true
		wait "$API_PID" 2>/dev/null || true
	fi
}
trap cleanup EXIT INT TERM

step() {
	local name="$1" limit="$2"; shift 2
	local started="$(date +%s)"
	if timeout "$limit" bash -lc "cd '$ROOT_DIR' && $*"; then
		RESULTS+=("PASS|$name|$(( $(date +%s) - started ))s")
		printf 'PASS %-28s %ss\n' "$name" "$(( $(date +%s) - started ))"
	else
		RESULTS+=("FAIL|$name|$(( $(date +%s) - started ))s")
		printf 'FAIL %-28s %ss\n' "$name" "$(( $(date +%s) - started ))"
		return 1
	fi
}

if [[ "${NODE_ENV:-}" == "production" ]]; then echo "verify refuses NODE_ENV=production"; exit 2; fi
DB_HOST="$(ROOT_DIR="$ROOT_DIR" node -e 'const fs=require("node:fs"); try { let value=process.env.DATABASE_URL; if(!value){const text=fs.readFileSync(`${process.env.ROOT_DIR}/apps/back-end/.env`,"utf8"); const line=text.split(/\n/).find((x)=>x.startsWith("DATABASE_URL=")); value=line?.slice("DATABASE_URL=".length).trim().replace(/^['"]|['"]$/g,"");} console.log(new URL(value).hostname); } catch { console.log(""); }')"
if [[ -z "$DB_HOST" ]]; then echo "verify could not determine the database host"; exit 2; fi
case "$DB_HOST" in localhost|127.0.0.1|::1|*.local|*.neon.tech|*.supabase.co) ;; *) echo "verify refuses non-development database host: $DB_HOST"; exit 2 ;; esac
echo "Database host: $DB_HOST"

step "typecheck" 300 "pnpm -r typecheck" || exit 1
step "lint" 300 "pnpm -r lint" || exit 1
step "web build" 300 "pnpm --filter front-end build" || exit 1
step "backend build" 180 "pnpm --filter zola-back-end build" || exit 1
step "database reset" 180 "ALLOW_DB_RESET=yes pnpm --filter zola-back-end db:reset" || exit 1

(cd "$ROOT_DIR/apps/back-end" && PORT=3011 node dist/index.js) >"$API_LOG" 2>&1 &
API_PID=$!
step "API health" 40 "for i in \$(seq 1 30); do curl -fsS http://127.0.0.1:3011/api/v1/hello >/dev/null && exit 0; sleep 1; done; tail -50 '$API_LOG'; exit 1" || exit 1
step "API smoke" 300 "SMOKE_API_URL=http://127.0.0.1:3011 pnpm --filter zola-back-end smoke" || exit 1
cleanup; API_PID=""
step "database cleanup" 180 "ALLOW_DB_RESET=yes pnpm --filter zola-back-end db:reset" || exit 1
(cd "$ROOT_DIR/apps/back-end" && PORT=3011 node dist/index.js) >"$API_LOG" 2>&1 &
API_PID=$!
step "post-reset API health" 40 "for i in \$(seq 1 30); do curl -fsS http://127.0.0.1:3011/api/v1/hello >/dev/null && exit 0; sleep 1; done; tail -50 '$API_LOG'; exit 1" || exit 1
step "seeded login" 60 "ROOT_DIR='$ROOT_DIR' node --input-type=module -e 'import fs from \"node:fs\"; const text=fs.readFileSync(process.env.ROOT_DIR+\"/apps/back-end/.env\",\"utf8\"); const line=text.split(/\\n/).find((x)=>x.startsWith(\"SEED_PASSWORD=\")); const p=line?.slice(\"SEED_PASSWORD=\".length).trim().replace(/^[\'\"]|[\'\"]$/g,\"\"); if(!p) process.exit(1); const r=await fetch(\"http://127.0.0.1:3011/api/v1/auth/login\",{method:\"POST\",headers:{\"content-type\":\"application/json\"},body:JSON.stringify({email:\"admin@zola.local\",password:p})}); if(!r.ok) process.exit(1)'" || exit 1
cleanup; API_PID=""
step "Expo config" 120 "pnpm --filter mobile exec expo config --type public >/dev/null" || exit 1
step "Expo Android export" 300 "EXPO_OFFLINE=1 CI=1 EXPO_NO_TELEMETRY=1 pnpm --filter mobile exec expo export --platform android --output-dir /tmp/zola-export-check" || exit 1

echo
echo "Verification summary"
printf '%s\n' "${RESULTS[@]}"
echo "Elapsed: $(( $(date +%s) - STARTED_AT ))s"
