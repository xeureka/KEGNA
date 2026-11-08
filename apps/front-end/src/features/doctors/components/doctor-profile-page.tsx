import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { InlineError, PageHeader, Spinner } from "@/components/ui/page";
import { api } from "@/lib/api";
import { hasPermission } from "@/lib/auth";
import { type Doctor } from "@/lib/types";

const profileSchema = z.object({
	specialization: z
		.string()
		.trim()
		.min(1, "Specialization is required")
		.max(150),
	bio: z.string().trim().max(500).optional(),
	licenseNumber: z.string().trim().max(100).optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export function DoctorProfilePage() {
	const queryClient = useQueryClient();
	const canEdit = hasPermission("doctors.update");

	const {
		data: profile,
		isLoading,
		error,
	} = useQuery({
		queryKey: ["doctor", "me"],
		queryFn: () => api.get<Doctor>("/doctors/me/profile"),
	});

	const {
		register,
		handleSubmit,
		reset,
		formState: { errors },
	} = useForm<ProfileFormValues>({ resolver: zodResolver(profileSchema) });

	useEffect(() => {
		if (profile) {
			reset({
				specialization: profile.specialization ?? "",
				bio: profile.bio ?? "",
				licenseNumber: profile.licenseNumber ?? "",
			});
		}
	}, [profile, reset]);

	const saveMutation = useMutation({
		mutationFn: (values: ProfileFormValues) => {
			if (!profile) throw new Error("Missing profile");
			return api.patch<Doctor>(`/doctors/${profile.id}`, {
				specialization: values.specialization || null,
				bio: values.bio || null,
				licenseNumber: values.licenseNumber || undefined,
			});
		},
		onSuccess: () => {
			toast.success("Profile updated");
			queryClient.invalidateQueries({ queryKey: ["doctor", "me"] });
		},
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : "Update failed"),
	});

	return (
		<div className="space-y-5">
			<PageHeader title="My Profile" subtitle="Your professional details" />

			{isLoading ? <Spinner /> : null}
			{error ? (
				<InlineError
					message={
						error instanceof Error ? error.message : "Failed to load profile"
					}
				/>
			) : null}

			{profile ? (
				<div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
					<Card>
						<CardHeader title="Account" subtitle="Sign-in details" />
						<CardContent>
							<dl className="divide-y divide-slate-200">
								<div className="flex items-center justify-between py-2.5">
									<dt className="text-sm text-slate-500">Name</dt>
									<dd className="text-sm font-medium text-slate-900">
										{profile.userName}
									</dd>
								</div>
								<div className="flex items-center justify-between py-2.5">
									<dt className="text-sm text-slate-500">Email</dt>
									<dd className="text-sm font-medium text-slate-900">
										{profile.userEmail}
									</dd>
								</div>
								<div className="flex items-center justify-between py-2.5">
									<dt className="text-sm text-slate-500">Status</dt>
									<dd className="text-sm font-medium text-emerald-700">
										{profile.isAvailable ? "Active" : "Inactive"}
									</dd>
								</div>
							</dl>
						</CardContent>
					</Card>

					<Card className="lg:col-span-2">
						<CardHeader
							title="Professional details"
							subtitle={
								canEdit
									? "Shown to staff when scheduling visits"
									: "Only the clinic owner can change these details"
							}
						/>
						<CardContent>
							<form
								onSubmit={handleSubmit((v) => saveMutation.mutate(v))}
								className="grid grid-cols-1 gap-4 sm:grid-cols-2"
							>
								<Field
									label="Specialization"
									error={errors.specialization?.message}
								>
									<Input readOnly={!canEdit} {...register("specialization")} />
								</Field>
								<Field
									label="License number"
									error={errors.licenseNumber?.message}
								>
									<Input readOnly={!canEdit} {...register("licenseNumber")} />
								</Field>
								<Field
									label="Bio"
									error={errors.bio?.message}
									className="sm:col-span-2"
								>
									<Input readOnly={!canEdit} {...register("bio")} />
								</Field>
								{canEdit ? (
									<div className="flex justify-end pt-2 sm:col-span-2">
										<Button type="submit" loading={saveMutation.isPending}>
											Save changes
										</Button>
									</div>
								) : null}
							</form>
						</CardContent>
					</Card>
				</div>
			) : null}
		</div>
	);
}
