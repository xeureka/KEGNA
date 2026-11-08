import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Field, Input } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page";
import { api } from "@/lib/api";
import type { TenantBranding } from "@/lib/types";

interface OnboardingResponse {
	tenant: TenantBranding & { id: string; status: string };
	tenantId: string;
	tenantLink: string;
	adminEmail: string;
	membershipId: string;
}

function slugify(value: string) {
	return value
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/(^-|-$)/g, "");
}

function fileAsDataUrl(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result));
		reader.onerror = () => reject(new Error("Unable to read logo"));
		reader.readAsDataURL(file);
	});
}

export function TenantOnboardingPage() {
	const [name, setName] = useState("");
	const [slug, setSlug] = useState("");
	const [brandColor, setBrandColor] = useState("#0f766e");
	const [adminName, setAdminName] = useState("");
	const [adminEmail, setAdminEmail] = useState("");
	const [adminPassword, setAdminPassword] = useState("");
	const [logo, setLogo] = useState<File | null>(null);
	const [result, setResult] = useState<OnboardingResponse | null>(null);
	const [submitting, setSubmitting] = useState(false);

	const submit = async (event: FormEvent) => {
		event.preventDefault();
		setSubmitting(true);
		try {
			const logoDataUrl = logo ? await fileAsDataUrl(logo) : undefined;
			const created = await api.post<OnboardingResponse>(
				"/super-admin/tenants",
				{
					name,
					slug: slug || slugify(name),
					brandColor,
					logoDataUrl,
					adminName,
					adminEmail,
					adminPassword,
				},
			);
			setResult(created);
			toast.success(`${created.tenant.name} was onboarded`);
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Unable to onboard tenant",
			);
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<div className="space-y-6">
			<PageHeader
				title="Tenant onboarding"
				subtitle="Create a clinic, apply its branding, and provision its first administrator."
			/>
			<Card>
				<CardHeader
					title="New clinic"
					subtitle="The administrator can sign in immediately after creation."
				/>
				<CardContent>
					<form
						onSubmit={submit}
						className="grid max-w-3xl gap-4 md:grid-cols-2"
					>
						<Field label="Clinic name">
							<Input
								required
								value={name}
								onChange={(e) => {
									setName(e.target.value);
									if (!slug) setSlug(slugify(e.target.value));
								}}
							/>
						</Field>
						<Field label="Slug" hint="Used in tenant branding URLs.">
							<Input
								required
								pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
								value={slug}
								onChange={(e) => setSlug(e.target.value)}
							/>
						</Field>
						<Field label="Default brand color">
							<Input
								required
								type="color"
								value={brandColor}
								onChange={(e) => setBrandColor(e.target.value)}
								className="h-10 p-1"
							/>
						</Field>
						<Field label="Logo">
							<Input
								type="file"
								accept="image/png,image/jpeg,image/svg+xml,image/webp"
								onChange={(e) => setLogo(e.target.files?.[0] ?? null)}
							/>
						</Field>
						<Field label="Initial admin name">
							<Input
								required
								value={adminName}
								onChange={(e) => setAdminName(e.target.value)}
							/>
						</Field>
						<Field label="Initial admin email">
							<Input
								required
								type="email"
								value={adminEmail}
								onChange={(e) => setAdminEmail(e.target.value)}
							/>
						</Field>
						<Field label="Initial admin password">
							<Input
								required
								minLength={8}
								type="password"
								value={adminPassword}
								onChange={(e) => setAdminPassword(e.target.value)}
							/>
						</Field>
						<div className="flex items-end">
							<Button type="submit" loading={submitting}>
								{submitting ? "Creating…" : "Create tenant"}
							</Button>
						</div>
					</form>
				</CardContent>
			</Card>
			{result ? (
				<Card>
					<CardHeader title="Tenant created" />
					<CardContent className="space-y-1 text-sm">
						<p>
							<strong>{result.tenant.name}</strong> ({result.tenant.slug})
						</p>
						<p>Admin: {result.adminEmail}</p>
						<div className="flex items-center gap-2">
							<p className="font-medium text-slate-700">Mobile tenant ID</p>
							<code className="text-xs">{result.tenantId}</code>
							<CopyButton value={result.tenantId} label="Mobile tenant ID" />
						</div>
						<div className="pt-2">
							<p className="font-medium text-slate-700">Tenant login URL</p>
							<div className="mt-1 flex items-center gap-2">
								<a
									href={result.tenantLink}
									target="_blank"
									rel="noreferrer"
									className="min-w-0 flex-1 truncate text-primary-600 underline"
								>
									{result.tenantLink}
								</a>
								<CopyButton
									value={result.tenantLink}
									label="Tenant login URL"
									className="shrink-0"
								/>
							</div>
						</div>
						<p className="text-slate-500">
							Branding is available at /api/v1/auth/branding?tenantSlug=
							{result.tenant.slug}
						</p>
					</CardContent>
				</Card>
			) : null}
		</div>
	);
}
