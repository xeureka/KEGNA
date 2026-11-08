import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { products, stockMovements } from "@/db/schema";

export class StockRepository {
	async lockProduct(tx: any, productId: string) { await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${productId}))`); }
	async warehouseBalance(tx: any, productId: string) { const [row] = await tx.select({ balance: sql<number>`coalesce(sum(${stockMovements.warehouseDelta}), 0)` }).from(stockMovements).where(eq(stockMovements.productId, productId)); return Number(row?.balance ?? 0); }
	async balances() { return db.select({ product: products, warehouseBalance: sql<number>`coalesce(sum(${stockMovements.warehouseDelta}), 0)`, heldBySalespeople: sql<number>`coalesce(sum(${stockMovements.holderDelta}), 0)` }).from(products).leftJoin(stockMovements, eq(stockMovements.productId, products.id)).groupBy(products.id).orderBy(asc(products.name)); }
	async movements(filters: { productId?: string; type?: string; from?: Date; to?: Date; limit: number; offset: number }) {
		const conditions = [];
		if (filters.productId) conditions.push(eq(stockMovements.productId, filters.productId));
		if (filters.type) conditions.push(eq(stockMovements.type, filters.type as never));
		if (filters.from) conditions.push(gte(stockMovements.createdAt, filters.from));
		if (filters.to) conditions.push(lte(stockMovements.createdAt, filters.to));
		return db.select().from(stockMovements).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(stockMovements.createdAt)).limit(filters.limit).offset(filters.offset);
	}
	insert(tx: any, input: typeof stockMovements.$inferInsert) { return tx.insert(stockMovements).values(input).returning(); }
}
export const stockRepository = new StockRepository();
