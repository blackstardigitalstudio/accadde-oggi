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
import { T, LANGS, Lang } from "../../src/i18n/translations";
import { COUNTRIES, defaultCountryForLang } from "../../src/i18n/countries";

export default function Register() {
  const router = useRouter();
  const { register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [language, setLanguage] = useState<Lang>("it");
  const [country, setCountry] = useState<string>("IT");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const setLangAndCountry = (lang: Lang) => {
    setLanguage(lang);
    setCountry(defaultCountryForLang(lang));
  };

  const submit = async () => {
    setErr(null);
    if (password.length < 6) {
      setErr(T[language].passwordTooShort);
      return;
    }
    if (!email) return;
    setLoading(true);
    try {
      await register(email.trim(), password, name.trim(), language, country);
      router.replace("/(tabs)");
    } catch (e: any) {
      const d = e?.response?.data?.detail;
      setErr(typeof d === "string" ? d : T[language].errorRegister);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.c} testID="register-screen">
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
            <Text style={styles.brand}>CREA</Text>
            <View style={styles.brandRow}>
              <View style={styles.redLine} />
              <Text style={[styles.brand, styles.brandAccent]}>ACCOUNT</Text>
            </View>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>{T[language].name.toUpperCase()}</Text>
            <TextInput
              testID="register-name-input"
              value={name}
              onChangeText={setName}
              placeholder="Mario Rossi"
              placeholderTextColor={COLORS.textMuted}
              style={styles.input}
            />

            <Text style={[styles.label, { marginTop: 20 }]}>{T[language].email.toUpperCase()}</Text>
            <TextInput
              testID="register-email-input"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="tu@email.com"
              placeholderTextColor={COLORS.textMuted}
              style={styles.input}
            />

            <Text style={[styles.label, { marginTop: 20 }]}>{T[language].password.toUpperCase()}</Text>
            <TextInput
              testID="register-password-input"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="min. 6 caratteri"
              placeholderTextColor={COLORS.textMuted}
              style={styles.input}
            />

            <Text style={[styles.label, { marginTop: 28 }]}>LINGUA</Text>
            <View style={styles.chipRow}>
              {LANGS.map((l) => (
                <TouchableOpacity
                  key={l.code}
                  testID={`register-lang-${l.code}`}
                  style={[styles.chip, language === l.code && styles.chipActive]}
                  onPress={() => setLangAndCountry(l.code)}
                >
                  <Text style={styles.chipFlag}>{l.flag}</Text>
                  <Text style={[styles.chipText, language === l.code && styles.chipTextActive]}>
                    {l.label.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, { marginTop: 24 }]}>PAESE</Text>
            <Text style={styles.labelSub}>Per avere notizie rilevanti per te</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginTop: 10 }}
              contentContainerStyle={{ gap: 8, paddingRight: 20 }}
            >
              {COUNTRIES.map((cn) => (
                <TouchableOpacity
                  key={cn.code}
                  testID={`register-country-${cn.code}`}
                  style={[styles.countryChip, country === cn.code && styles.countryChipActive]}
                  onPress={() => setCountry(cn.code)}
                >
                  <Text style={styles.chipFlag}>{cn.flag}</Text>
                  <Text style={[styles.countryText, country === cn.code && styles.chipTextActive]}>
                    {language === "it" ? cn.label_it : language === "es" ? cn.label_es : cn.label_en}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {err && <Text style={styles.err} testID="register-error">{err}</Text>}

            <TouchableOpacity
              testID="register-submit-button"
              style={styles.primaryBtn}
              onPress={submit}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#050505" /> : (
                <Text style={styles.primaryBtnText}>{T[language].signUp.toUpperCase()} →</Text>
              )}
            </TouchableOpacity>

            <Link href="/auth/login" asChild>
              <TouchableOpacity testID="go-to-login" style={styles.secondaryBtn}>
                <Text style={styles.secondaryText}>
                  {T[language].haveAccount} <Text style={styles.secondaryAccent}>{T[language].signIn}</Text>
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
  scroll: { flexGrow: 1, padding: 28, paddingTop: 60 },
  brandBox: { marginBottom: 28 },
  brand: { color: COLORS.textPrimary, fontSize: 48, fontWeight: "900", letterSpacing: -3, lineHeight: 48 },
  brandAccent: { color: COLORS.like },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  redLine: { width: 48, height: 6, backgroundColor: COLORS.like },
  form: { marginTop: 8 },
  label: { color: COLORS.textSecondary, fontSize: 11, letterSpacing: 2, fontWeight: "700" },
  labelSub: { color: COLORS.textMuted, fontSize: 12, marginTop: 4 },
  input: {
    color: COLORS.textPrimary,
    fontSize: 18,
    paddingVertical: 10,
    marginTop: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.textMuted,
  },
  chipRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
  },
  chipActive: { backgroundColor: COLORS.textPrimary, borderColor: COLORS.textPrimary },
  chipFlag: { fontSize: 14 },
  chipText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: "700", letterSpacing: 1 },
  chipTextActive: { color: "#050505" },
  countryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
  },
  countryChipActive: { backgroundColor: COLORS.like, borderColor: COLORS.like },
  countryText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: "600" },
  err: { color: COLORS.like, marginTop: 16, fontSize: 13, fontWeight: "600" },
  primaryBtn: {
    marginTop: 30,
    backgroundColor: COLORS.textPrimary,
    paddingVertical: 18,
    alignItems: "center",
    borderRadius: 8,
  },
  primaryBtnText: { color: "#050505", fontSize: 14, fontWeight: "900", letterSpacing: 2 },
  secondaryBtn: { marginTop: 22, alignItems: "center", paddingBottom: 40 },
  secondaryText: { color: COLORS.textSecondary, fontSize: 14 },
  secondaryAccent: { color: COLORS.like, fontWeight: "700" },
});
