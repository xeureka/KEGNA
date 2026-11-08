import { verifyPaymentSchema } from "./payment-migration";

/** `pnpm --filter back-end db:verify:payments` */
async function main() {
	const problems = await verifyPaymentSchema();
	if (problems.length === 0) {
		console.log("✅ Payment schema matches the code");
		return;
	}
	console.error(`❌ Payment schema drifts in ${problems.length} place(s):`);
	for (const problem of problems) {
		console.error(
			` - ${problem.object}: ${problem.problem}\n     fix: ${problem.fix}`,
		);
	}
	process.exitCode = 1;
}

main().catch((error) => {
	console.error("❌ Payment schema verification crashed", error);
	process.exitCode = 1;
});
