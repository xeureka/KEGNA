import { createFileRoute } from "@tanstack/react-router";

import { AppointmentCalendarPage } from "@/features/calendar/components/appointment-calendar";

export const Route = createFileRoute("/_authenticated/calendar")({
	component: AppointmentCalendarPage,
});
