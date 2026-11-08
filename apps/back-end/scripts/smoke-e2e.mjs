import process from "node:process";

if (process.env.NODE_ENV === "production") throw new Error("smoke-e2e refuses to run in production");
const base = (process.env.SMOKE_API_URL ?? "http://127.0.0.1:3001").replace(/\/$/, "") + "/api/v1";
const password = process.env.SMOKE_PASSWORD ?? process.env.SEED_PASSWORD;
if (!password) throw new Error("Set SEED_PASSWORD or SMOKE_PASSWORD before running smoke-e2e");

const results = [];
const pass = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`); };
const request = async (path, token, options = {}) => {
	const headers = new Headers(options.headers);
	if (token) headers.set("authorization", `Bearer ${token}`);
	if (options.body && !(options.body instanceof FormData) && !headers.has("content-type")) headers.set("content-type", "application/json");
	const response = await fetch(`${base}${path}`, { ...options, headers });
	let body = null; try { body = await response.json(); } catch { /* raw file response */ }
	return { response, body };
};
const json = (path, token, method = "GET", body, headers) => request(path, token, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
const expect = async (name, path, token, method, body, expected, headers) => { const result = await json(path, token, method, body, headers); pass(name, result.response.status === expected, `${result.response.status} expected ${expected}`); return result; };
const login = async (email, mobile = false) => { const result = await json("/auth/login", null, "POST", { email, password }, mobile ? { origin: "zola://" } : undefined); if (!result.response.ok) throw new Error(`Could not sign in ${email}`); return result.body.data; };
const unique = (role) => `smoke-${role}-${Date.now()}@zola.local`;
const seededAdmin = await login("admin@zola.local");
const [storekeeper, sales, otherSales, accountant] = await Promise.all([
	login("storekeeper@zola.local"),
	login("sales.one@zola.local", true),
	login("sales.two@zola.local", true),
	login("accountant@zola.local", true),
]);
pass("seeded users sign in", Boolean(seededAdmin.sessionToken && storekeeper.sessionToken && sales.sessionToken && accountant.sessionToken));

await Promise.all(["admin", "storekeeper", "sales", "accountant"].map(async (role) => {
	const email = unique(role);
	const created = await json("/users", seededAdmin.sessionToken, "POST", { name: `Smoke ${role}`, email, password, role });
	pass(`admin creates ${role}`, created.response.status === 200);
	const signedIn = await login(email, role === "sales" || role === "accountant");
	pass(`${role} can sign in`, Boolean(signedIn.sessionToken));
	return signedIn;
}));

const product = await json("/products", seededAdmin.sessionToken, "POST", { name: "Smoke Lager Rack", sku: `SMOKE-${Date.now()}`, bottles_per_rack: 24, price_per_rack: "100.00" });
const productId = product.body?.data?.id;
pass("admin creates product", product.response.status === 200 && Boolean(productId));
const before = await json("/stock/balances", storekeeper.sessionToken);
const beforeBalance = Number(before.body.data.find((row) => row.product.id === productId)?.warehouseBalance ?? 0);
await expect("storekeeper receives stock", "/stock/receive", storekeeper.sessionToken, "POST", { product_id: productId, racks: 20, reference: "smoke" }, 200);
const after = await json("/stock/balances", storekeeper.sessionToken);
pass("warehouse balance rises", Number(after.body.data.find((row) => row.product.id === productId)?.warehouseBalance) === beforeBalance + 20);

const issue1 = await json("/issues", storekeeper.sessionToken, "POST", { sales_user_id: "00000000-0000-0000-0000-000000000000", items: [{ product_id: productId, quantity: 5 }] });
const seededSalesRows = await json("/users/sales", storekeeper.sessionToken);
const salesId = seededSalesRows.body.data.find((row) => row.email === "sales.one@zola.local").id;
const validIssue1 = await json("/issues", storekeeper.sessionToken, "POST", { sales_user_id: salesId, items: [{ product_id: productId, quantity: 5 }] });
const issue1Id = validIssue1.body.data.id;
pass("storekeeper issues racks", validIssue1.response.status === 200 && issue1.response.status === 400);
await expect("over-issue rejected", "/issues", storekeeper.sessionToken, "POST", { sales_user_id: salesId, items: [{ product_id: productId, quantity: 1000 }] }, 409);
const balanceAfterIssue = await json("/stock/balances", storekeeper.sessionToken);
const balanceRow = balanceAfterIssue.body.data.find((row) => row.product.id === productId);
pass("warehouse drops and sales holding rises", Number(balanceRow.warehouseBalance) === beforeBalance + 15 && Number(balanceRow.heldBySalespeople) === 5);

const slipForm = new FormData(); slipForm.set("file", new File([Buffer.from("smoke-image")], "slip.png", { type: "image/png" }));
const upload = await request("/files", sales.sessionToken, { method: "POST", body: slipForm });
const slipKey = upload.body?.data?.key;
pass("sales uploads bank slip", upload.response.status === 200 && Boolean(slipKey));
const mismatch = await json(`/issues/${issue1Id}/report`, sales.sessionToken, "POST", { items: [{ product_id: productId, sold: 4, returned: 0, damaged: 0 }], deposits: [{ amount: "100.00", bank_name: "Smoke Bank", reference_no: "bad", slip_file_key: slipKey }] });
pass("mismatched report rejected", mismatch.response.status === 400);
await expect("other sales cannot read issue", `/issues/${issue1Id}`, otherSales.sessionToken, "GET", undefined, 403);
await expect("other sales cannot submit report", `/issues/${issue1Id}/report`, otherSales.sessionToken, "POST", { items: [{ product_id: productId, sold: 5, returned: 0, damaged: 0 }], deposits: [{ amount: "100.00", bank_name: "Smoke Bank", reference_no: "other", slip_file_key: slipKey }] }, 403);
await expect("other sales cannot read slip", `/files/${slipKey}`, otherSales.sessionToken, "GET", undefined, 403);
const report1 = await json(`/issues/${issue1Id}/report`, sales.sessionToken, "POST", { items: [{ product_id: productId, sold: 3, returned: 1, damaged: 1 }], deposits: [{ amount: "300.00", bank_name: "Smoke Bank", reference_no: "smoke-1", slip_file_key: slipKey }] });
pass("sales submits report", report1.response.status === 200);
await expect("storekeeper confirms returns", `/issues/${issue1Id}/confirm-returns`, storekeeper.sessionToken, "POST", { items: [{ product_id: productId, returned: 1, damaged: 1 }] }, 200);
const reconciliation = await json(`/issues/${issue1Id}`, accountant.sessionToken);
pass("accountant reads reconciliation", reconciliation.response.status === 200 && reconciliation.body.data.reconciliation.cash_variance === "0.00");
await expect("matching report approves", `/reports/${report1.body.data.id}/verify`, accountant.sessionToken, "POST", { decision: "approved" }, 200);
const cleared = await json("/stock/balances", accountant.sessionToken);
pass("approved issue clears holding", Number(cleared.body.data.find((row) => row.product.id === productId).heldBySalespeople) === 0);

const issue2 = await json("/issues", storekeeper.sessionToken, "POST", { sales_user_id: salesId, items: [{ product_id: productId, quantity: 2 }] });
const slipForm2 = new FormData(); slipForm2.set("file", new File([Buffer.from("smoke-image-2")], "slip2.png", { type: "image/png" }));
const upload2 = await request("/files", sales.sessionToken, { method: "POST", body: slipForm2 });
const report2 = await json(`/issues/${issue2.body.data.id}/report`, sales.sessionToken, "POST", { items: [{ product_id: productId, sold: 2, returned: 0, damaged: 0 }], deposits: [{ amount: "100.00", bank_name: "Smoke Bank", reference_no: "smoke-2", slip_file_key: upload2.body.data.key }] });
await expect("cash-short returns confirmed", `/issues/${issue2.body.data.id}/confirm-returns`, storekeeper.sessionToken, "POST", { items: [{ product_id: productId, returned: 0, damaged: 0 }] }, 200);
await expect("cash-short approve rejected", `/reports/${report2.body.data.id}/verify`, accountant.sessionToken, "POST", { decision: "approved" }, 409);
await expect("cash-short report flagged", `/reports/${report2.body.data.id}/verify`, accountant.sessionToken, "POST", { decision: "flagged", note: "Smoke cash variance" }, 200);

const salesThreads = await json("/threads", sales.sessionToken);
const salesThread = salesThreads.body.data.find((row) => row.issue.id === issue1Id);
pass("thread unread count is present", salesThreads.response.status === 200 && Number(salesThread?.unreadCount) >= 1);
await expect("thread read resets unread", `/threads/${issue1Id}/read`, sales.sessionToken, "POST", undefined, 200);
const readThreads = await json("/threads", sales.sessionToken);
pass("thread unread count resets", Number(readThreads.body.data.find((row) => row.issue.id === issue1Id)?.unreadCount) === 0);
await expect("comment posts", `/threads/${issue1Id}/comments`, sales.sessionToken, "POST", { text: "Smoke comment" }, 200);
const events = await json(`/threads/${issue1Id}/events`, sales.sessionToken);
pass("thread events are oldest-first with actor names", events.response.status === 200 && events.body.data.at(-1)?.type === "comment" && events.body.data.some((event) => event.actorName));

for (const [name, path, token, method, body] of [["sales cannot create product", "/products", sales.sessionToken, "POST", { name: "Forbidden", sku: `FORBIDDEN-${Date.now()}`, bottles_per_rack: 1, price_per_rack: "1.00" }], ["sales cannot receive stock", "/stock/receive", sales.sessionToken, "POST", { product_id: productId, racks: 1 }], ["storekeeper cannot verify", `/reports/${report2.body.data.id}/verify`, storekeeper.sessionToken, "POST", { decision: "flagged", note: "no" }], ["sales cannot list all users", "/users", sales.sessionToken, "GET", undefined]]) await expect(name, path, token, method, body, 403);
await expect("no session is rejected", "/products", null, "GET", undefined, 401);
const ledger = await json(`/stock/movements?product_id=${productId}&limit=200`, accountant.sessionToken);
const finalBalances = await json("/stock/balances", accountant.sessionToken);
const finalRow = finalBalances.body.data.find((row) => row.product.id === productId);
pass("ledger has movements", ledger.response.status === 200 && ledger.body.data.length >= 7);
pass("ledger balances are non-negative", Number(finalRow.warehouseBalance) >= 0 && Number(finalRow.heldBySalespeople) >= 0);

const passed = results.filter(Boolean).length; const failed = results.length - passed;
console.log(`RESULT passed=${passed} failed=${failed}`);
if (failed) process.exitCode = 1;
