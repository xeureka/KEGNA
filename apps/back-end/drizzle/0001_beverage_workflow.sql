ALTER TABLE "sales_reports" DROP CONSTRAINT IF EXISTS "sales_reports_issue_id_unique";--> statement-breakpoint
ALTER TABLE "sales_reports" ADD COLUMN IF NOT EXISTS "idempotency_key" text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sales_reports_idempotency_key_unique" ON "sales_reports" USING btree ("idempotency_key") WHERE "idempotency_key" IS NOT NULL;--> statement-breakpoint
WITH duplicate_references AS (
	SELECT id, reference_no, row_number() OVER (PARTITION BY reference_no ORDER BY deposited_at, id) AS duplicate_number
	FROM deposits
)
UPDATE deposits AS d
SET reference_no = d.reference_no || '-' || left(replace(d.id::text, '-', ''), 8)
FROM duplicate_references AS r
WHERE r.id = d.id AND r.duplicate_number > 1;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "deposits_reference_no_unique" ON "deposits" USING btree ("reference_no");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sales_reports_sales_status_idx" ON "sales_reports" USING btree ("sales_user_id", "status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sales_reports_status_submitted_idx" ON "sales_reports" USING btree ("status", "submitted_at");
