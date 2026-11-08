import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page";
import { api } from "@/lib/api";

export function TipsPage() {
	const [message, setMessage] = useState("");
	const mutation = useMutation({
		mutationFn: (value: string) => api.post("/tips", { message: value }),
		onSuccess: () => {
			setMessage("");
			toast.success("Tip sent to this tenant's users");
		},
		onError: (error) =>
			toast.error(
				error instanceof Error ? error.message : "Tip could not be sent",
			),
	});

	return (
		<div className="space-y-6">
			<PageHeader
				title="Tips"
				subtitle="Send a short dental-care announcement to this tenant's users."
			/>
			<Card className="max-w-2xl">
				<CardHeader title="New tip" />
				<CardContent className="space-y-3">
					<Textarea
						value={message}
						onChange={(event) => setMessage(event.target.value)}
						placeholder="Brush for two minutes twice daily..."
						maxLength={500}
					/>
					<div className="flex justify-end">
						<Button
							disabled={!message.trim() || mutation.isPending}
							onClick={() => mutation.mutate(message.trim())}
						>
							{mutation.isPending ? "Sending…" : "Send tip"}
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
