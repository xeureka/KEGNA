import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { api } from "../../lib/api.ts";
import { hasPermission } from "../../lib/auth.ts";
import type { Appointment, Paginated, Patient } from "../../lib/types.ts";

export function GlobalSearch() {
	const navigate = useNavigate();
	const [query, setQuery] = useState("");
	const [open, setOpen] = useState(false);
	const boxRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const onMouseDown = (e: MouseEvent) => {
			if (boxRef.current && !boxRef.current.contains(e.target as Node))
				setOpen(false);
		};
		document.addEventListener("mousedown", onMouseDown);
		return () => document.removeEventListener("mousedown", onMouseDown);
	}, []);

	const canReadPatients = hasPermission("patients.read");
	const canReadAppointments = hasPermission("appointments.read");

	const { data: patientsData } = useQuery({
		queryKey: ["global-search", "patients", query],
		queryFn: () =>
			api.get<Paginated<Patient>>("/patients", {
				page: 1,
				pageSize: 6,
				search: query.trim(),
			}),
		enabled: canReadPatients && query.trim().length > 0,
	});

	const { data: appointmentsData } = useQuery({
		queryKey: ["global-search", "appointments"],
		queryFn: () =>
			api.get<Paginated<Appointment>>("/appointments", {
				page: 1,
				pageSize: 6,
			}),
		enabled: canReadAppointments && query.trim().length > 0,
	});

	const patients = patientsData?.items ?? [];
	const appointments = appointmentsData?.items ?? [];
	const hasResults = patients.length + appointments.length > 0;

	const goPatient = (term: string) => {
		setQuery("");
		setOpen(false);
		navigate({ to: "/patients", search: { search: term } });
	};

	const goAppointment = () => {
		setQuery("");
		setOpen(false);
		navigate({ to: "/appointments" });
	};

	return (
		<div ref={boxRef} className="relative w-full">
			<div className="relative">
				<Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
				<input
					value={query}
					onChange={(e) => {
						setQuery(e.target.value);
						setOpen(true);
					}}
					onFocus={() => setOpen(true)}
					onKeyDown={(e) => {
						if (e.key === "Escape") setOpen(false);
					}}
					placeholder="Search patients or appointments…"
					className="w-full rounded-lg border border-slate-300 bg-white py-2 pr-3 pl-9 text-sm placeholder:text-slate-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
				/>
			</div>

			{open && query.trim().length > 0 ? (
				<div className="absolute top-full right-0 left-0 z-50 mt-1.5 overflow-hidden rounded-lg border border-slate-300 bg-white">
					{!hasResults ? (
						<div className="px-4 py-3 text-sm text-slate-500">
							No matches found.
						</div>
					) : (
						<div className="max-h-80 overflow-y-auto">
							{patients.length > 0 ? (
								<>
									<p className="bg-slate-50 px-4 py-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
										Patients
									</p>
									{patients.map((p) => (
										<button
											key={p.id}
											type="button"
											onClick={() => goPatient(query.trim())}
											className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm transition-colors hover:bg-slate-100"
										>
											<span className="font-medium text-slate-800">
												{p.firstName} {p.lastName}
											</span>
											<span className="text-xs text-slate-400">{p.phone}</span>
										</button>
									))}
								</>
							) : null}
							{appointments.length > 0 ? (
								<>
									<p className="bg-slate-50 px-4 py-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
										Recent Appointments
									</p>
									{appointments.map((a) => (
										<button
											key={a.id}
											type="button"
											onClick={goAppointment}
											className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm transition-colors hover:bg-slate-100"
										>
											<span className="font-medium text-slate-800">
												{a.patientName}
											</span>
											<span className="text-xs text-slate-400">
												{a.doctorName}
											</span>
										</button>
									))}
								</>
							) : null}
						</div>
					)}
				</div>
			) : null}
		</div>
	);
}
