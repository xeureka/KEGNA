import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
	Activity,
	ArrowDownToLine,
	BookOpen,
	ClipboardList,
	LogOut,
	Menu,
	Package,
	PackagePlus,
	Settings2,
	Smartphone,
	Users,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { isWebRole, logout, useSession } from "@/lib/auth";
import type { RoleName } from "@/lib/types";
import { initials, titleCase } from "@/lib/utils";

interface NavItem {
	to: string;
	label: string;
	icon: LucideIcon;
}

const ADMIN_NAV: NavItem[] = [
	{ to: "/dashboard", label: "Overview", icon: Activity },
	{ to: "/products", label: "Products", icon: Package },
	{ to: "/users", label: "Users", icon: Users },
	{ to: "/issues", label: "Issues", icon: ClipboardList },
	{ to: "/stock/ledger", label: "Stock Ledger", icon: BookOpen },
];

const STOREKEEPER_NAV: NavItem[] = [
	{ to: "/dashboard", label: "Overview", icon: Activity },
	{ to: "/stock/receive", label: "Receive Stock", icon: ArrowDownToLine },
	{ to: "/issues/new", label: "Issue Load-out", icon: PackagePlus },
	{ to: "/issues", label: "Issues", icon: ClipboardList },
	{ to: "/stock/ledger", label: "Stock Ledger", icon: BookOpen },
	{ to: "/stock/adjust", label: "Adjustments", icon: Settings2 },
];

function navFor(role: RoleName): NavItem[] {
	return role === "admin" ? ADMIN_NAV : STOREKEEPER_NAV;
}

export function AppShell() {
	const navigate = useNavigate();
	const { data: session } = useSession();
	const [menuOpen, setMenuOpen] = useState(false);

	const user = session?.user;

	const handleSignOut = async () => {
		await logout();
		toast.success("Signed out");
		navigate({ to: "/login", replace: true });
	};

	if (!user || !session) {
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

	if (!isWebRole(session.role)) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
				<div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 text-center">
					<div className="mx-auto flex size-12 items-center justify-center rounded-full border border-slate-200 bg-slate-50">
						<Smartphone className="size-6 text-primary-600" />
					</div>
					<h1 className="mt-5 text-lg font-semibold text-slate-900">
						Use the ZOLA mobile app
					</h1>
					<p className="mt-2 text-sm leading-relaxed text-slate-500">
						The web dashboard is for administrators and storekeepers. Signed in
						as{" "}
						<span className="font-medium text-slate-700">
							{titleCase(session.role)}
						</span>
						, continue your work in the ZOLA mobile app.
					</p>
					<div className="mt-6 flex items-center justify-center gap-2">
						<Button variant="secondary" onClick={handleSignOut}>
							<LogOut className="size-4" /> Sign out
						</Button>
					</div>
					<p className="mt-5 text-xs text-slate-400">{user.email}</p>
				</div>
			</div>
		);
	}

	const nav = navFor(session.role);

	const sidebar = (
		<aside className="flex h-full w-60 flex-col border-r border-slate-200 bg-white">
			<div className="flex items-center gap-2.5 border-b border-slate-200 px-5 py-4">
				<div className="flex size-8 items-center justify-center rounded-md border border-slate-200 bg-slate-50">
					<Package className="size-4 text-primary-600" />
				</div>
				<div>
					<p className="text-sm leading-tight font-semibold text-slate-900">
						ZOLA
					</p>
					<p className="text-xs leading-tight text-slate-500">
						Warehouse Inventory
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
						<p className="truncate text-xs text-slate-500">
							{titleCase(session.role)}
						</p>
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
				<Link to="/dashboard" className="flex items-center gap-2 lg:hidden">
					<Package className="size-4 text-primary-600" />
					<span className="text-sm font-semibold text-slate-900">ZOLA</span>
				</Link>
				<p className="ml-auto hidden text-xs text-slate-400 sm:block">
					{user.name}
				</p>
			</header>

			<main className="mt-14 lg:ml-60">
				<div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
					<Outlet />
				</div>
			</main>
		</div>
	);
}
