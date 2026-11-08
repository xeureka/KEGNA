import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { LoadingState } from "../components/LoadingState";
import { useAuth } from "../context/AuthContext";
import { ChatListScreen } from "../screens/ChatListScreen";
import { ConversationScreen } from "../screens/ConversationScreen";
import { LoginScreen } from "../screens/LoginScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { UseWebScreen } from "../screens/UseWebScreen";

export type RootStackParamList = { ChatList: undefined; Conversation: { issueId: string }; Profile: undefined };
const Stack = createNativeStackNavigator<RootStackParamList>();
export function AppNavigator() { const { status, session } = useAuth(); if (status === "loading") return <LoadingState label="Opening ZOLA" />; if (status === "signedOut") return <LoginScreen />; if (session?.user.role === "admin" || session?.user.role === "storekeeper") return <UseWebScreen />; return <Stack.Navigator screenOptions={{ headerShown: false }}><Stack.Screen name="ChatList" component={ChatListScreen} /><Stack.Screen name="Conversation" component={ConversationScreen} /><Stack.Screen name="Profile" component={ProfileScreen} /></Stack.Navigator>; }
