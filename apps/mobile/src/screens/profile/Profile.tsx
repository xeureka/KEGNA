import React, { useEffect, useState } from "react";
import { View, ScrollView, Pressable, Image } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Text } from "../../components/Text";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { Header } from "../../components/Header";
import { MenuRow } from "../../components/MenuRow";
import { icons } from "../../components/Icons";
import { useAvatar } from "../../context/AvatarContext";
import { Alert } from "../../utils/alert";
import { styles } from "../../styles/commonStyles";
import type { Screen } from "../../types";
import { useTenantConfig } from "../../context/TenantConfigContext";
import { getMobileProfile } from "../../api/client";

export function Profile({ go }: { go: (screen: Screen) => void }) {
	const config = useTenantConfig();
	const { avatarUri, setAvatarUri } = useAvatar();
	const [profile, setProfile] = useState<{
		name?: string;
		patient?: {
			firstName?: string;
			lastName?: string;
			membershipTier?: string | null;
		};
	}>();
	useEffect(() => {
		void getMobileProfile()
			.then((result) =>
				setProfile({
					name: String(result.user.name ?? ""),
					patient: result.patient as
						| {
								firstName?: string;
								lastName?: string;
								membershipTier?: string | null;
						  }
						| undefined,
				}),
			)
			.catch(() => undefined);
	}, []);

	const chooseAvatar = async () => {
		const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
		if (!permission.granted) {
			Alert.alert(
				"Photo permission needed",
				"Allow photo access to choose a profile picture.",
			);
			return;
		}
		const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ["images"],
			allowsEditing: true,
			aspect: [1, 1],
			quality: 0.85,
		});
		if (!result.canceled) setAvatarUri(result.assets[0].uri);
	};

	return (
		<>
			<Header title="Profile" onNotifications={() => go("notifications")} />
			<ScrollView contentContainerStyle={styles.content}>
				<View style={styles.profileHero}>
					<View style={styles.avatarEditor}>
						<View style={styles.avatarLarge}>
							{avatarUri ? (
								<Image
									source={{ uri: avatarUri }}
									style={styles.avatarLargeImage}
								/>
							) : (
								<Text style={styles.avatarText}>A</Text>
							)}
						</View>
						<Pressable
							accessibilityLabel="Edit profile picture"
							onPress={chooseAvatar}
							style={styles.avatarEditButton}
						>
							<Text style={styles.avatarEditText}>✎</Text>
						</Pressable>
					</View>
					<Text style={styles.heroTitle}>
						{profile?.patient
							? `${profile.patient.firstName ?? ""} ${profile.patient.lastName ?? ""}`
							: (profile?.name ?? "My profile")}
					</Text>
					<Text style={styles.muted}>
						Patient since June 2026 · {config.clinic.address}
					</Text>
					<Text style={styles.avatarHint}>
						Tap the pen to choose a profile picture
					</Text>
				</View>
				<Card>
					<MenuRow
						icon={icons.person()}
						title="Personal information"
						onPress={() => go("editProfile")}
					/>
					<MenuRow
						icon={icons.clinic()}
						title="Home clinic"
						detail={config.identity.displayName}
					/>
					{profile?.patient?.membershipTier ? (
						<MenuRow
							icon={icons.person()}
							title="Membership"
							detail={profile.patient.membershipTier}
						/>
					) : null}
					<MenuRow
						icon={icons.book()}
						title="My dental history"
						onPress={() => go("dentalHistory")}
					/>
					<MenuRow
						icon={icons.help()}
						title="Help & support"
						onPress={() => go("support")}
					/>
					<MenuRow
						icon={icons.lock()}
						title="Settings"
						onPress={() => go("settings")}
					/>
				</Card>
				<Button label="Sign out" secondary onPress={() => go("splash")} />
			</ScrollView>
		</>
	);
}

export default Profile;
