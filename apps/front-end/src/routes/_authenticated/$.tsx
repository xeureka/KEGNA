import { createFileRoute } from "@tanstack/react-router";

import { NotFoundPage } from "@/components/errors/not-found-page";

export const Route = createFileRoute("/_authenticated/$")({
	component: NotFoundPage,
});
