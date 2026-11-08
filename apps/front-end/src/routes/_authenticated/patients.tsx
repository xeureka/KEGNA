import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { PatientsPage } from "@/features/patients/components/patients-page";

export const Route = createFileRoute("/_authenticated/patients")({
	validateSearch: z.object({ search: z.string().optional() }),
	component: PatientsPage,
});
