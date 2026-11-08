import {
	applyPaymentMigration,
	verifyPaymentSchema,
} from "./payment-migration";

/** `pnpm --filter back-end db:migrate:payments` */
async function main() {
	await applyPaymentMigration();
	console.log("✅ Chapa payment ledger migration applied");

	const problems = await verifyPaymentSchema();
	if (problems.length > 0) {
		console.error("\n⚠️  Payment schema still drifts from the code:");
		for (const problem of problems) {
			console.error(` - ${problem.object}: ${problem.problem}`);
		}
		process.exitCode = 1;
		return;
	}
	console.log("✅ Payment schema verified: no drift");
}

main().catch((error) => {
	console.error("❌ Chapa payment ledger migration failed", error);
	process.exitCode = 1;
});
