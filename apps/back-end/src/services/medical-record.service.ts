import { AppError } from "@/lib/errors/app-error";
import { ErrorCode } from "@/lib/errors/error-codes";
import {
	medicalRecordRepository,
	type MedicalRecordListParams,
} from "@/repositories/medical-record.repository";
import { patientRepository } from "@/repositories/patient.repository";
import { procedureRepository } from "@/repositories/procedure.repository";
import { appointmentRepository } from "@/repositories/appointment.repository";
import type { MedicalRecord, MedicalRecordProcedure } from "@/db/schema";

export interface CreateMedicalRecordInput {
	patientId: string;
	doctorId?: string;
	appointmentId?: string;
	chiefComplaint?: string;
	diagnosis?: string;
	treatment?: string;
	notes?: string;
}

export interface AttachProcedureInput {
	procedureId: string;
	toothNumber?: string;
	quadrant?: string;
	notes?: string;
}

export class MedicalRecordService {
	async create(
		tenantId: string,
		createdByUserId: string | null,
		input: CreateMedicalRecordInput,
	): Promise<MedicalRecord> {
		if (!(await patientRepository.findById(tenantId, input.patientId))) {
			throw new AppError("Patient not found", 404, ErrorCode.NOT_FOUND);
		}
		if (input.appointmentId) {
			const appointment = await appointmentRepository.findAppointmentById(
				tenantId,
				input.appointmentId,
			);
			if (!appointment) {
				throw new AppError("Appointment not found", 404, ErrorCode.NOT_FOUND);
			}
		}

		return medicalRecordRepository.createMedicalRecord(tenantId, {
			patientId: input.patientId,
			doctorId: input.doctorId ?? null,
			appointmentId: input.appointmentId ?? null,
			chiefComplaint: input.chiefComplaint,
			diagnosis: input.diagnosis,
			treatment: input.treatment,
			notes: input.notes,
			createdByUserId:
				createdByUserId ?? "00000000-0000-0000-0000-000000000000",
		});
	}

	async update(
		tenantId: string,
		id: string,
		input: Partial<CreateMedicalRecordInput>,
	): Promise<MedicalRecord> {
		const existing = await medicalRecordRepository.findMedicalRecordById(
			tenantId,
			id,
		);
		if (!existing) {
			throw new AppError("Medical record not found", 404, ErrorCode.NOT_FOUND);
		}

		const patch: Record<string, unknown> = {};
		if (input.doctorId !== undefined) patch.doctorId = input.doctorId;
		if (input.chiefComplaint !== undefined)
			patch.chiefComplaint = input.chiefComplaint;
		if (input.diagnosis !== undefined) patch.diagnosis = input.diagnosis;
		if (input.treatment !== undefined) patch.treatment = input.treatment;
		if (input.notes !== undefined) patch.notes = input.notes;

		const updated = await medicalRecordRepository.updateMedicalRecord(
			tenantId,
			id,
			patch,
		);
		if (!updated) {
			throw new AppError("Medical record not found", 404, ErrorCode.NOT_FOUND);
		}
		return updated;
	}

	async attachProcedure(
		tenantId: string,
		medicalRecordId: string,
		input: AttachProcedureInput,
	): Promise<MedicalRecordProcedure> {
		const record = await medicalRecordRepository.findMedicalRecordById(
			tenantId,
			medicalRecordId,
		);
		if (!record) {
			throw new AppError("Medical record not found", 404, ErrorCode.NOT_FOUND);
		}
		if (!(await procedureRepository.findById(tenantId, input.procedureId))) {
			throw new AppError("Procedure not found", 404, ErrorCode.NOT_FOUND);
		}

		return medicalRecordRepository.addRecordProcedure(tenantId, {
			medicalRecordId,
			procedureId: input.procedureId,
			toothNumber: input.toothNumber,
			quadrant: input.quadrant,
			notes: input.notes,
		});
	}

	async list(
		tenantId: string,
		query: {
			patientId?: string;
			doctorId?: string;
			dateFrom?: string;
			dateTo?: string;
			page?: number;
			pageSize?: number;
		},
	) {
		const page = Math.max(1, query.page ?? 1);
		const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
		const filters: MedicalRecordListParams = {
			tenantId,
			patientId: query.patientId,
			doctorId: query.doctorId,
			dateFrom: query.dateFrom,
			dateTo: query.dateTo,
			limit: pageSize,
			offset: (page - 1) * pageSize,
		};
		const countFilters = {
			patientId: query.patientId,
			doctorId: query.doctorId,
			dateFrom: query.dateFrom,
			dateTo: query.dateTo,
		};
		const [items, total] = await Promise.all([
			medicalRecordRepository.listMedicalRecords(filters),
			medicalRecordRepository.countMedicalRecords(tenantId, countFilters),
		]);
		return { items, total, page, pageSize };
	}
}

export const medicalRecordService = new MedicalRecordService();
