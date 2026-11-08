import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
	Activity,
	BarChart3,
	CalendarDays,
	FileText,
	HeartPulse,
	LogOut,
	Menu,
	Receipt,
	ScrollText,
	Stethoscope,
	UserCog,
	Users,
	Building2,
	Lightbulb,
	CreditCard,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { logout, useSession } from "../../lib/auth.ts";
import type { RoleName } from "../../lib/types.ts";
import { initials } from "../../lib/utils.ts";
import { GlobalSearch } from "./global-search.tsx";
import { api } from "@/lib/api";
import type { TenantBranding } from "@/lib/types";

interface NavItem {
	to: string;
	label: string;
	icon: LucideIcon;
}

const ALL_NAV: NavItem[] = [
	{ to: "/dashboard", label: "Dashboard", icon: Activity },
	{ to: "/patients", label: "Patients", icon: Users },
	{ to: "/doctors", label: "Doctors", icon: Stethoscope },
	{ to: "/appointments", label: "Appointments", icon: CalendarDays },
	{ to: "/medical-records", label: "Medical Records", icon: FileText },
	{ to: "/bills", label: "Bills", icon: Receipt },
	{ to: "/payments", label: "Payments", icon: CreditCard },
	{ to: "/reports", label: "Reports", icon: BarChart3 },
	{ to: "/users", label: "Users", icon: UserCog },
	{ to: "/audit-logs", label: "Audit Logs", icon: ScrollText },
	{ to: "/tips", label: "Tips", icon: Lightbulb },
];

const ADMIN_NAV: NavItem[] = [...ALL_NAV];

const DOCTOR_NAV: NavItem[] = [
	{ to: "/dashboard", label: "Dashboard", icon: Activity },
	{ to: "/appointments", label: "Appointments", icon: CalendarDays },
	{ to: "/calendar", label: "My Calendar", icon: CalendarDays },
	{ to: "/medical-records", label: "Medical Records", icon: FileText },
	{ to: "/doctor-profile", label: "My Profile", icon: Stethoscope },
];

const RECEPTIONIST_NAV: NavItem[] = [
	{ to: "/dashboard", label: "Dashboard", icon: Activity },
	{ to: "/patients", label: "Patients", icon: Users },
	{ to: "/doctors", label: "Doctors", icon: Stethoscope },
	{ to: "/appointments", label: "Appointments", icon: CalendarDays },
	{ to: "/bills", label: "Bills", icon: Receipt },
	{ to: "/payments", label: "Payments", icon: CreditCard },
	{ to: "/reports", label: "Reports", icon: BarChart3 },
];

const ACCOUNTANT_NAV: NavItem[] = [
	...RECEPTIONIST_NAV,
	{ to: "/reports", label: "Reports", icon: BarChart3 },
];

const SUPER_ADMIN_NAV: NavItem[] = [
	{ to: "/platform-dashboard", label: "Platform Dashboard", icon: Activity },
	{ to: "/platform-users", label: "Platform Users", icon: Users },
	{ to: "/tenant-onboarding", label: "Tenant Onboarding", icon: Building2 },
];

function navFor(role: string): NavItem[] {
	switch (role) {
		case "OWNER":
			return ALL_NAV;
		case "ADMIN":
			return ADMIN_NAV;
		case "DOCTOR":
			return DOCTOR_NAV;
		case "RECEPTIONIST":
			return RECEPTIONIST_NAV;
		case "ACCOUNTANT":
			return ACCOUNTANT_NAV;
		default:
			return RECEPTIONIST_NAV;
	}
}

function roleLabel(role: string): string {
	switch (role) {
		case "OWNER":
			return "Owner";
		case "DOCTOR":
			return "Doctor";
		case "RECEPTIONIST":
			return "Receptionist";
		case "ACCOUNTANT":
			return "Accountant";
		default:
			return role;
	}
}

export function AppShell() {
	const navigate = useNavigate();
	const { data: session } = useSession();
	const [menuOpen, setMenuOpen] = useState(false);
	const [branding, setBranding] = useState<TenantBranding | null>(null);

	const user = session?.user;

	useEffect(() => {
		const slug = session?.tenant?.slug;
		if (!slug) return;
		void api
			.get<TenantBranding>("/auth/branding", { tenantSlug: slug })
			.then((value) => {
				setBranding(value);
				for (const [level, percentage] of [
					["50", 8],
					["100", 14],
					["200", 24],
					["500", 78],
					["600", 88],
					["700", 100],
					["800", 92],
					["900", 84],
				] as const) {
					document.documentElement.style.setProperty(
						`--color-primary-${level}`,
						`color-mix(in srgb, ${value.brandColor} ${percentage}%, ${percentage > 50 ? "black" : "white"})`,
					);
				}
				let favicon = document.querySelector<HTMLLinkElement>(
					"link[data-nexa-tenant-favicon]",
				);
				if (!favicon) {
					favicon = document.createElement("link");
					favicon.rel = "icon";
					favicon.setAttribute("data-nexa-tenant-favicon", "true");
					document.head.appendChild(favicon);
				}
				favicon.href =
					value.logoUrl ||
					`data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='${encodeURIComponent(value.brandColor)}'/></svg>`;
			})
			.catch(() => undefined);
	}, [session?.tenant?.slug]);

	if (!user) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
				<div className="max-w-sm rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
					<h1 className="text-base font-semibold text-slate-900">
						Session unavailable
					</h1>
					<p className="mt-2 text-sm text-slate-500">
						Your session could not be restored. Sign in again to continue.
					</p>
					<Link
						to="/login"
						className="mt-4 inline-flex rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
					>
						Go to sign in
					</Link>
				</div>
			</div>
		);
	}

	const role: RoleName = (session?.role?.name as RoleName) || "RECEPTIONIST";

	const nav = user.isSuperAdmin ? SUPER_ADMIN_NAV : navFor(role);

	const handleSignOut = async () => {
		await logout();
		toast.success("Signed out");
		navigate({ to: "/login", replace: true });
	};

	const sidebar = (
		<aside className="flex h-full w-60 flex-col border-r border-slate-200 bg-white">
			<div className="flex items-center gap-2.5 border-b border-slate-200 px-5 py-4">
				{branding?.logoUrl ? (
					<img
						src={branding.logoUrl}
						alt=""
						className="size-6 shrink-0 rounded object-contain"
					/>
				) : (
					<HeartPulse className="size-5 shrink-0 text-primary-600" />
				)}
				<div>
					<p className="text-sm leading-tight font-semibold text-slate-900">
						{branding?.name || session?.tenant?.name || "Nexa Dental"}
					</p>
					<p className="text-xs leading-tight text-slate-500">
						Dental Clinic Management
					</p>
				</div>
			</div>

			<nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
				{nav.map((item) => (
					<Link
						key={item.to}
						to={item.to}
						activeOptions={{ exact: true }}
						activeProps={{
							className: "bg-primary-50 text-primary-700 font-semibold",
						}}
						className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
						onClick={() => setMenuOpen(false)}
					>
						<item.icon className="size-4 shrink-0" />
						{item.label}
					</Link>
				))}
			</nav>

			<div className="border-t border-slate-200 px-3 py-3">
				<div className="flex items-center gap-3 rounded-lg px-2 py-1.5">
					<div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-xs font-semibold text-slate-600">
						{initials(user.name)}
					</div>
					<div className="min-w-0 flex-1">
						<p className="truncate text-sm font-medium text-slate-900">
							{user.name}
						</p>
						<p className="truncate text-xs text-slate-500">{roleLabel(role)}</p>
					</div>
					<button
						type="button"
						onClick={handleSignOut}
						className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-rose-600"
						title="Sign out"
						aria-label="Sign out"
					>
						<LogOut className="size-4" />
					</button>
				</div>
			</div>
		</aside>
	);

	return (
		<div className="min-h-screen bg-slate-50">
			<div className="fixed inset-y-0 left-0 z-30 hidden lg:block">
				{sidebar}
			</div>

			{menuOpen ? (
				<div className="fixed inset-0 z-40 lg:hidden">
					<div
						className="absolute inset-0 bg-slate-900/40"
						onClick={() => setMenuOpen(false)}
						aria-hidden
					/>
					<div className="absolute inset-y-0 left-0">
						<div className="relative h-full">
							<button
								type="button"
								onClick={() => setMenuOpen(false)}
								aria-label="Close menu"
								className="absolute top-4 -right-12 rounded-lg border border-white/20 p-2 text-white"
							>
								✕
							</button>
							{sidebar}
						</div>
					</div>
				</div>
			) : null}

			<header className="fixed inset-x-0 top-0 z-20 flex h-14 items-center gap-2 border-b border-slate-200 bg-white px-3 sm:px-4 lg:left-60">
				<button
					type="button"
					onClick={() => setMenuOpen(true)}
					className="rounded-lg border border-slate-300 p-2 text-slate-600 transition-colors hover:bg-slate-50 lg:hidden"
					aria-label="Open menu"
				>
					<Menu className="size-4" />
				</button>
				<Link
					to={user.isSuperAdmin ? "/platform-dashboard" : "/dashboard"}
					className="flex items-center gap-2 lg:hidden"
				>
					<HeartPulse className="size-4 text-primary-600" />
					<span className="text-sm font-semibold text-slate-900">
						Nexa Dental
					</span>
				</Link>
				<div className="mx-auto w-full max-w-md flex-1">
					<GlobalSearch />
				</div>
			</header>

			<main className="mt-14 lg:ml-60">
				<div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
					<Outlet />
				</div>
			</main>
		</div>
	);
}
