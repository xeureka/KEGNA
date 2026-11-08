import { createContext, useContext } from "react";
import type { Appointment } from "../types";
import { tenantConfig } from "../../config/tenant.config";

export type { Appointment };

export const initialAppointment: Appointment = {
	service: {
		...tenantConfig.content.defaultAppointment,
	},
	dentist: "Dr. Selamawit Tadesse",
	date: 24,
	month: "October 2026",
	time: "10:30 AM",
	clinic: tenantConfig.identity.displayName,
};

export const AppointmentContext = createContext<{
	appointment: Appointment;
	setAppointment: (apt: Appointment) => void;
	reschedulingAppointmentId: string | null;
	setReschedulingAppointmentId: (id: string | null) => void;
	appointmentCancelled: boolean;
	setAppointmentCancelled: (cancelled: boolean) => void;
}>({
	appointment: initialAppointment,
	setAppointment: () => undefined,
	reschedulingAppointmentId: null,
	setReschedulingAppointmentId: () => undefined,
	appointmentCancelled: false,
	setAppointmentCancelled: () => undefined,
});

export const useAppointment = () => useContext(AppointmentContext);

export default AppointmentContext;
