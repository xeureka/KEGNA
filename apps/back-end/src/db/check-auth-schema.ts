import { sql } from "drizzle-orm";
import { db } from "./index";

const result = await db.execute(sql`
	SELECT
		current_database() AS database,
		current_user AS database_user,
		current_schema() AS schema,
		exists (
			SELECT 1 FROM information_schema.columns
			WHERE table_schema = current_schema()
			  AND table_name = ${"users"}
			  AND column_name = ${"is_super_admin"}
		) AS has_is_super_admin,
		exists (
			SELECT 1 FROM information_schema.columns
			WHERE table_schema = current_schema()
			  AND table_name = ${"tenants"}
			  AND column_name = ${"brand_color"}
		) AS has_brand_color
`);

console.log(JSON.stringify(result, null, 2));
