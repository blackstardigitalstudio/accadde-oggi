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
import { t, T } from "../../src/i18n/translations";
import { HERO_IMAGES } from "../../src/utils/categoryImages";
import MadeInItaly from "../../src/components/MadeInItaly";
import GoogleSignInButton, { GOOGLE_ENABLED, googleDividerStyles } from "../../src/components/GoogleSignInButton";

const DEMO_EMAIL = "demo@accaddeoggi.app";
const DEMO_PASSWORD = "Demo1234";

export default function Login() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pwdVisible, setPwdVisible] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [imgIdx, setImgIdx] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;
  const { lang, setLang } = useLang();

  useEffect(() => {
    const id = setInterval(() => {
      Animated.timing(fade, { toValue: 0, duration: 800, useNativeDriver: true }).start(() => {
        setImgIdx((i) => (i + 1) % HERO_IMAGES.length);
        Animated.timing(fade, { toValue: 1, duration: 800, useNativeDriver: true }).start();
      });
    }, 6000);
    return () => clearInterval(id);
  }, [fade]);

  const submit = async () => {
    Keyboard.dismiss();
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
    }  };

  const demoLogin = async () => {
    Keyboard.dismiss();
    setErr(null);
    setLoading(true);
    try {
      await login(DEMO_EMAIL, DEMO_PASSWORD);
      router.replace("/(tabs)");
    } catch (e: any) {
      const d = e?.response?.data?.detail;
      setErr(typeof d === "string" ? d : t(lang, "errorLogin"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.c} testID="login-screen">
      {/* Rotating hero background */}
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
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.langRow}>
              {(["it", "en", "es"] as const).map((l) => (
                <TouchableOpacity
                  key={l}
                  onPress={() => setLang(l)}
                  style={[styles.langChip, lang === l && styles.langChipActive]}
                  testID={`login-lang-${l}`}
                >
                  <Text style={[styles.langFlag]}>{l === "it" ? "🇮🇹" : l === "en" ? "🇬🇧" : "🇪🇸"}</Text>
                  <Text style={[styles.langTxt, lang === l && { color: "#fff" }]}>{l.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.brandBox}>
              <Text style={styles.brand}>{T[lang].accadde}</Text>
              <View style={styles.brandRow}>
                <View style={styles.redLine} />
                <Text style={[styles.brand, styles.brandAccent]}>{T[lang].oggi}</Text>
              </View>
              <Text style={styles.tag}>{T[lang].brandSubtitle}</Text>
            </View>

            <View style={styles.form}>
              {/* Fastest way in: one tap, nothing to type or remember. */}
              {GOOGLE_ENABLED && (
                <>
                  <GoogleSignInButton
                    lang={lang}
                    onSuccess={() => router.replace("/(tabs)")}
                    onError={setErr}
                    disabled={loading}
                  />
                  <View style={googleDividerStyles.row}>
                    <View style={googleDividerStyles.line} />
                    <Text style={googleDividerStyles.text}>
                      {t(lang, "orWithEmail").toUpperCase()}
                    </Text>
                    <View style={googleDividerStyles.line} />
                  </View>
                </>
              )}

              <Text style={[styles.label, GOOGLE_ENABLED && { marginTop: 20 }]}>{T[lang].email.toUpperCase()}</Text>
              <TextInput
                testID="login-email-input"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                returnKeyType="next"
                placeholder="tu@email.com"
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
              />

              <Text style={[styles.label, { marginTop: 22 }]}>{T[lang].password.toUpperCase()}</Text>
              <View style={styles.pwdRow}>
                <TextInput
                  testID="login-password-input"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!pwdVisible}
                  autoCapitalize="none"
                  returnKeyType="go"
                  onSubmitEditing={submit}
                  placeholder="••••••••"
                  placeholderTextColor={COLORS.textMuted}
                  style={[styles.input, { flex: 1 }]}
                />
                <TouchableOpacity
                  testID="login-toggle-pwd"
                  onPress={() => setPwdVisible(!pwdVisible)}
                  style={styles.eyeBtn}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  {pwdVisible ? <EyeOff size={20} color={COLORS.textSecondary} /> : <Eye size={20} color={COLORS.textSecondary} />}
                </TouchableOpacity>
              </View>

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

              <TouchableOpacity
                testID="login-demo-button"
                style={styles.demoBtn}
                onPress={demoLogin}
                disabled={loading}
                activeOpacity={0.85}
              >
                <Text style={styles.demoBtnText}>{T[lang].tryDemo.toUpperCase()}</Text>
              </TouchableOpacity>

              <Link href="/auth/forgot" asChild>
                <TouchableOpacity testID="go-to-forgot" style={styles.forgotBtn}>
                  <Text style={styles.forgotText}>
                    {t(lang, "forgotPassword")}
                  </Text>
                </TouchableOpacity>
              </Link>

              <Link href="/auth/register" asChild>
                <TouchableOpacity testID="go-to-register" style={styles.secondaryBtn}>
                  <Text style={styles.secondaryText}>
                    {T[lang].noAccount} <Text style={styles.secondaryAccent}>{T[lang].signUp}</Text>
                  </Text>
                </TouchableOpacity>
              </Link>
            </View>

            <MadeInItaly style={styles.madeIn} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: COLORS.bg },
  scroll: {
    flexGrow: 1,
    padding: 28,
    paddingTop: 60,
    paddingBottom: 40,
    justifyContent: "space-between",
  },
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
    marginTop: 30,
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
  demoBtn: {
    marginTop: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.28)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  demoBtnText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 2,
  },
  secondaryBtn: { marginTop: 20, alignItems: "center" },
  secondaryText: { color: COLORS.textSecondary, fontSize: 14 },
  secondaryAccent: { color: COLORS.like, fontWeight: "700" },
  madeIn: { marginTop: 28, marginBottom: 4 },
  forgotBtn: { marginTop: 14, alignItems: "center" },
  forgotText: {
    color: COLORS.textMuted,
    fontSize: 13,
    textDecorationLine: "underline",
    fontWeight: "600",
  },
  pwdRow: { flexDirection: "row", alignItems: "flex-end" },
  eyeBtn: { paddingHorizontal: 10, paddingBottom: 10 },
  langRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 12,
    marginTop: 4,
  },
  langChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  langChipActive: {
    backgroundColor: COLORS.like,
    borderColor: COLORS.like,
  },
  langFlag: { fontSize: 14 },
  langTxt: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
});
