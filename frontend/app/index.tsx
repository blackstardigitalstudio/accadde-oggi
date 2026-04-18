import { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet, Text } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../src/contexts/AuthContext";
import { COLORS } from "../src/theme";

export default function Index() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user === undefined) return;
    if (user) {
      router.replace("/(tabs)");
    } else {
      router.replace("/auth/login");
    }
  }, [user, router]);

  return (
    <View style={styles.c} testID="splash-screen">
      <Text style={styles.brand} testID="splash-title">ACCADDE</Text>
      <Text style={[styles.brand, styles.brandAccent]}>OGGI</Text>
      <ActivityIndicator color={COLORS.like} style={{ marginTop: 24 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center" },
  brand: {
    color: COLORS.textPrimary,
    fontSize: 48,
    fontWeight: "900",
    letterSpacing: -2,
    lineHeight: 48,
  },
  brandAccent: { color: COLORS.like },
});
