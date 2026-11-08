export { default } from "../App";

export type {
	Screen,
	RouteName,
	Language,
	Appointment,
	DentalService,
} from "./types";

export { LanguageContext, useLanguage } from "./context/LanguageContext";
export {
	AppointmentContext,
	useAppointment,
	initialAppointment,
} from "./context/AppointmentContext";
export { PaymentContext, usePayment } from "./context/PaymentContext";
export {
	NotificationContext,
	useNotifications,
} from "./context/NotificationContext";
export { AvatarContext, useAvatar } from "./context/AvatarContext";

export { colors } from "./constants/colors";
export { tenantConfig } from "./config/tenant";
export {
	cancelMobileAppointment,
	createMobileAppointment,
	getDoctor,
	getMobileProfile,
	listAppointments,
	listDentalHistory,
	listDoctors,
	listMobileBills,
	listMobileNotifications,
	listMobileServices,
	updateMobileProfile,
} from "./api/client";
export { authClient } from "./api/auth-client";
export { dentalServices } from "./constants/dentalServices";

export { Text } from "./components/Text";
export { TextInput } from "./components/TextInput";
export { Alert, translate } from "./utils/alert";
export { downloadReceipt } from "./utils/downloadReceipt";

export { Icon, Bell1, ToothIcon, Glyph, icons } from "./components/Icons";
export { Button } from "./components/Button";
export { Header } from "./components/Header";
export { AuthHeader } from "./components/AuthHeader";
export { LanguageToggle } from "./components/LanguageToggle";
export { SectionTitle } from "./components/SectionTitle";
export { Card } from "./components/Card";
export { Action } from "./components/Action";
export { Detail } from "./components/Detail";
export { MenuRow } from "./components/MenuRow";
export { Notification } from "./components/Notification";
export { BottomNav } from "./components/BottomNav";

export { styles } from "./styles/commonStyles";
export { bookingStyles, confirmationStyles } from "./styles/bookingStyles";

export {
	routeNames,
	authTabScreens,
	persistNavScreens,
	tabFor,
} from "./navigation/routes";
export { RouteScreen, AppNavigator } from "./navigation/AppNavigator";

export { Splash } from "./screens/auth/Splash";
export { Welcome } from "./screens/auth/Welcome";
export { Login } from "./screens/auth/Login";
export { Register } from "./screens/auth/Register";
export { Otp } from "./screens/auth/OTP";
export { CompleteProfile } from "./screens/auth/CompleteProfile";
export { Terms } from "./screens/auth/Terms";

export { Home } from "./screens/home/Home";

export { Appointments } from "./screens/appointments/Appointments";
export { Booking } from "./screens/appointments/Booking";
export { AppointmentConfirmation } from "./screens/appointments/AppointmentConfirmation";
export { DoctorDetails } from "./screens/appointments/DoctorDetails";

export { CardScreen } from "./screens/card/CardScreen";
export { CardInactive } from "./screens/card/CardInactive";

export { Services } from "./screens/services/Services";
export { ServiceDetails } from "./screens/services/ServiceDetails";

export { Payments, Payment } from "./screens/payments/Payments";
export { PaymentPage } from "./screens/payments/PaymentPage";
export { Receipt } from "./screens/payments/Receipt";

export { Profile } from "./screens/profile/Profile";
export { DentalHistory } from "./screens/profile/DentalHistory";
export { Notifications } from "./screens/profile/Notifications";
export { Support } from "./screens/profile/Support";
export { Settings } from "./screens/profile/Settings";
export { EditProfile } from "./screens/profile/EditProfile";
