import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ChartBar, ClipboardText, House, Package, Receipt, UserCircle } from "phosphor-react-native";
import { LoadingState } from "../components/LoadingState";
import { useAuth } from "../context/AuthContext";
import { colors } from "../constants/colors";
import { ConversationScreen } from "../screens/ConversationScreen";
import { LoginScreen } from "../screens/LoginScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { SalesHomeScreen } from "../screens/SalesHomeScreen";
import { SalesReportScreen } from "../screens/SalesReportScreen";
import { SalesHistoryScreen } from "../screens/SalesHistoryScreen";
import { FinancePaymentsScreen } from "../screens/FinancePaymentsScreen";
import { FinanceOverviewScreen } from "../screens/FinanceOverviewScreen";
import { FinanceStockScreen } from "../screens/FinanceStockScreen";
import { UseWebScreen } from "../screens/UseWebScreen";
export type RootStackParamList = { SalesTabs: undefined; AccountantTabs: undefined; Conversation: { issueId: string } };
export type SalesTabParamList = { Home: undefined; LoadOuts: undefined; Reports: undefined; Profile: undefined };
export type AccountantTabParamList = { Overview: undefined; ReviewQueue: undefined; Reports: undefined; Profile: undefined };
const Stack = createNativeStackNavigator<RootStackParamList>(); const SalesTabs = createBottomTabNavigator<SalesTabParamList>(); const AccountantTabs = createBottomTabNavigator<AccountantTabParamList>();
const tabOptions = { headerShown: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.muted, tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border }, tabBarLabelStyle: { fontSize: 11, fontWeight: "600" as const } };
function SalesNavigator() { return <SalesTabs.Navigator screenOptions={tabOptions}><SalesTabs.Screen name="Home" options={{ tabBarIcon: ({ color, size }) => <House color={color} size={size} /> }}>{({ navigation }) => <SalesHomeScreen onReport={() => navigation.navigate("LoadOuts")} />}</SalesTabs.Screen><SalesTabs.Screen name="LoadOuts" component={SalesReportScreen} options={{ title: "Report", tabBarIcon: ({ color, size }) => <Package color={color} size={size} /> }} /><SalesTabs.Screen name="Reports" component={SalesHistoryScreen} options={{ title: "History", tabBarIcon: ({ color, size }) => <Receipt color={color} size={size} /> }} /><SalesTabs.Screen name="Profile" component={ProfileScreen} options={{ tabBarIcon: ({ color, size }) => <UserCircle color={color} size={size} /> }} /></SalesTabs.Navigator>; }
function AccountantNavigator() { return <AccountantTabs.Navigator screenOptions={tabOptions}><AccountantTabs.Screen name="Overview" component={FinancePaymentsScreen} options={{ title: "Payments", tabBarIcon: ({ color, size }) => <ChartBar color={color} size={size} /> }} /><AccountantTabs.Screen name="ReviewQueue" component={FinanceOverviewScreen} options={{ title: "Overview", tabBarIcon: ({ color, size }) => <ClipboardText color={color} size={size} /> }} /><AccountantTabs.Screen name="Reports" component={FinanceStockScreen} options={{ title: "Stock", tabBarIcon: ({ color, size }) => <Receipt color={color} size={size} /> }} /><AccountantTabs.Screen name="Profile" component={ProfileScreen} options={{ tabBarIcon: ({ color, size }) => <UserCircle color={color} size={size} /> }} /></AccountantTabs.Navigator>; }
export function AppNavigator() { const { status, session } = useAuth(); if (status === "loading") return <LoadingState label="Opening ZOLA" />; if (status === "signedOut") return <LoginScreen />; if (session?.user.role === "admin" || session?.user.role === "storekeeper") return <UseWebScreen />; const initialRouteName = session?.user.role === "accountant" ? "AccountantTabs" : "SalesTabs"; return <Stack.Navigator initialRouteName={initialRouteName} screenOptions={{ headerShown: false }}><Stack.Screen name="SalesTabs" component={SalesNavigator} /><Stack.Screen name="AccountantTabs" component={AccountantNavigator} /><Stack.Screen name="Conversation" component={ConversationScreen} /></Stack.Navigator>; }
