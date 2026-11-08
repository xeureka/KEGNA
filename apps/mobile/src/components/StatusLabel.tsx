import React from "react";
import { StyleSheet, View } from "react-native";
import { CheckCircle, Flag, Hourglass } from "phosphor-react-native";
import { colors } from "../constants/colors";
import type { IssueStatus } from "../types";
import { statusLabel } from "../utils/status";
import { Text } from "./Text";
export function StatusLabel({ status, size = 12 }: { status: IssueStatus | string; size?: number }) { const color = status === "flagged" ? colors.danger : status === "verified" ? colors.primary : colors.muted; const Icon = status === "flagged" ? Flag : status === "verified" ? CheckCircle : Hourglass; return <View style={styles.row}><Icon color={color} size={size + 2} /><Text size={size} style={{ color }}>{statusLabel(status)}</Text></View>; }
const styles = StyleSheet.create({ row: { flexDirection: "row", alignItems: "center", gap: 3 } });
