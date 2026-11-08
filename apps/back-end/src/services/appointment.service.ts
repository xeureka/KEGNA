import { AppError } from "@/lib/errors/app-error";
import { ErrorCode } from "@/lib/errors/error-codes";
import {
	appointmentRepository,
	type AppointmentRow,
} from "@/repositories/appointment.repository";
import { patientRepository } from "@/repositories/patient.repository";
import { doctorRepository } from "@/repositories/doctor.repository";
import { appointmentStatusHistoryRepository } from "@/repositories/appointment-status-history.repository";
import { db } from "@/db";
import { appointments } from "@/db/schema";
import { and, eq, gt, isNull, lt, ne, notInArray } from "drizzle-orm";
import type {
	Appointment,
	AppointmentStatus,
	NewAppointment,
} from "@/db/schema";
import { billingService } from "@/services/billing.service";

export interface CreateAppointmentInput {
	patientId: string;
	doctorId: string;
	startAt: string;
	endAt: string;
	reason?: string;
	notes?: string;
}

export interface UpdateAppointmentInput {
	doctorId?: string;
	startAt?: string;
	endAt?: string;
	reason?: string;
	notes?: string;
}

export interface TransitionInput {
	status: AppointmentStatus;
	/** Required when transitioning to CANCELLED or NO_SHOW. */
	reason?: string;
}

export interface AppointmentListQuery {
	patientId?: string;
	doctorId?: string;
	status?: AppointmentStatus | string;
	dateFrom?: string;
	dateTo?: string;
	page?: number;
	pageSize?: number;
}

const TERMINAL_CANCELLED: AppointmentStatus[] = ["CANCELLED", "NO_SHOW"];

async function assertDoctorSlotAvailable(
	tenantId: string,
	doctorId: string,
	startAt: Date,
	endAt: Date,
	excludeId?: string,
) {
	const conditions = [
		eq(appointments.tenantId, tenantId),
		eq(appointments.doctorId, doctorId),
		isNull(appointments.deletedAt),
		notInArray(appointments.status, TERMINAL_CANCELLED),
		lt(appointments.startAt, endAt),
		gt(appointments.endAt, startAt),
	];
	if (excludeId) conditions.push(ne(appointments.id, excludeId));
	const [conflict] = await db
		.select({ id: appointments.id })
		.from(appointments)
		.where(and(...conditions))
		.limit(1);
	if (conflict) {
		throw new AppError(
			"Doctor already has an appointment during this time",
			409,
			ErrorCode.CONFLICT,
		);
	}
}

const FLOW: Record<AppointmentStatus, AppointmentStatus[]> = {
	SCHEDULED: ["CONFIRMED", "CHECKED_IN", "CANCELLED", "NO_SHOW"],
	PENDING_PAYMENT: ["CANCELLED"],
	CONFIRMED: ["CHECKED_IN", "CANCELLED", "NO_SHOW"],
	CHECKED_IN: ["IN_PROGRESS", "CANCELLED", "NO_SHOW"],
	IN_PROGRESS: ["COMPLETED", "CANCELLED"],
	COMPLETED: [],
	CANCELLED: [],
	NO_SHOW: [],
};

export class AppointmentService {
	async create(
		tenantId: string,
		actorUserId: string | null,
		input: CreateAppointmentInput,
	): Promise<Appointment> {
		const startAt = new Date(input.startAt);
		const endAt = new Date(input.endAt);

		if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
			throw new AppError(
				"startAt and endAt must be valid ISO timestamps",
				400,
				ErrorCode.BAD_REQUEST,
			);
		}
		if (endAt <= startAt) {
			throw new AppError(
				"endAt must be after startAt",
				400,
				ErrorCode.BAD_REQUEST,
			);
		}
		if (startAt <= new Date()) {
			throw new AppError(
				"Appointments must be booked for a future date and time",
				400,
				ErrorCode.BAD_REQUEST,
			);
		}
		await assertDoctorSlotAvailable(tenantId, input.doctorId, startAt, endAt);

		const patient = await patientRepository.findById(tenantId, input.patientId);
		if (!patient) {
			throw new AppError("Patient not found", 404, ErrorCode.NOT_FOUND);
		}
		const doctor = await doctorRepository.findById(tenantId, input.doctorId);
		if (!doctor) {
			throw new AppError("Doctor not found", 404, ErrorCode.NOT_FOUND);
		}

		const appointment = await appointmentRepository.createAppointment(
			tenantId,
			{
				patientId: input.patientId,
				doctorId: input.doctorId,
				startAt,
				endAt,
				status: "SCHEDULED",
				reason: input.reason,
				notes: input.notes,
				createdByUserId: actorUserId,
			},
		);

		await appointmentStatusHistoryRepository.insert(tenantId, {
			appointmentId: appointment.id,
			oldStatus: null,
			newStatus: "SCHEDULED",
			changedByUserId: actorUserId,
			changedAt: new Date(),
		});
		await billingService.ensureAppointmentBalance({
			tenantId,
			appointmentId: appointment.id,
			patientId: appointment.patientId,
			reason: appointment.reason,
			createdByUserId: actorUserId,
		});

		return appointment;
	}

	async findById(tenantId: string, id: string): Promise<AppointmentRow> {
		const row = await appointmentRepository.findAppointmentRow(tenantId, id);
		if (!row) {
			throw new AppError("Appointment not found", 404, ErrorCode.NOT_FOUND);
		}
		return row;
	}

	async list(
		tenantId: string,
		query: AppointmentListQuery,
	): Promise<{
		items: AppointmentRow[];
		total: number;
		page: number;
		pageSize: number;
	}> {
		const page = Math.max(1, query.page ?? 1);
		const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
		const offset = (page - 1) * pageSize;

		const filters = {
			patientId: query.patientId,
			doctorId: query.doctorId,
			status: query.status,
			dateFrom: query.dateFrom,
			dateTo: query.dateTo,
		};

		const [items, total] = await Promise.all([
			appointmentRepository.listAppointments({
				tenantId,
				...filters,
				limit: pageSize,
				offset,
			}),
			appointmentRepository.countAppointments(tenantId, filters),
		]);

		return { items, total, page, pageSize };
	}

	async update(
		tenantId: string,
		id: string,
		input: UpdateAppointmentInput,
	): Promise<Appointment> {
		const existing = await appointmentRepository.findAppointmentById(
			tenantId,
			id,
		);
		if (!existing) {
			throw new AppError("Appointment not found", 404, ErrorCode.NOT_FOUND);
		}
		if (
			existing.status === "COMPLETED" ||
			TERMINAL_CANCELLED.includes(existing.status)
		) {
			throw new AppError(
				"Cannot modify a finished appointment",
				409,
				ErrorCode.CONFLICT,
			);
		}

		const patch: Partial<NewAppointment> = {};
		if (input.doctorId !== undefined) {
			if (!(await doctorRepository.findById(tenantId, input.doctorId))) {
				throw new AppError("Doctor not found", 404, ErrorCode.NOT_FOUND);
			}
			patch.doctorId = input.doctorId;
		}
		if (input.startAt !== undefined || input.endAt !== undefined) {
			const startAt = new Date(input.startAt ?? existing.startAt);
			const endAt = new Date(input.endAt ?? existing.endAt);
			if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
				throw new AppError("Invalid timestamp", 400, ErrorCode.BAD_REQUEST);
			}
			if (endAt <= startAt) {
				throw new AppError(
					"endAt must be after startAt",
					400,
					ErrorCode.BAD_REQUEST,
				);
			}
			if (startAt <= new Date()) {
				throw new AppError(
					"Appointments must be scheduled for a future date and time",
					400,
					ErrorCode.BAD_REQUEST,
				);
			}
			await assertDoctorSlotAvailable(
				tenantId,
				input.doctorId ?? existing.doctorId,
				startAt,
				endAt,
				id,
			);
			patch.startAt = startAt;
			patch.endAt = endAt;
		}
		if (input.reason !== undefined) patch.reason = input.reason;
		if (input.notes !== undefined) patch.notes = input.notes;

		const updated = await appointmentRepository.updateAppointment(
			tenantId,
			id,
			patch,
		);
		if (!updated) {
			throw new AppError("Appointment not found", 404, ErrorCode.NOT_FOUND);
		}
		return updated;
	}

	/** Validates and persists a status change, recording history. */
	async transition(
		tenantId: string,
		id: string,
		actorUserId: string | null,
		input: TransitionInput,
	): Promise<Appointment> {
		const existing = await appointmentRepository.findAppointmentById(
			tenantId,
			id,
		);
		if (!existing) {
			throw new AppError("Appointment not found", 404, ErrorCode.NOT_FOUND);
		}

		if (existing.status === input.status) {
			return existing;
		}

		const allowed = FLOW[existing.status];
		if (!allowed.includes(input.status)) {
			throw new AppError(
				`Cannot transition appointment from ${existing.status} to ${input.status}`,
				409,
				ErrorCode.CONFLICT,
			);
		}

		const patch: Partial<NewAppointment> = { status: input.status };

		if (TERMINAL_CANCELLED.includes(input.status)) {
			const reason = input.reason?.trim();
			if (!reason) {
				throw new AppError(
					"Cancellation reason is required for CANCELLED and NO_SHOW appointments",
					400,
					ErrorCode.BAD_REQUEST,
				);
			}
			patch.cancelledAt = new Date();
			patch.cancelledReason = reason;
		} else {
			patch.cancelledAt = null;
			patch.cancelledReason = null;
		}

		const updated = await appointmentRepository.updateAppointment(
			tenantId,
			id,
			patch,
		);
		if (!updated) {
			throw new AppError("Appointment not found", 404, ErrorCode.NOT_FOUND);
		}

		await appointmentStatusHistoryRepository.insert(tenantId, {
			appointmentId: id,
			oldStatus: existing.status,
			newStatus: input.status,
			changedByUserId: actorUserId,
			reason: input.reason?.trim() || undefined,
			changedAt: new Date(),
		});
		if (input.status === "CHECKED_IN" || input.status === "COMPLETED") {
			await billingService.ensureAppointmentBalance({
				tenantId,
				appointmentId: updated.id,
				patientId: updated.patientId,
				reason: updated.reason,
				createdByUserId: actorUserId,
			});
		}

		return updated;
	}

	async queueForDay(
		tenantId: string,
		date: string,
		doctorId?: string,
	): Promise<AppointmentRow[]> {
		return appointmentRepository.listForDay(tenantId, date, doctorId);
	}

	async statusCounts(
		tenantId: string,
		from: Date,
		to: Date,
		doctorId?: string,
	): Promise<Array<{ status: AppointmentStatus; value: number }>> {
		return appointmentRepository.countByStatus(tenantId, from, to, doctorId);
	}
}

export const appointmentService = new AppointmentService();
