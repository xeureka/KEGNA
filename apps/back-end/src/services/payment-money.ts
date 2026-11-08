const MAX_NUMERIC_12_2_CENTS = 999_999_999_999;

export function parseEtbCents(value: string): number {
	const normalized = value.trim();
	const match = /^(\d{1,10})(?:\.(\d{1,2}))?$/.exec(normalized);
	if (!match)
		throw new Error(
			"Amount must be a non-negative ETB decimal with at most two decimals",
		);
	const cents =
		Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
	if (!Number.isSafeInteger(cents) || cents > MAX_NUMERIC_12_2_CENTS) {
		throw new Error("Amount exceeds the supported ETB payment limit");
	}
	return cents;
}

export function formatEtbCents(cents: number): string {
	if (
		!Number.isSafeInteger(cents) ||
		cents < 0 ||
		cents > MAX_NUMERIC_12_2_CENTS
	) {
		throw new Error("Amount is outside the supported ETB range");
	}
	return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

export function addEtb(...amounts: string[]): string {
	return formatEtbCents(
		amounts.reduce((total, amount) => total + parseEtbCents(amount), 0),
	);
}

export function calculateChapaAmounts(
	baseAmount: string,
	serviceCharge: string,
) {
	const baseCents = parseEtbCents(baseAmount);
	const chargeCents = parseEtbCents(serviceCharge);
	const totalCents = baseCents + chargeCents;
	return {
		baseAmount: formatEtbCents(baseCents),
		serviceCharge: formatEtbCents(chargeCents),
		totalAmount: formatEtbCents(totalCents),
		clinicShare: formatEtbCents(baseCents),
		platformShare: formatEtbCents(chargeCents),
	};
}

export function allocateEtbPayment(
	amount: string,
	bills: Array<{ billId: string; remaining: string }>,
) {
	let left = parseEtbCents(amount);
	const allocations: Array<{ billId: string; amount: string }> = [];
	for (const bill of bills) {
		if (left === 0) break;
		const remaining = parseEtbCents(bill.remaining);
		const applied = Math.min(left, remaining);
		if (applied > 0) {
			allocations.push({
				billId: bill.billId,
				amount: formatEtbCents(applied),
			});
			left -= applied;
		}
	}
	if (left > 0)
		throw new Error("Payment amount exceeds the outstanding balance");
	return allocations;
}

export function summarizeEtbBalance(
	bills: Array<{ total: string; paid: string }>,
) {
	const totalChargedCents = bills.reduce(
		(total, bill) => total + parseEtbCents(bill.total),
		0,
	);
	const totalPaidCents = bills.reduce(
		(total, bill) => total + parseEtbCents(bill.paid),
		0,
	);
	return {
		totalCharged: formatEtbCents(totalChargedCents),
		totalPaid: formatEtbCents(totalPaidCents),
		remaining: formatEtbCents(Math.max(0, totalChargedCents - totalPaidCents)),
	};
}
