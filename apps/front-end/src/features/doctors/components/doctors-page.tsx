import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Search, Stethoscope } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
	EmptyState,
	InlineError,
	PageHeader,
	Spinner,
} from "@/components/ui/page";
import { Pagination } from "@/components/ui/pagination";
import { SortableTh } from "@/components/ui/sortable-th";
import {
	Table,
	TableBody,
	TableHead,
	TableRow,
	Td,
} from "@/components/ui/table";
import { useSort } from "@/hooks/use-sort";
import { api } from "@/lib/api";
import type { Doctor, Paginated } from "@/lib/types";

const LIMIT = 10;

export function DoctorsPage() {
	const navigate = useNavigate();
	const { search: urlSearch = "" } = useSearch({
		from: "/_authenticated/doctors",
	});
	const [page, setPage] = useState(1);
	const [searchInput, setSearchInput] = useState(urlSearch);

	useEffect(() => {
		// oxlint-disable-next-line react/set-state-in-effect
		setSearchInput(urlSearch);
		// oxlint-disable-next-line react/set-state-in-effect
		setPage(1);
	}, [urlSearch]);

	const applySearch = (term: string) => {
		navigate({
			to: "/doctors",
			search: { search: term || undefined },
			replace: true,
		});
	};

	const { data, isLoading, error } = useQuery({
		queryKey: ["doctors", page, urlSearch],
		queryFn: () =>
			api.get<Paginated<Doctor>>("/doctors", {
				page,
				pageSize: LIMIT,
				search: urlSearch || undefined,
			}),
	});

	const doctors = data?.items ?? [];
	const totalPages = data ? Math.ceil(data.total / data.pageSize) : 1;

	const { sorted, key, dir, toggle } = useSort(doctors, "userName");

	return (
		<div className="space-y-5">
			<PageHeader
				title="Doctors"
				subtitle="Practitioners on the medical staff"
			/>

			<Card>
				<div className="border-b border-slate-200 px-4 py-3">
					<div className="relative w-full max-w-sm">
						<Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
						<input
							value={searchInput}
							onChange={(e) => setSearchInput(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									applySearch(searchInput.trim());
								}
							}}
							placeholder="Search by name, specialization or department…"
							className="w-full rounded-lg border border-slate-300 bg-white py-2 pr-3 pl-9 text-sm placeholder:text-slate-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
						/>
					</div>
				</div>

				{isLoading ? <Spinner /> : null}
				{error ? (
					<InlineError
						message={
							error instanceof Error ? error.message : "Failed to load doctors"
						}
					/>
				) : null}

				{!isLoading && !error && doctors.length === 0 ? (
					<EmptyState
						title="No doctors found"
						description="Doctor profiles are created when staff accounts are provisioned."
						icon={<Stethoscope className="size-5" />}
					/>
				) : null}

				{!isLoading && !error && doctors.length > 0 ? (
					<>
						<Table>
							<TableHead>
								<SortableTh
									field="userName"
									sortKey={key}
									sortDir={dir}
									onSort={toggle}
								>
									Doctor
								</SortableTh>
								<SortableTh
									field="specialization"
									sortKey={key}
									sortDir={dir}
									onSort={toggle}
								>
									Specialization
								</SortableTh>
								<SortableTh
									field="licenseNumber"
									sortKey={key}
									sortDir={dir}
									onSort={toggle}
								>
									License
								</SortableTh>
								<SortableTh
									field="isAvailable"
									sortKey={key}
									sortDir={dir}
									onSort={toggle}
								>
									Status
								</SortableTh>
							</TableHead>
							<TableBody>
								{sorted.map((doctor) => (
									<TableRow key={doctor.id}>
										<Td>
											<p className="font-medium text-slate-900">
												{doctor.userName}
											</p>
											<p className="text-xs text-slate-500">
												{doctor.userEmail}
											</p>
										</Td>
										<Td className="text-slate-600">
											{doctor.specialization ?? "—"}
										</Td>
										<Td className="text-slate-600">
											{doctor.licenseNumber ?? "—"}
										</Td>
										<Td>
											{doctor.isAvailable ? (
												<Badge tone="success">Active</Badge>
											) : (
												<Badge tone="neutral">Inactive</Badge>
											)}
										</Td>
									</TableRow>
								))}
							</TableBody>
						</Table>
						<Pagination
							page={page}
							totalPages={totalPages}
							onPageChange={setPage}
						/>
					</>
				) : null}
			</Card>
		</div>
	);
}
