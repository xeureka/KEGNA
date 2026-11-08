import { zodResolver } from "@hookform/resolvers/zod";
import { Navigate, useNavigate } from "@tanstack/react-router";
import {
	Boxes,
	ClipboardList,
	Landmark,
	LockKeyhole,
	Eye,
	EyeOff,
	Package,
	ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { login, useSession } from "@/lib/auth";

const schema = z.object({
	email: z.string().email("Enter a valid email address"),
	password: z.string().min(1, "Password is required"),
});

type FormValues = z.infer<typeof schema>;

const FEATURES = [
	{
		icon: Boxes,
		label: "Live warehouse balances",
		detail: "See what is in the warehouse and what is held by salespeople.",
	},
	{
		icon: ClipboardList,
		label: "Load-outs and returns",
		detail: "Issue racks, confirm returns and record damages in one flow.",
	},
	{
		icon: Landmark,
		label: "Cash reconciliation",
		detail: "Match reported sales against bank deposits and expected cash.",
	},
	{
		icon: ShieldCheck,
		label: "Role-based access",
		detail: "Administrators and storekeepers see only the tools they need.",
	},
];

export function LoginPage() {
	const navigate = useNavigate();
	const { data: session } = useSession();
	const [submitting, setSubmitting] = useState(false);
	const [showPassword, setShowPassword] = useState(false);

	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<FormValues>({ resolver: zodResolver(schema) });

	if (session) {
		return <Navigate to="/dashboard" replace />;
	}

	const onSubmit = async (values: FormValues) => {
		setSubmitting(true);
		try {
			await login(values.email, values.password);
			toast.success("Welcome back");
			navigate({ to: "/dashboard", replace: true });
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Unable to sign in");
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<div className="flex min-h-screen bg-white">
			<div className="hidden min-h-screen w-1/2 items-center justify-center border-r border-slate-200 px-12 lg:flex">
				<div className="w-full max-w-md">
					<div className="flex items-center gap-3">
						<div className="flex size-9 items-center justify-center rounded-md border border-slate-200">
							<Package className="size-4 text-primary-600" />
						</div>
						<div>
							<p className="text-sm font-semibold text-slate-900">ZOLA</p>
							<p className="text-xs text-slate-500">Warehouse Inventory</p>
						</div>
					</div>

					<h1 className="mt-12 text-4xl leading-tight font-semibold tracking-tight text-slate-900">
						Every rack accounted for, from delivery to deposit.
					</h1>
					<p className="mt-5 text-base leading-relaxed text-slate-600">
						ZOLA gives the warehouse team one place to receive stock, issue
						racks, confirm returns and reconcile sales reports against bank
						deposits.
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
						Secure authentication, role-based permissions and an append-only
						stock ledger.
					</p>
				</div>
			</div>

			<div className="flex flex-1 items-center justify-center bg-slate-50 px-6 py-16">
				<div className="w-full max-w-sm">
					<div className="mb-8 flex flex-col items-center text-center lg:hidden">
						<div className="flex size-10 items-center justify-center rounded-md border border-slate-200 bg-white">
							<Package className="size-5 text-primary-600" />
						</div>
						<p className="mt-3 text-base font-semibold text-slate-900">ZOLA</p>
						<p className="mt-0.5 text-sm text-slate-500">
							Sign in to the warehouse dashboard
						</p>
					</div>

					<div className="rounded-lg border border-slate-200 bg-white p-8">
						<h2 className="text-xl font-semibold tracking-tight text-slate-900">
							Welcome back
						</h2>
						<p className="mt-1.5 text-sm text-slate-500">
							Sign in with your administrator or storekeeper account.
						</p>

						<form onSubmit={handleSubmit(onSubmit)} className="mt-7 space-y-4">
							<Field label="Email" error={errors.email?.message}>
								<Input
									type="email"
									autoComplete="email"
									placeholder="you@zola.local"
									{...register("email")}
								/>
							</Field>

							<Field label="Password" error={errors.password?.message}>
								<div className="relative">
									<Input type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="••••••••" className="pr-10" {...register("password")} />
									<button type="button" className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
								</div>
							</Field>

							<Button type="submit" className="w-full" loading={submitting}>
								{submitting ? "Signing in…" : "Sign in"}
							</Button>
						</form>
					</div>

					<p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-slate-400">
						<LockKeyhole className="mt-0.5 size-3.5 shrink-0" />
						Sales and accountants use the ZOLA mobile app. Contact an
						administrator if you need a password reset.
					</p>
				</div>
			</div>
		</div>
	);
}
