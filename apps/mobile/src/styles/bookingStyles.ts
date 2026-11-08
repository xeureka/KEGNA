import { StyleSheet } from "react-native";
import { colors } from "../constants/colors";

export const bookingStyles = StyleSheet.create({
	calendarHeader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: 12,
	},
	weekRow: {
		flexDirection: "row",
		justifyContent: "space-around",
		marginBottom: 6,
	},
	weekDay: {
		color: colors.muted,
		fontSize: 12,
		fontWeight: "700",
		textAlign: "center",
		width: "14.28%",
	},
	calendarGrid: { flexDirection: "row", flexWrap: "wrap" },
	dayCell: {
		width: "14.28%",
		height: 42,
		alignItems: "center",
		justifyContent: "center",
	},
	dayCircle: {
		width: 34,
		height: 34,
		borderRadius: 17,
		alignItems: "center",
		justifyContent: "center",
	},
	dayCircleSelected: { backgroundColor: colors.primary },
	dayText: { color: colors.ink, fontSize: 14, fontWeight: "700" },
	dayTextSelected: { color: colors.surface, fontWeight: "800" },
	monthArrow: {
		width: 34,
		height: 34,
		borderRadius: 17,
		backgroundColor: colors.mint,
		alignItems: "center",
		justifyContent: "center",
	},
	monthArrowText: {
		color: colors.primary,
		fontSize: 24,
		lineHeight: 26,
		fontWeight: "700",
	},
	selectedDatePill: {
		marginTop: 14,
		paddingVertical: 10,
		paddingHorizontal: 14,
		borderRadius: 12,
		backgroundColor: colors.mint,
		alignItems: "center",
	},
	selectedDateText: { color: colors.primary, fontSize: 13, fontWeight: "800" },
	slotHeading: {
		fontSize: 14,
		fontWeight: "800",
		color: colors.ink,
		marginBottom: 8,
	},
	timeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
	timeChip: {
		width: "31%",
		minHeight: 44,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: colors.border,
		backgroundColor: colors.surface,
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: 4,
	},
	timeChipSelected: {
		backgroundColor: colors.primary,
		borderColor: colors.primary,
	},
	timeChipText: { fontSize: 13, fontWeight: "700", color: colors.ink },
	timeChipTextSelected: { color: colors.surface, fontWeight: "800" },
});

export const confirmationStyles = StyleSheet.create({
	heroSection: { alignItems: "center", paddingTop: 10, paddingBottom: 6 },
	actions: { gap: 10, marginTop: 12 },
});

export default bookingStyles;
