import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";

export class ProductsRepository {
	list() { return db.select().from(products).orderBy(asc(products.name)); }
	findById(id: string) { return db.select().from(products).where(eq(products.id, id)).limit(1); }
	findBySku(sku: string) { return db.select().from(products).where(eq(products.sku, sku)).limit(1); }
	create(input: typeof products.$inferInsert) { return db.insert(products).values(input).returning(); }
	update(id: string, input: Partial<typeof products.$inferInsert>) { return db.update(products).set({ ...input, updatedAt: new Date() }).where(eq(products.id, id)).returning(); }
}
export const productsRepository = new ProductsRepository();
