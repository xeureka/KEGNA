import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
	users,
	accounts,
	type User,
	type NewUser,
	type Account,
	type NewAccount,
} from "@/db/schema";

export class UserRepository {
	async findById(id: string): Promise<User | null> {
		const [user] = await db
			.select()
			.from(users)
			.where(eq(users.id, id))
			.limit(1);
		return user ?? null;
	}

	async findByEmail(email: string): Promise<User | null> {
		const [user] = await db
			.select()
			.from(users)
			.where(eq(users.email, email))
			.limit(1);
		return user ?? null;
	}

	async findByPhone(phone: string): Promise<User | null> {
		const [user] = await db
			.select()
			.from(users)
			.where(eq(users.phone, phone))
			.limit(1);
		return user ?? null;
	}

	async createUser(data: NewUser): Promise<User> {
		const [created] = await db.insert(users).values(data).returning();
		if (!created) throw new Error("Failed to create user");
		return created;
	}

	async createAccount(data: NewAccount): Promise<Account> {
		const [account] = await db.insert(accounts).values(data).returning();
		if (!account) throw new Error("Failed to create account");
		return account;
	}

	async findAccountByUserId(userId: string): Promise<Account | null> {
		const [account] = await db
			.select()
			.from(accounts)
			.where(eq(accounts.userId, userId))
			.limit(1);
		return account ?? null;
	}
}

export const userRepository = new UserRepository();
