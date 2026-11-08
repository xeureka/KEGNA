import { queryOptions } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { Member } from "@/lib/types";

export const userKeys = {
	all: ["members"] as const,
	list: () => ["members", "list"] as const,
};

export const usersListQueryOptions = () =>
	queryOptions({
		queryKey: userKeys.list(),
		queryFn: () => api.get<Member[]>("/members"),
	});
