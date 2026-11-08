export type Screen =
	| "back"
	| "splash"
	| "welcome"
	| "login"
	| "register"
	| "otp"
	| "completeProfile"
	| "terms"
	| "dentalHistory"
	| "doctorDetails"
	| "home"
	| "appointments"
	| "card"
	| "cardInactive"
	| "services"
	| "serviceDetails"
	| "payments"
	| "paymentCheckout"
	| "paymentProcessing"
	| "paymentSuccess"
	| "paymentFailed"
	| "receipt"
	| "profile"
	| "notifications"
	| "support"
	| "settings"
	| "editProfile"
	| "booking"
	| "appointmentConfirmation";

export type RouteName = Exclude<Screen, "back">;

export type Language = "EN" | "አማ";

export type AppointmentService = {
	id?: string;
	title: string;
	description: string;
	duration: string;
	price: string;
	basePrice?: string;
};

export type Appointment = {
	service: AppointmentService;
	dentist: string;
	date: number;
	month: string;
	time: string;
	clinic: string;
};

export type DentalService = {
	title: string;
	description: string;
	detailedDescription: string;
	duration: string;
	price: string;
	features: string[];
	note: string;
};
