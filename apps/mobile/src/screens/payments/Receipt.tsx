import React from "react";
import { PaymentPage } from "./PaymentPage";
import type { Screen } from "../../types";

export function Receipt({ go }: { go: (screen: Screen) => void }) {
	return <PaymentPage variant="receipt" go={go} />;
}

export { PaymentPage };
export default Receipt;
