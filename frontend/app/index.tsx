import { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet, Text } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../src/contexts/AuthContext";
import { useTheme } from "../src/contexts/ThemeContext";

export default function Index() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();

  useEffect(() => {
    if (user === undefined) return;
    if (user) router.replace("/(tabs)");
    else router.replace("/auth/login");
  }, [user, router]);

  return (
    <View style={[styles.c, { backgroundColor: colors.bg }]} testID="splash-screen">
      <Text style={[styles.brand, { color: colors.textPrimary }]} testID="splash-title">ACCADDE</Text>
      <Text style={[styles.brand, styles.brandAccent]}>OGGI</Text>
      <ActivityIndicator color={colors.like} style={{ marginTop: 24 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, alignItems: "center", justifyContent: "center" },
  brand: { fontSize: 48, fontWeight: "900", letterSpacing: -2, lineHeight: 48 },
  brandAccent: { color: "#E63946" },
});
