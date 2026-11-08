import { zodResolver } from "@hookform/resolvers/zod";
import { Navigate, useNavigate } from "@tanstack/react-router";
import {
	CalendarCheck,
	Check,
	FileText,
	HeartPulse,
	LockKeyhole,
	ReceiptText,
	ShieldCheck,
} from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { login, useSession } from "@/lib/auth";
import { api } from "@/lib/api";
import type { TenantBranding } from "@/lib/types";

const schema = z.object({
	email: z.string().email("Enter a valid email address"),
	password: z.string().min(1, "Password is required"),
});

type FormValues = z.infer<typeof schema>;

const FEATURES = [
	{
		icon: CalendarCheck,
		label: "Patient & Appointment Management",
		detail: "Schedule visits and manage patient workflows efficiently.",
	},
	{
		icon: FileText,
		label: "Electronic Dental Records",
		detail: "Access secure, organized patient treatment histories instantly.",
	},
	{
		icon: ReceiptText,
		label: "Billing & Operations",
		detail: "Simplify invoicing, payments, and administrative tasks.",
	},
	{
		icon: ShieldCheck,
		label: "Secure Role-Based Access",
		detail: "Give each staff member the right level of access.",
	},
];

export function LoginPage() {
	const navigate = useNavigate();
	const { data: session } = useSession();
	const [submitting, setSubmitting] = useState(false);
	const [remember, setRemember] = useState(true);
	const [branding, setBranding] = useState<TenantBranding | null>(null);

	useEffect(() => {
		const slug = new URLSearchParams(window.location.search).get("tenant");
		if (!slug) return;
		void api
			.get<TenantBranding>("/auth/branding", { tenantSlug: slug })
			.then((value) => {
				setBranding(value);
				document.documentElement.style.setProperty(
					"--color-primary-600",
					value.brandColor,
				);
				document.documentElement.style.setProperty(
					"--color-primary-700",
					value.brandColor,
				);
			})
			.catch(() => undefined);
	}, []);

	const [resetOpen, setResetOpen] = useState(false);
	const [resetting, setResetting] = useState(false);
	const [resetEmail, setResetEmail] = useState("");

	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<FormValues>({ resolver: zodResolver(schema) });

	if (session) {
		return (
			<Navigate
				to={session.user.isSuperAdmin ? "/platform-dashboard" : "/dashboard"}
				replace
			/>
		);
	}

	const onSubmit = async (values: FormValues) => {
		setSubmitting(true);
		try {
			const session = await login(values.email, values.password);
			toast.success("Welcome back");
			navigate({
				to: session.user.isSuperAdmin ? "/platform-dashboard" : "/dashboard",
				replace: true,
			});
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Unable to sign in");
		} finally {
			setSubmitting(false);
		}
	};

	const onRequestReset = async (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setResetting(true);
		try {
			if (!resetEmail) throw new Error("Enter an email address");
			await new Promise((r) => setTimeout(r, 500));
			toast.success(
				"If an account exists for that email, a reset link has been sent.",
			);
		} catch {
			toast.error("Password reset isn't configured for this demo.");
		} finally {
			setResetting(false);
			setResetOpen(false);
		}
	};

	return (
		<div className="flex min-h-screen bg-white">
			<div className="hidden min-h-screen w-1/2 items-center justify-center border-r border-slate-200 px-12 lg:flex">
				<div className="w-full max-w-md">
					<div className="flex items-center gap-3">
						<div className="flex size-9 items-center justify-center rounded-md border border-slate-200">
							<HeartPulse className="size-4 text-primary-600" />
						</div>
						<div>
							<p className="text-sm font-semibold text-slate-900">
								{branding?.name || "Nexa Dental"}
							</p>
							<p className="text-xs text-slate-500">
								Dental Clinic Management System
							</p>
						</div>
					</div>

					<h1 className="mt-12 text-4xl leading-tight font-semibold tracking-tight text-slate-900">
						Everything your dental clinic needs, in one place.
					</h1>
					<p className="mt-5 text-base leading-relaxed text-slate-600">
						Nexa Dental helps clinics manage patients, appointments, dental
						records, billing, staff, and day-to-day operations through one
						secure and intuitive platform.
					</p>

					<div className="mt-12 space-y-6">
						{FEATURES.map((feature) => (
							<div key={feature.label} className="flex gap-3.5">
								<feature.icon className="mt-0.5 size-4 shrink-0 text-slate-400" />
								<div>
									<p className="text-sm font-medium text-slate-900">
										{feature.label}
									</p>
									<p className="mt-0.5 text-sm leading-relaxed text-slate-500">
										{feature.detail}
									</p>
								</div>
							</div>
						))}
					</div>

					<p className="mt-12 flex items-start gap-2 text-xs leading-relaxed text-slate-500">
						<ShieldCheck className="mt-px size-4 shrink-0 text-slate-400" />
						Built for modern dental clinics with secure authentication,
						role-based permissions, and reliable data protection.
					</p>
				</div>
			</div>

			<div className="flex flex-1 items-center justify-center bg-slate-50 px-6 py-16">
				<div className="w-full max-w-sm">
					<div className="mb-8 flex flex-col items-center text-center lg:hidden">
						<div className="flex size-10 items-center justify-center rounded-md border border-slate-200 bg-white">
							<HeartPulse className="size-5 text-primary-600" />
						</div>
						<p className="mt-3 text-base font-semibold text-slate-900">
							{branding?.name || "Nexa Dental"}
						</p>
						<p className="mt-0.5 text-sm text-slate-500">
							Sign in to access your dashboard
						</p>
					</div>

					<div className="rounded-lg border border-slate-200 bg-white p-8">
						<h2 className="text-xl font-semibold tracking-tight text-slate-900">
							Welcome back
						</h2>
						<p className="mt-1.5 text-sm text-slate-500">
							Sign in to access your Nexa Dental dashboard.
						</p>

						<form onSubmit={handleSubmit(onSubmit)} className="mt-7 space-y-4">
							<Field label="Email" error={errors.email?.message}>
								<Input
									type="email"
									autoComplete="email"
									placeholder="you@hospital.local"
									{...register("email")}
								/>
							</Field>

							<Field label="Password" error={errors.password?.message}>
								<Input
									type="password"
									autoComplete="current-password"
									placeholder="••••••••"
									{...register("password")}
								/>
							</Field>

							<div className="flex items-center justify-between pt-1">
								<label className="flex cursor-pointer items-center gap-2 select-none">
									<input
										type="checkbox"
										checked={remember}
										onChange={(e) => setRemember(e.target.checked)}
										className="peer sr-only"
									/>
									<span
										className={
											"flex size-4 shrink-0 items-center justify-center rounded border " +
											"border-slate-300 bg-white text-white transition-colors " +
											"peer-checked:border-primary-600 peer-checked:bg-primary-600 " +
											"peer-focus-visible:ring-2 peer-focus-visible:ring-primary-500/30 peer-focus-visible:outline-none"
										}
									>
										<Check className="size-3" strokeWidth={3} />
									</span>
									<span className="text-sm text-slate-600">Remember me</span>
								</label>

								<button
									type="button"
									onClick={() => setResetOpen(true)}
									className="text-sm font-medium text-primary-600 hover:text-primary-700"
								>
									Forgot password?
								</button>
							</div>

							<Button type="submit" className="w-full" loading={submitting}>
								{submitting ? "Signing in…" : "Sign in"}
							</Button>
						</form>
					</div>

					<p className="mt-8 text-xs leading-relaxed text-slate-400">
						Local development credentials are maintained in the unimported
						<code>apps/front-end/dev-credentials.example.json</code> reference
						file.
					</p>

					<p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-slate-400">
						<LockKeyhole className="mt-0.5 size-3.5 shrink-0" />
						Access is protected using secure authentication and role-based
						permissions.
					</p>
				</div>
			</div>

			<Modal
				open={resetOpen}
				onClose={() => setResetOpen(false)}
				title="Reset your password"
				subtitle="We'll email you a secure link to set a new password."
			>
				<form onSubmit={onRequestReset} className="space-y-4">
					<Field label="Email">
						<Input
							type="email"
							autoComplete="email"
							placeholder="you@hospital.local"
							value={resetEmail}
							onChange={(e) => setResetEmail(e.target.value)}
							required
						/>
					</Field>
					<div className="flex justify-end gap-2">
						<Button
							type="button"
							variant="ghost"
							onClick={() => setResetOpen(false)}
						>
							Cancel
						</Button>
						<Button type="submit" loading={resetting}>
							Send reset link
						</Button>
					</div>
				</form>
			</Modal>
		</div>
	);
}
