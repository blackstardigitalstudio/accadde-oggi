import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from "react-native";
import { useRouter, Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../../src/contexts/AuthContext";
import { COLORS } from "../../src/theme";
import { t, T } from "../../src/i18n/translations";

export default function Login() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const lang = "it";

  const submit = async () => {
    setErr(null);
    if (!email || !password) return;
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace("/(tabs)");
    } catch (e: any) {
      const d = e?.response?.data?.detail;
      setErr(typeof d === "string" ? d : t(lang, "errorLogin"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.c} testID="login-screen">
      <LinearGradient
        colors={["#0a0a0a", "#050505", "#1a0505"]}
        style={StyleSheet.absoluteFillObject}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brandBox}>
            <Text style={styles.brand}>ACCADDE</Text>
            <View style={styles.brandRow}>
              <View style={styles.redLine} />
              <Text style={[styles.brand, styles.brandAccent]}>OGGI</Text>
            </View>
            <Text style={styles.tag}>LA STORIA · OGNI GIORNO · SU DI TE</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>{T[lang].email.toUpperCase()}</Text>
            <TextInput
              testID="login-email-input"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="tu@email.com"
              placeholderTextColor={COLORS.textMuted}
              style={styles.input}
            />

            <Text style={[styles.label, { marginTop: 24 }]}>{T[lang].password.toUpperCase()}</Text>
            <TextInput
              testID="login-password-input"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor={COLORS.textMuted}
              style={styles.input}
            />

            {err && <Text style={styles.err} testID="login-error">{err}</Text>}

            <TouchableOpacity
              testID="login-submit-button"
              style={styles.primaryBtn}
              onPress={submit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#050505" />
              ) : (
                <Text style={styles.primaryBtnText}>{T[lang].signIn.toUpperCase()} →</Text>
              )}
            </TouchableOpacity>

            <Link href="/auth/register" asChild>
              <TouchableOpacity testID="go-to-register" style={styles.secondaryBtn}>
                <Text style={styles.secondaryText}>
                  {T[lang].noAccount} <Text style={styles.secondaryAccent}>{T[lang].signUp}</Text>
                </Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flexGrow: 1, padding: 28, justifyContent: "space-between", paddingTop: 60 },
  brandBox: { marginBottom: 40 },
  brand: {
    color: COLORS.textPrimary,
    fontSize: 56,
    fontWeight: "900",
    letterSpacing: -3,
    lineHeight: 56,
  },
  brandAccent: { color: COLORS.like },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  redLine: { width: 48, height: 6, backgroundColor: COLORS.like },
  tag: {
    color: COLORS.textSecondary,
    letterSpacing: 3,
    fontSize: 11,
    marginTop: 16,
    fontWeight: "700",
  },
  form: { marginTop: 20 },
  label: { color: COLORS.textSecondary, fontSize: 11, letterSpacing: 2, fontWeight: "700" },
  input: {
    color: COLORS.textPrimary,
    fontSize: 18,
    paddingVertical: 10,
    marginTop: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.textMuted,
  },
  err: { color: COLORS.like, marginTop: 16, fontSize: 13, fontWeight: "600" },
  primaryBtn: {
    marginTop: 36,
    backgroundColor: COLORS.textPrimary,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  primaryBtnText: {
    color: "#050505",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 2,
  },
  secondaryBtn: { marginTop: 22, alignItems: "center" },
  secondaryText: { color: COLORS.textSecondary, fontSize: 14 },
  secondaryAccent: { color: COLORS.like, fontWeight: "700" },
});
