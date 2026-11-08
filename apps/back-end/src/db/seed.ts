import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db, pool } from "@/db";
import { products, stockMovements, users } from "@/db/schema";

const password = process.env.SEED_PASSWORD;
if (!password || password.length < 8) throw new Error("SEED_PASSWORD must be provided in the environment and be at least 8 characters");
const seedPassword = password;

const people = [
	{ email: "admin@zola.local", name: "ZOLA Admin", role: "admin" },
	{ email: "storekeeper@zola.local", name: "ZOLA Storekeeper", role: "storekeeper" },
	{ email: "sales.one@zola.local", name: "Sales One", role: "sales" },
	{ email: "sales.two@zola.local", name: "Sales Two", role: "sales" },
	{ email: "accountant@zola.local", name: "ZOLA Accountant", role: "accountant" },
] as const;

const productData = [
	{ name: "St. George Lager 330ml", sku: "STG-330", bottlesPerRack: 24, pricePerRack: "2100.00" },
	{ name: "Meta Premium Lager 330ml", sku: "META-330", bottlesPerRack: 24, pricePerRack: "2200.00" },
	{ name: "Walia Lager 330ml", sku: "WAL-330", bottlesPerRack: 24, pricePerRack: "2000.00" },
	{ name: "Habesha Cold Gold 330ml", sku: "HAB-330", bottlesPerRack: 24, pricePerRack: "2300.00" },
];

async function ensureUser(person: (typeof people)[number]) {
	const existing = await db.select().from(users).where(eq(users.email, person.email)).limit(1);
	if (existing[0]) {
		await db.update(users).set({ name: person.name, role: person.role, banned: false }).where(eq(users.id, existing[0].id));
		return existing[0].id;
	}
	const result = await auth.api.signUpEmail({ body: { email: person.email, password: seedPassword, name: person.name } });
	if (!result.user) throw new Error(`Failed to create seed user ${person.email}`);
	await db.update(users).set({ role: person.role }).where(eq(users.id, result.user.id));
	return result.user.id;
}

async function main() {
	const seededUsers = new Map<string, string>();
	for (const person of people) seededUsers.set(person.role === "sales" ? person.email : person.role, await ensureUser(person));
	const storekeeperId = seededUsers.get("storekeeper");
	if (!storekeeperId) throw new Error("Storekeeper seed user missing");

	for (const item of productData) {
		const existing = await db.select().from(products).where(eq(products.sku, item.sku)).limit(1);
		const product = existing[0] ?? (await db.insert(products).values(item).returning())[0];
		if (!product) throw new Error(`Failed to seed product ${item.sku}`);
		const received = await db.select({ id: stockMovements.id }).from(stockMovements).where(and(eq(stockMovements.productId, product.id), eq(stockMovements.type, "receive"))).limit(1);
		if (!received[0]) await db.insert(stockMovements).values({ productId: product.id, type: "receive", warehouseDelta: 100, holderDelta: 0, batchNo: "OPENING", reference: "ZOLA opening balance", createdBy: storekeeperId });
	}
	let verifiedUsers = 0;
	for (const person of people) {
		const result = await auth.api.signInEmail({ body: { email: person.email, password: seedPassword } });
		if (!result?.user || !result.token) throw new Error(`Seed sign-in verification failed for ${person.email}`);
		verifiedUsers += 1;
	}
	console.log(`seed verified: ${verifiedUsers} users can sign in`);
	console.log(JSON.stringify({ seeded: true, users: people.map((person) => person.email), products: productData.map((item) => item.sku), passwordSource: "SEED_PASSWORD" }));
}

main().catch((error) => { console.error("Seed failed:", error); process.exitCode = 1; }).finally(async () => { await pool.end(); });
