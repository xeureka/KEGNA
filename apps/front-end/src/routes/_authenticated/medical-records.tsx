import { createFileRoute } from "@tanstack/react-router";

import { MedicalRecordsPage } from "@/features/medical-records/components/medical-records-page";

export const Route = createFileRoute("/_authenticated/medical-records")({
	component: MedicalRecordsPage,
});
