import { AppError } from "@/lib/errors/app-error";
import { ErrorCode } from "@/lib/errors/error-codes";
import {
	procedureRepository,
	type ProcedureListParams,
} from "@/repositories/procedure.repository";
import type { DiscountType } from "@/db/schema";

export interface ProcedureInput {
	code?: string;
	name: string;
	category?: string;
	defaultPrice: string;
	defaultDurationMinutes?: number;
	discountType?: DiscountType;
	discountValue?: string;
	isActive?: boolean;
}

export interface EffectivePrice {
	price: number;
	discountAmount: number;
	finalPrice: number;
}

export class ProcedureService {
	/** Enforces discount rules; returns the effective price breakdown. */
	static validateDiscount(input: {
		defaultPrice: string;
		discountType: DiscountType;
		discountValue: string;
	}): EffectivePrice {
		const price = Number(input.defaultPrice ?? "0");
		const value = Number(input.discountValue ?? "0");
		if (!Number.isFinite(price) || price < 0) {
			throw new AppError(
				"defaultPrice must be a non-negative number",
				400,
				ErrorCode.BAD_REQUEST,
			);
		}
		if (!Number.isFinite(value) || value < 0) {
			throw new AppError(
				"discountValue must be a non-negative number",
				400,
				ErrorCode.BAD_REQUEST,
			);
		}

		let discountAmount = 0;
		if (input.discountType === "PERCENTAGE") {
			if (value > 100) {
				throw new AppError(
					"Percentage discount cannot exceed 100",
					400,
					ErrorCode.BAD_REQUEST,
				);
			}
			discountAmount = (price * value) / 100;
		} else if (input.discountType === "FIXED") {
			if (value > price) {
				throw new AppError(
					"Fixed discount cannot exceed the price",
					400,
					ErrorCode.BAD_REQUEST,
				);
			}
			discountAmount = value;
		}

		const finalPrice = Math.max(0, price - discountAmount);
		return {
			price,
			discountAmount: Math.round(discountAmount * 100) / 100,
			finalPrice: Math.round(finalPrice * 100) / 100,
		};
	}

	async create(tenantId: string, input: ProcedureInput) {
		const discountType = input.discountType ?? "NONE";
		const discountValue = input.discountValue ?? "0";
		ProcedureService.validateDiscount({
			defaultPrice: input.defaultPrice,
			discountType,
			discountValue,
		});

		return procedureRepository.create(tenantId, {
			code: input.code ?? undefined,
			name: input.name,
			category: input.category ?? undefined,
			defaultPrice: input.defaultPrice,
			defaultDurationMinutes: input.defaultDurationMinutes,
			discountType,
			discountValue: String(discountValue),
			isActive: input.isActive ?? true,
		});
	}

	async update(tenantId: string, id: string, input: Partial<ProcedureInput>) {
		const existing = await procedureRepository.findById(tenantId, id);
		if (!existing) {
			throw new AppError("Procedure not found", 404, ErrorCode.NOT_FOUND);
		}

		const patch: Record<string, unknown> = {};
		if (input.code !== undefined) patch.code = input.code;
		if (input.name !== undefined) patch.name = input.name;
		if (input.category !== undefined) patch.category = input.category;
		if (input.defaultDurationMinutes !== undefined) {
			patch.defaultDurationMinutes = input.defaultDurationMinutes;
		}
		if (input.isActive !== undefined) patch.isActive = input.isActive;

		const discountType = input.discountType ?? existing.discountType;
		const defaultPrice = input.defaultPrice ?? existing.defaultPrice ?? "0";
		const discountValue = input.discountValue ?? existing.discountValue ?? "0";
		if (
			input.defaultPrice !== undefined ||
			input.discountType !== undefined ||
			input.discountValue !== undefined
		) {
			ProcedureService.validateDiscount({
				defaultPrice,
				discountType,
				discountValue,
			});
			patch.discountType = discountType;
			patch.discountValue = String(discountValue);
			patch.defaultPrice = String(defaultPrice);
		}

		const updated = await procedureRepository.update(tenantId, id, patch);
		if (!updated) {
			throw new AppError("Procedure not found", 404, ErrorCode.NOT_FOUND);
		}
		return updated;
	}

	async remove(tenantId: string, id: string) {
		const existing = await procedureRepository.findById(tenantId, id);
		if (!existing) {
			throw new AppError("Procedure not found", 404, ErrorCode.NOT_FOUND);
		}
		await procedureRepository.softDelete(tenantId, id);
	}

	async list(
		tenantId: string,
		query: {
			search?: string;
			category?: string;
			includeInactive?: boolean;
			page?: number;
			pageSize?: number;
		},
	) {
		const page = Math.max(1, query.page ?? 1);
		const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 50));
		const filters: ProcedureListParams = {
			tenantId,
			search: query.search,
			category: query.category,
			includeInactive: query.includeInactive,
			limit: pageSize,
			offset: (page - 1) * pageSize,
		};
		const [items, total] = await Promise.all([
			procedureRepository.list(filters),
			procedureRepository.count(tenantId, filters),
		]);
		return { items, total, page, pageSize };
	}
}

export const procedureService = new ProcedureService();
