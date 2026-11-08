import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { DoctorsPage } from "@/features/doctors/components/doctors-page";

export const Route = createFileRoute("/_authenticated/doctors")({
	validateSearch: z.object({ search: z.string().optional() }),
	component: DoctorsPage,
});
