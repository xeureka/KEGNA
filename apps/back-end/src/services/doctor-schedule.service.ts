import { AppError } from "@/lib/errors/app-error";
import { ErrorCode } from "@/lib/errors/error-codes";
import { doctorScheduleRepository } from "@/repositories/doctor-schedule.repository";
import { doctorRepository } from "@/repositories/doctor.repository";
import type { DoctorSchedule } from "@/db/schema";

export interface ScheduleDayInput {
	dayOfWeek: number;
	startTime: string;
	endTime: string;
	isAvailable: boolean;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class DoctorScheduleService {
	async getWeek(tenantId: string, doctorId: string): Promise<DoctorSchedule[]> {
		if (!(await doctorRepository.findById(tenantId, doctorId))) {
			throw new AppError("Doctor not found", 404, ErrorCode.NOT_FOUND);
		}
		const rows = await doctorScheduleRepository.listForDoctor(
			tenantId,
			doctorId,
		);
		return rows.toSorted(
			(a, b) =>
				a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime),
		);
	}

	async replaceWeek(
		tenantId: string,
		doctorId: string,
		days: ScheduleDayInput[],
	): Promise<DoctorSchedule[]> {
		if (!(await doctorRepository.findById(tenantId, doctorId))) {
			throw new AppError("Doctor not found", 404, ErrorCode.NOT_FOUND);
		}

		const seen = new Set<number>();
		for (const day of days) {
			if (
				!Number.isInteger(day.dayOfWeek) ||
				day.dayOfWeek < 0 ||
				day.dayOfWeek > 6
			) {
				throw new AppError(
					"dayOfWeek must be an integer between 0 (Sunday) and 6 (Saturday)",
					400,
					ErrorCode.BAD_REQUEST,
				);
			}
			if (
				!TIME_PATTERN.test(day.startTime) ||
				!TIME_PATTERN.test(day.endTime)
			) {
				throw new AppError(
					"startTime and endTime must use HH:MM 24-hour format",
					400,
					ErrorCode.BAD_REQUEST,
				);
			}
			if (day.endTime <= day.startTime) {
				throw new AppError(
					"endTime must be after startTime",
					400,
					ErrorCode.BAD_REQUEST,
				);
			}
			if (seen.has(day.dayOfWeek)) {
				throw new AppError(
					`Duplicate dayOfWeek ${day.dayOfWeek}`,
					400,
					ErrorCode.BAD_REQUEST,
				);
			}
			seen.add(day.dayOfWeek);
		}

		return doctorScheduleRepository.replaceWeek(
			tenantId,
			doctorId,
			days.map((d) => ({
				dayOfWeek: d.dayOfWeek,
				startTime: d.startTime,
				endTime: d.endTime,
				isAvailable: d.isAvailable,
			})),
		);
	}
}

export const doctorScheduleService = new DoctorScheduleService();
