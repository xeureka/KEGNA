import type { Screen, RouteName } from "../types";

export type { Screen, RouteName };

export const routeNames: RouteName[] = [
	"splash",
	"welcome",
	"login",
	"register",
	"otp",
	"completeProfile",
	"terms",
	"dentalHistory",
	"doctorDetails",
	"home",
	"appointments",
	"card",
	"cardInactive",
	"services",
	"serviceDetails",
	"payments",
	"paymentCheckout",
	"paymentProcessing",
	"paymentSuccess",
	"paymentFailed",
	"receipt",
	"profile",
	"notifications",
	"support",
	"settings",
	"editProfile",
	"booking",
	"appointmentConfirmation",
];

export const authTabScreens: RouteName[] = [
	"home",
	"appointments",
	"card",
	"payments",
	"profile",
];

export const persistNavScreens: RouteName[] = [
	"home",
	"appointments",
	"card",
	"cardInactive",
	"services",
	"serviceDetails",
	"payments",
	"paymentCheckout",
	"paymentProcessing",
	"paymentSuccess",
	"paymentFailed",
	"receipt",
	"profile",
	"notifications",
	"support",
	"settings",
	"editProfile",
	"booking",
	"appointmentConfirmation",
	"dentalHistory",
	"doctorDetails",
];

export const tabFor: Partial<Record<RouteName, RouteName>> = {
	cardInactive: "card",
	services: "home",
	serviceDetails: "home",
	booking: "appointments",
	appointmentConfirmation: "appointments",
	dentalHistory: "profile",
	doctorDetails: "appointments",
	paymentCheckout: "payments",
	paymentProcessing: "payments",
	paymentSuccess: "payments",
	paymentFailed: "payments",
	receipt: "payments",
	notifications: "profile",
	support: "profile",
	settings: "profile",
	editProfile: "profile",
};

export default routeNames;
