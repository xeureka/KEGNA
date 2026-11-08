import React from "react";
import { View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { BottomNav } from "../components/BottomNav";
import { styles } from "../styles/commonStyles";
import { authTabScreens, tabFor, type RouteName, type Screen } from "./routes";

import { Splash } from "../screens/auth/Splash";
import { Welcome } from "../screens/auth/Welcome";
import { Login } from "../screens/auth/Login";
import { Register } from "../screens/auth/Register";
import { Otp } from "../screens/auth/OTP";
import { CompleteProfile } from "../screens/auth/CompleteProfile";
import { Terms } from "../screens/auth/Terms";

import { Home } from "../screens/home/Home";

import { Appointments } from "../screens/appointments/Appointments";
import { Booking } from "../screens/appointments/Booking";
import { AppointmentConfirmation } from "../screens/appointments/AppointmentConfirmation";
import { DoctorDetails } from "../screens/appointments/DoctorDetails";

import { CardScreen } from "../screens/card/CardScreen";
import { CardInactive } from "../screens/card/CardInactive";

import { Services } from "../screens/services/Services";
import { ServiceDetails } from "../screens/services/ServiceDetails";

import { Payments } from "../screens/payments/Payments";
import { PaymentPage } from "../screens/payments/PaymentPage";

import { Profile } from "../screens/profile/Profile";
import { DentalHistory } from "../screens/profile/DentalHistory";
import { Notifications } from "../screens/profile/Notifications";
import { Support } from "../screens/profile/Support";
import { Settings } from "../screens/profile/Settings";
import { EditProfile } from "../screens/profile/EditProfile";

export const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function createScreenGo(navigation: {
	canGoBack?: () => boolean;
	goBack?: () => void;
	navigate: (screen: string, params?: object) => void;
	getParent?: () =>
		| { navigate: (screen: string, params?: object) => void }
		| undefined;
}) {
	return (next: Screen) => {
		if (next === "back") {
			if (navigation.canGoBack?.()) {
				navigation.goBack?.();
			}
			return;
		}

		const parent = navigation.getParent?.();
		const isTabScreen = authTabScreens.includes(next as RouteName);
		const targetTab = tabFor[next as RouteName];

		if (isTabScreen) {
			if (parent) {
				parent.navigate(next as RouteName);
				return;
			}
			navigation.navigate("main", { screen: next as RouteName });
			return;
		}

		if (targetTab) {
			if (parent) {
				parent.navigate(targetTab, { screen: next as RouteName });
				return;
			}
			navigation.navigate("main", {
				screen: targetTab,
				params: { screen: next as RouteName },
			});
			return;
		}

		navigation.navigate(next as RouteName);
	};
}

function ScreenWrapper({
	children,
	navigation: _navigation,
}: {
	children: React.ReactNode;
	navigation: {
		canGoBack?: () => boolean;
		goBack?: () => void;
		navigate: (screen: string, params?: object) => void;
		getParent?: () =>
			| { navigate: (screen: string, params?: object) => void }
			| undefined;
	};
}) {
	return <View style={styles.appViewport}>{children}</View>;
}

export function RouteScreen({
	route,
	navigation,
}: {
	route: { name: RouteName };
	navigation: {
		canGoBack?: () => boolean;
		goBack?: () => void;
		navigate: (screen: string, params?: object) => void;
		getParent?: () =>
			| { navigate: (screen: string, params?: object) => void }
			| undefined;
	};
}) {
	const screen = route.name;
	const go = createScreenGo(navigation);

	const views: Record<RouteName, React.ReactNode> = {
		splash: <Splash go={go} />,
		welcome: <Welcome go={go} />,
		login: <Login go={go} />,
		register: <Register go={go} />,
		otp: <Otp go={go} />,
		completeProfile: <CompleteProfile go={go} />,
		terms: <Terms go={go} />,
		dentalHistory: <DentalHistory go={go} />,
		doctorDetails: <DoctorDetails go={go} />,
		home: <Home go={go} />,
		appointments: <Appointments go={go} />,
		card: <CardScreen go={go} />,
		cardInactive: <CardInactive go={go} />,
		services: <Services go={go} />,
		serviceDetails: <ServiceDetails go={go} />,
		payments: <Payments go={go} />,
		paymentCheckout: <PaymentPage variant="checkout" go={go} />,
		paymentProcessing: <PaymentPage variant="processing" go={go} />,
		paymentSuccess: <PaymentPage variant="success" go={go} />,
		paymentFailed: <PaymentPage variant="failed" go={go} />,
		receipt: <PaymentPage variant="receipt" go={go} />,
		profile: <Profile go={go} />,
		notifications: <Notifications go={go} />,
		support: <Support go={go} />,
		settings: <Settings go={go} />,
		editProfile: <EditProfile go={go} />,
		booking: <Booking go={go} />,
		appointmentConfirmation: <AppointmentConfirmation go={go} />,
	};

	return (
		<ScreenWrapper navigation={navigation}>
			<View style={styles.screenFrame}>{views[screen]}</View>
		</ScreenWrapper>
	);
}

function HomeTabNavigator() {
	const StackHome = createNativeStackNavigator();

	return (
		<StackHome.Navigator
			initialRouteName="homeRoot"
			screenOptions={{ headerShown: false }}
		>
			<StackHome.Screen
				name="homeRoot"
				children={({ navigation }) => <Home go={createScreenGo(navigation)} />}
			/>
			<StackHome.Screen
				name="services"
				children={({ navigation }) => (
					<Services go={createScreenGo(navigation)} />
				)}
			/>
			<StackHome.Screen
				name="serviceDetails"
				children={({ navigation }) => (
					<ServiceDetails go={createScreenGo(navigation)} />
				)}
			/>
		</StackHome.Navigator>
	);
}

function AppointmentsTabNavigator() {
	const StackAppointments = createNativeStackNavigator();

	return (
		<StackAppointments.Navigator
			initialRouteName="appointmentsRoot"
			screenOptions={{ headerShown: false }}
		>
			<StackAppointments.Screen
				name="appointmentsRoot"
				children={({ navigation }) => (
					<Appointments go={createScreenGo(navigation)} />
				)}
			/>
			<StackAppointments.Screen
				name="booking"
				children={({ navigation }) => (
					<Booking go={createScreenGo(navigation)} />
				)}
			/>
			<StackAppointments.Screen
				name="appointmentConfirmation"
				children={({ navigation }) => (
					<AppointmentConfirmation go={createScreenGo(navigation)} />
				)}
			/>
			<StackAppointments.Screen
				name="doctorDetails"
				children={({ navigation }) => (
					<DoctorDetails go={createScreenGo(navigation)} />
				)}
			/>
		</StackAppointments.Navigator>
	);
}

function CardTabNavigator() {
	const StackCard = createNativeStackNavigator();

	return (
		<StackCard.Navigator
			initialRouteName="cardRoot"
			screenOptions={{ headerShown: false }}
		>
			<StackCard.Screen
				name="cardRoot"
				children={({ navigation }) => (
					<CardScreen go={createScreenGo(navigation)} />
				)}
			/>
			<StackCard.Screen
				name="cardInactive"
				children={({ navigation }) => (
					<CardInactive go={createScreenGo(navigation)} />
				)}
			/>
		</StackCard.Navigator>
	);
}

function PaymentsTabNavigator() {
	const StackPayments = createNativeStackNavigator();

	return (
		<StackPayments.Navigator
			initialRouteName="paymentsRoot"
			screenOptions={{ headerShown: false }}
		>
			<StackPayments.Screen
				name="paymentsRoot"
				children={({ navigation }) => (
					<Payments go={createScreenGo(navigation)} />
				)}
			/>
			<StackPayments.Screen
				name="paymentCheckout"
				children={({ navigation }) => (
					<PaymentPage variant="checkout" go={createScreenGo(navigation)} />
				)}
			/>
			<StackPayments.Screen
				name="paymentProcessing"
				children={({ navigation }) => (
					<PaymentPage variant="processing" go={createScreenGo(navigation)} />
				)}
			/>
			<StackPayments.Screen
				name="paymentSuccess"
				children={({ navigation }) => (
					<PaymentPage variant="success" go={createScreenGo(navigation)} />
				)}
			/>
			<StackPayments.Screen
				name="paymentFailed"
				children={({ navigation }) => (
					<PaymentPage variant="failed" go={createScreenGo(navigation)} />
				)}
			/>
			<StackPayments.Screen
				name="receipt"
				children={({ navigation }) => (
					<PaymentPage variant="receipt" go={createScreenGo(navigation)} />
				)}
			/>
		</StackPayments.Navigator>
	);
}

function ProfileTabNavigator() {
	const StackProfile = createNativeStackNavigator();

	return (
		<StackProfile.Navigator
			initialRouteName="profileRoot"
			screenOptions={{ headerShown: false }}
		>
			<StackProfile.Screen
				name="profileRoot"
				children={({ navigation }) => (
					<Profile go={createScreenGo(navigation)} />
				)}
			/>
			<StackProfile.Screen
				name="notifications"
				children={({ navigation }) => (
					<Notifications go={createScreenGo(navigation)} />
				)}
			/>
			<StackProfile.Screen
				name="support"
				children={({ navigation }) => (
					<Support go={createScreenGo(navigation)} />
				)}
			/>
			<StackProfile.Screen
				name="settings"
				children={({ navigation }) => (
					<Settings go={createScreenGo(navigation)} />
				)}
			/>
			<StackProfile.Screen
				name="editProfile"
				children={({ navigation }) => (
					<EditProfile go={createScreenGo(navigation)} />
				)}
			/>
			<StackProfile.Screen
				name="dentalHistory"
				children={({ navigation }) => (
					<DentalHistory go={createScreenGo(navigation)} />
				)}
			/>
		</StackProfile.Navigator>
	);
}

function MainTabs() {
	return (
		<Tab.Navigator
			initialRouteName="home"
			screenOptions={{ headerShown: false, tabBarStyle: { display: "none" } }}
			tabBar={(props) => <BottomNav {...props} />}
		>
			<Tab.Screen name="home" component={HomeTabNavigator} />
			<Tab.Screen name="appointments" component={AppointmentsTabNavigator} />
			<Tab.Screen name="card" component={CardTabNavigator} />
			<Tab.Screen name="payments" component={PaymentsTabNavigator} />
			<Tab.Screen name="profile" component={ProfileTabNavigator} />
		</Tab.Navigator>
	);
}

export function AppNavigator() {
	return (
		<Stack.Navigator
			initialRouteName="splash"
			screenOptions={{ headerShown: false }}
		>
			<Stack.Screen
				name="splash"
				children={({ navigation }) => (
					<Splash go={createScreenGo(navigation)} />
				)}
			/>
			<Stack.Screen
				name="welcome"
				children={({ navigation }) => (
					<Welcome go={createScreenGo(navigation)} />
				)}
			/>
			<Stack.Screen
				name="login"
				children={({ navigation }) => <Login go={createScreenGo(navigation)} />}
			/>
			<Stack.Screen
				name="register"
				children={({ navigation }) => (
					<Register go={createScreenGo(navigation)} />
				)}
			/>
			<Stack.Screen
				name="otp"
				children={({ navigation }) => (
					<Otp
						go={createScreenGo(navigation)}
						onAuthenticated={() =>
							navigation.reset({ index: 0, routes: [{ name: "main" }] })
						}
					/>
				)}
			/>
			<Stack.Screen
				name="completeProfile"
				children={({ navigation }) => (
					<CompleteProfile go={createScreenGo(navigation)} />
				)}
			/>
			<Stack.Screen
				name="terms"
				children={({ navigation }) => <Terms go={createScreenGo(navigation)} />}
			/>
			<Stack.Screen name="main" component={MainTabs} />
		</Stack.Navigator>
	);
}

export default RouteScreen;
