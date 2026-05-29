import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";

/** Small Italian tricolor flag drawn with plain Views (crisp at any scale). */
export const ItalyFlag: React.FC<{ width?: number; height?: number; radius?: number }> = ({
  width = 22,
  height = 15,
  radius = 3,
}) => (
  <View style={[styles.flag, { width, height, borderRadius: radius }]}>
    <View style={[styles.stripe, { backgroundColor: "#009246" }]} />
    <View style={[styles.stripe, { backgroundColor: "#F4F5F0" }]} />
    <View style={[styles.stripe, { backgroundColor: "#CE2B37" }]} />
  </View>
);

/** "Made in Italy" brand mark: tricolor flag + caption. */
const MadeInItaly: React.FC<{ style?: ViewStyle; color?: string }> = ({ style, color = "#8A8A86" }) => (
  <View style={[styles.row, style]} accessibilityLabel="Made in Italy">
    <ItalyFlag />
    <Text style={[styles.text, { color }]}>MADE IN ITALY</Text>
  </View>
);

export default MadeInItaly;

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  flag: {
    flexDirection: "row",
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.15)",
  },
  stripe: { flex: 1, height: "100%" },
  text: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
  },
});
