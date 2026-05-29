import { useState, useEffect, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  ImageBackground, Animated, Keyboard,
} from "react-native";
import { useRouter, Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Eye, EyeOff } from "lucide-react-native";
import { useAuth } from "../../src/contexts/AuthContext";
import { useLang } from "../../src/contexts/LanguageContext";
import { COLORS } from "../../src/theme";
import { T, LANGS, Lang } from "../../src/i18n/translations";
import { COUNTRIES, defaultCountryForLang } from "../../src/i18n/countries";
import { SECURITY_QUESTIONS, SECURITY_LABELS } from "../../src/i18n/security";
import { HERO_IMAGES } from "../../src/utils/categoryImages";
import MadeInItaly from "../../src/components/MadeInItaly";

export default function Register() {
  const router = useRouter();
  const { register } = useAuth();
  const { lang: ctxLang, setLang: setCtxLang } = useLang();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [language, setLanguage] = useState<Lang>(ctxLang);
  const [country, setCountry] = useState<string>("IT");
  const [securityQid, setSecurityQid] = useState<string>("pet");
  const [securityCustom, setSecurityCustom] = useState("");
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [pwdVisible, setPwdVisible] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [imgIdx, setImgIdx] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const id = setInterval(() => {
      Animated.timing(fade, { toValue: 0, duration: 800, useNativeDriver: true }).start(() => {
        setImgIdx((i) => (i + 1) % HERO_IMAGES.length);
        Animated.timing(fade, { toValue: 1, duration: 800, useNativeDriver: true }).start();
      });
    }, 6000);
    return () => clearInterval(id);
  }, [fade]);

  const setLangAndCountry = (lang: Lang) => {
    setLanguage(lang);
    setCountry(defaultCountryForLang(lang));
  };

  const submit = async () => {
    Keyboard.dismiss();
    setErr(null);
    if (password.length < 6) {
      setErr(T[language].passwordTooShort);
      return;
    }
    if (!email) return;
    setLoading(true);
    try {
      const questions = SECURITY_QUESTIONS[language];
      const selected = questions.find((q) => q.id === securityQid);
      let qText: string | undefined;
      let aText: string | undefined;
      if (selected) {
        qText = securityQid === "custom" ? securityCustom.trim() : selected.label;
        aText = securityAnswer.trim();
        // Only send if both are meaningful
        if (!qText || qText.length < 3 || !aText || aText.length < 2) {
          qText = undefined;
          aText = undefined;
        }
      }
      await register(email.trim(), password, name.trim(), language, country, qText, aText);
      await setCtxLang(language);
      router.replace("/(tabs)");
    } catch (e: any) {
      const d = e?.response?.data?.detail;
      setErr(typeof d === "string" ? d : T[language].errorRegister);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.c} testID="register-screen">
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: fade }]}>
        <ImageBackground source={HERO_IMAGES[imgIdx]} style={StyleSheet.absoluteFillObject} resizeMode="cover">
          <LinearGradient
            colors={["rgba(5,5,5,0.85)", "rgba(5,5,5,0.92)", "#050505"]}
            locations={[0, 0.5, 1]}
            style={StyleSheet.absoluteFillObject}
          />
        </ImageBackground>
      </Animated.View>

      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
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
                returnKeyType="next"
              />

              <Text style={[styles.label, { marginTop: 18 }]}>{T[language].email.toUpperCase()}</Text>
              <TextInput
                testID="register-email-input"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder="tu@email.com"
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
                returnKeyType="next"
              />

              <Text style={[styles.label, { marginTop: 18 }]}>{T[language].password.toUpperCase()}</Text>
              <View style={styles.pwdRow}>
                <TextInput
                  testID="register-password-input"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!pwdVisible}
                  autoCapitalize="none"
                  placeholder="min. 6 caratteri"
                  placeholderTextColor={COLORS.textMuted}
                  style={[styles.input, { flex: 1 }]}
                  returnKeyType="next"
                />
                <TouchableOpacity
                  testID="register-toggle-pwd"
                  onPress={() => setPwdVisible(!pwdVisible)}
                  style={styles.eyeBtn}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  {pwdVisible ? <EyeOff size={20} color={COLORS.textSecondary} /> : <Eye size={20} color={COLORS.textSecondary} />}
                </TouchableOpacity>
              </View>

              <Text style={[styles.label, { marginTop: 22 }]}>LINGUA</Text>
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

              <Text style={[styles.label, { marginTop: 18 }]}>PAESE</Text>
              <Text style={styles.labelSub}>Per avere notizie rilevanti per te</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginTop: 10 }}
                contentContainerStyle={{ gap: 8, paddingRight: 20 }}
                keyboardShouldPersistTaps="handled"
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

              <Text style={[styles.label, { marginTop: 22 }]}>
                🔐 {SECURITY_LABELS[language].sectionTitle}
              </Text>
              <Text style={styles.labelSub}>
                {SECURITY_LABELS[language].answerHint}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginTop: 10 }}
                contentContainerStyle={{ gap: 8, paddingRight: 20 }}
                keyboardShouldPersistTaps="handled"
              >
                {SECURITY_QUESTIONS[language].map((q) => (
                  <TouchableOpacity
                    key={q.id}
                    testID={`register-secq-${q.id}`}
                    style={[styles.secQChip, securityQid === q.id && styles.secQChipActive]}
                    onPress={() => setSecurityQid(q.id)}
                  >
                    <Text style={[styles.secQText, securityQid === q.id && styles.chipTextActive]} numberOfLines={2}>
                      {q.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {securityQid === "custom" && (
                <TextInput
                  testID="register-security-custom"
                  value={securityCustom}
                  onChangeText={setSecurityCustom}
                  placeholder={SECURITY_LABELS[language].customQuestion}
                  placeholderTextColor={COLORS.textMuted}
                  style={[styles.input, { marginTop: 10 }]}
                />
              )}
              <TextInput
                testID="register-security-answer"
                value={securityAnswer}
                onChangeText={setSecurityAnswer}
                placeholder={SECURITY_LABELS[language].answerLabel}
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="none"
                style={[styles.input, { marginTop: 12 }]}
              />

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

            <MadeInItaly style={{ marginTop: 24, marginBottom: 4 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flexGrow: 1, padding: 28, paddingTop: 40, paddingBottom: 40 },
  brandBox: { marginBottom: 24 },
  brand: { color: COLORS.textPrimary, fontSize: 44, fontWeight: "900", letterSpacing: -3, lineHeight: 46 },
  brandAccent: { color: COLORS.like },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  redLine: { width: 48, height: 6, backgroundColor: COLORS.like },
  form: { marginTop: 4 },
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
  secQChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: "rgba(255,255,255,0.04)",
    maxWidth: 220,
  },
  secQChipActive: { backgroundColor: COLORS.like, borderColor: COLORS.like },
  secQText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: "600", lineHeight: 16 },
  pwdRow: { flexDirection: "row", alignItems: "flex-end" },
  eyeBtn: { paddingHorizontal: 10, paddingBottom: 10 },
  countryText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: "600" },
  err: { color: COLORS.like, marginTop: 14, fontSize: 13, fontWeight: "600" },
  primaryBtn: {
    marginTop: 24,
    backgroundColor: COLORS.textPrimary,
    paddingVertical: 18,
    alignItems: "center",
    borderRadius: 8,
  },
  primaryBtnText: { color: "#050505", fontSize: 14, fontWeight: "900", letterSpacing: 2 },
  secondaryBtn: { marginTop: 18, alignItems: "center" },
  secondaryText: { color: COLORS.textSecondary, fontSize: 14 },
  secondaryAccent: { color: COLORS.like, fontWeight: "700" },
});
