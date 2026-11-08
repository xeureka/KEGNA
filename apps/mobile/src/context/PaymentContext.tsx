import { createContext, useContext } from "react";

export const PaymentContext = createContext<{
	paymentVerified: boolean;
	setPaymentVerified: (verified: boolean) => void;
}>({
	paymentVerified: false,
	setPaymentVerified: () => undefined,
});

export const usePayment = () => useContext(PaymentContext);

export default PaymentContext;
