import { AppError } from "@/lib/errors/app-error";
import { ErrorCode } from "@/lib/errors/error-codes";
import { dentalChartRepository } from "@/repositories/dental-chart.repository";
import { patientRepository } from "@/repositories/patient.repository";
import { doctorRepository } from "@/repositories/doctor.repository";
import { procedureRepository } from "@/repositories/procedure.repository";
import type { DentalChartEntry, DentalChartStatus } from "@/db/schema";

export interface AddChartEntryInput {
	patientId: string;
	doctorId: string;
	appointmentId?: string;
	toothNumber: number;
	surface?: string;
	procedureId?: string;
	procedureName: string;
	notes?: string;
	charge: string;
	status?: DentalChartStatus;
	datePerformed?: string | null;
}

export interface UpdateChartEntryInput {
	surface?: string;
	notes?: string;
	charge?: string;
	status?: DentalChartStatus;
	datePerformed?: string | null;
}

export class DentalChartService {
	async addEntry(
		tenantId: string,
		input: AddChartEntryInput,
	): Promise<DentalChartEntry> {
		if (
			!Number.isInteger(input.toothNumber) ||
			input.toothNumber < 1 ||
			input.toothNumber > 32
		) {
			throw new AppError(
				"toothNumber must be an integer between 1 and 32",
				400,
				ErrorCode.BAD_REQUEST,
			);
		}
		if (!(await patientRepository.findById(tenantId, input.patientId))) {
			throw new AppError("Patient not found", 404, ErrorCode.NOT_FOUND);
		}
		if (!(await doctorRepository.findById(tenantId, input.doctorId))) {
			throw new AppError("Doctor not found", 404, ErrorCode.NOT_FOUND);
		}
		if (input.procedureId) {
			const procedure = await procedureRepository.findById(
				tenantId,
				input.procedureId,
			);
			if (!procedure) {
				throw new AppError("Procedure not found", 404, ErrorCode.NOT_FOUND);
			}
		}

		const status = input.status ?? "PLANNED";
		if (status === "COMPLETED" && !input.datePerformed) {
			throw new AppError(
				"datePerformed is required when the entry is COMPLETED",
				400,
				ErrorCode.BAD_REQUEST,
			);
		}

		return dentalChartRepository.create(tenantId, {
			patientId: input.patientId,
			doctorId: input.doctorId,
			appointmentId: input.appointmentId,
			toothNumber: input.toothNumber,
			surface: input.surface,
			procedureId: input.procedureId,
			procedureName: input.procedureName,
			notes: input.notes,
			charge: String(input.charge ?? "0"),
			status,
			datePerformed: input.datePerformed ?? null,
		});
	}

	async updateEntry(
		tenantId: string,
		id: string,
		input: UpdateChartEntryInput,
	): Promise<DentalChartEntry> {
		const existing = await dentalChartRepository.findById(tenantId, id);
		if (!existing) {
			throw new AppError(
				"Dental chart entry not found",
				404,
				ErrorCode.NOT_FOUND,
			);
		}

		const patch: Record<string, unknown> = {};
		if (input.surface !== undefined) patch.surface = input.surface;
		if (input.notes !== undefined) patch.notes = input.notes;

		const status = input.status ?? existing.status;
		if (input.status !== undefined || input.datePerformed !== undefined) {
			const datePerformed =
				input.datePerformed !== undefined
					? input.datePerformed
					: existing.datePerformed;
			if (status === "COMPLETED" && !datePerformed) {
				throw new AppError(
					"datePerformed is required when the entry is COMPLETED",
					400,
					ErrorCode.BAD_REQUEST,
				);
			}
			if (status !== "COMPLETED" && input.status !== undefined) {
				patch.datePerformed = null;
			} else if (input.datePerformed !== undefined) {
				patch.datePerformed = input.datePerformed;
			}
			patch.status = status;
		}

		if (input.charge !== undefined) {
			const charge = Number(input.charge);
			if (!Number.isFinite(charge) || charge < 0) {
				throw new AppError(
					"charge must be a non-negative number",
					400,
					ErrorCode.BAD_REQUEST,
				);
			}
			patch.charge = String(charge);
		}

		const updated = await dentalChartRepository.update(tenantId, id, patch);
		if (!updated) {
			throw new AppError(
				"Dental chart entry not found",
				404,
				ErrorCode.NOT_FOUND,
			);
		}
		return updated;
	}

	async removeEntry(tenantId: string, id: string): Promise<void> {
		const existing = await dentalChartRepository.findById(tenantId, id);
		if (!existing) {
			throw new AppError(
				"Dental chart entry not found",
				404,
				ErrorCode.NOT_FOUND,
			);
		}
		await dentalChartRepository.softDelete(tenantId, id);
	}

	async list(
		tenantId: string,
		query: {
			patientId?: string;
			doctorId?: string;
			status?: string;
			page?: number;
			pageSize?: number;
		},
	) {
		const page = Math.max(1, query.page ?? 1);
		const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 50));
		const filters = {
			patientId: query.patientId,
			doctorId: query.doctorId,
			status: query.status,
		};
		const [items, total] = await Promise.all([
			dentalChartRepository.list({
				tenantId,
				...filters,
				limit: pageSize,
				offset: (page - 1) * pageSize,
			}),
			dentalChartRepository.count(tenantId, filters),
		]);
		return { items, total, page, pageSize };
	}

	async byToothForPatient(
		tenantId: string,
		patientId: string,
		doctorId?: string,
	): Promise<DentalChartEntry[]> {
		return dentalChartRepository.byToothForPatient(
			tenantId,
			patientId,
			doctorId,
		);
	}
}

export const dentalChartService = new DentalChartService();
