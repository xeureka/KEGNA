const baseUrl = process.env.CRM_API_URL ?? "http://127.0.0.1:3001";

async function check(path, expectedStatuses) {
	const response = await fetch(`${baseUrl}${path}`, {
		headers: { Origin: "http://localhost:5173" },
	});
	const body = await response.json().catch(() => null);
	if (!expectedStatuses.includes(response.status)) {
		throw new Error(
			`${path} returned ${response.status}: ${JSON.stringify(body)}`,
		);
	}
	console.log(`${path}: ${response.status} OK`);
}

try {
	await check("/api/v1/hello", [200]);
	await check("/api/v1/auth/me", [401]);
	console.log(
		"CRM API auth health check passed. Logged-out /auth/me correctly returns 401.",
	);
} catch (error) {
	console.error(
		`CRM API health check failed: ${error instanceof Error ? error.message : error}`,
	);
	process.exitCode = 1;
}
