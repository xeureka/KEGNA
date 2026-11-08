import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { verifications, type Verification } from "@/db/schema";

export class OtpRepository {
	async saveOtp(
		identifier: string,
		value: string,
		expiresAt: Date,
	): Promise<Verification> {
		await db
			.delete(verifications)
			.where(eq(verifications.identifier, identifier));

		const [created] = await db
			.insert(verifications)
			.values({
				identifier,
				value,
				expiresAt,
				createdAt: new Date(),
				updatedAt: new Date(),
			})
			.returning();

		if (!created) throw new Error("Failed to save OTP code");
		return created;
	}

	async findValidOtp(
		identifier: string,
		value: string,
	): Promise<Verification | null> {
		const now = new Date();
		const [record] = await db
			.select()
			.from(verifications)
			.where(
				and(
					eq(verifications.identifier, identifier),
					eq(verifications.value, value),
					gt(verifications.expiresAt, now),
				),
			)
			.limit(1);

		return record ?? null;
	}

	async deleteOtp(identifier: string): Promise<void> {
		await db
			.delete(verifications)
			.where(eq(verifications.identifier, identifier));
	}
}

export const otpRepository = new OtpRepository();
