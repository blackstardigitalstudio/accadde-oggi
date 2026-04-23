import { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft, Shield, Eye, EyeOff } from "lucide-react-native";
import api from "../../src/api/client";
import { COLORS } from "../../src/theme";
import { SECURITY_LABELS } from "../../src/i18n/security";
import { Lang } from "../../src/i18n/translations";

export default function Forgot() {
  const router = useRouter();
  const [lang] = useState<Lang>("it");
  const L = SECURITY_LABELS[lang];

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwdVisible, setPwdVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const fetchQuestion = async () => {
    setErr("");
    if (!email.trim()) return;
    setLoading(true);
    try {
      const { data } = await api.post("/auth/forgot/question", { email: email.trim().toLowerCase() });
      setQuestion(data.question);
      setStep(2);
    } catch (e: any) {
      const d = e?.response?.data?.detail;
      setErr(typeof d === "string" ? d : L.noQuestion);
    } finally {
      setLoading(false);
    }
  };

  const doReset = async () => {
    setErr("");
    if (!answer.trim() || newPassword.length < 6) return;
    setLoading(true);
    try {
      await api.post("/auth/forgot/reset", {
        email: email.trim().toLowerCase(),
        answer: answer.trim(),
        new_password: newPassword,
      });
      setStep(3);
      setTimeout(() => router.replace("/auth/login"), 2500);
    } catch (e: any) {
      const d = e?.response?.data?.detail;
      setErr(typeof d === "string" ? d : L.wrongAnswer);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.c}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.back} onPress={() => router.back()} testID="forgot-back">
            <ChevronLeft color={COLORS.textPrimary} size={24} />
          </TouchableOpacity>

          <View style={styles.headerBox}>
            <Shield color={COLORS.like} size={32} strokeWidth={2.5} />
            <Text style={styles.title}>{L.recoverTitle.toUpperCase()}</Text>
            <View style={styles.underline} />
            <Text style={styles.hint}>
              {step === 1 ? L.step1Hint : step === 2 ? L.step2Hint : ""}
            </Text>
          </View>

          {step === 1 && (
            <View style={styles.form}>
              <Text style={styles.label}>EMAIL</Text>
              <TextInput
                testID="forgot-email"
                value={email}
                onChangeText={setEmail}
                placeholder="tu@email.com"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
                style={styles.input}
              />
              {err ? <Text style={styles.err}>{err}</Text> : null}
              <TouchableOpacity
                testID="forgot-next"
                style={[styles.primaryBtn, loading && { opacity: 0.5 }]}
                disabled={loading}
                onPress={fetchQuestion}
              >
                {loading ? <ActivityIndicator color="#fff" /> : (
                  <Text style={styles.primaryBtnText}>{L.continue.toUpperCase()} →</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {step === 2 && (
            <View style={styles.form}>
              <View style={styles.questionBox}>
                <Text style={styles.questionLabel}>{L.questionLabel.toUpperCase()}</Text>
                <Text style={styles.questionText}>{question}</Text>
              </View>

              <Text style={[styles.label, { marginTop: 18 }]}>{L.answerLabel.toUpperCase()}</Text>
              <TextInput
                testID="forgot-answer"
                value={answer}
                onChangeText={setAnswer}
                placeholder={L.answerLabel}
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="none"
                style={styles.input}
              />

              <Text style={[styles.label, { marginTop: 18 }]}>{L.newPassword.toUpperCase()}</Text>
              <View style={styles.pwdRow}>
                <TextInput
                  testID="forgot-new-password"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="min. 6"
                  placeholderTextColor={COLORS.textMuted}
                  secureTextEntry={!pwdVisible}
                  style={[styles.input, { flex: 1 }]}
                />
                <TouchableOpacity
                  testID="forgot-toggle-pwd"
                  onPress={() => setPwdVisible(!pwdVisible)}
                  style={styles.eyeBtn}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  {pwdVisible ? <EyeOff size={20} color={COLORS.textSecondary} /> : <Eye size={20} color={COLORS.textSecondary} />}
                </TouchableOpacity>
              </View>

              {err ? <Text style={styles.err}>{err}</Text> : null}

              <TouchableOpacity
                testID="forgot-reset"
                style={[styles.primaryBtn, (loading || newPassword.length < 6) && { opacity: 0.5 }]}
                disabled={loading || newPassword.length < 6}
                onPress={doReset}
              >
                {loading ? <ActivityIndicator color="#fff" /> : (
                  <Text style={styles.primaryBtnText}>{L.reset.toUpperCase()} →</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {step === 3 && (
            <View style={styles.successBox}>
              <Text style={styles.successIcon}>✅</Text>
              <Text style={styles.successText}>{L.passwordReset}</Text>
              <Text style={styles.successSub}>
                Effettua il login con la nuova password.
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 40 },
  back: { position: "absolute", top: 44, left: 12, padding: 10, zIndex: 10 },
  headerBox: { alignItems: "center", marginBottom: 28, marginTop: 14 },
  title: { color: COLORS.textPrimary, fontSize: 24, fontWeight: "900", letterSpacing: -0.5, marginTop: 12 },
  underline: { width: 48, height: 4, backgroundColor: COLORS.like, marginTop: 6 },
  hint: { color: COLORS.textMuted, fontSize: 13, marginTop: 14, textAlign: "center", lineHeight: 20, paddingHorizontal: 10 },
  form: {},
  label: { color: COLORS.textMuted, fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  input: {
    color: COLORS.textPrimary,
    fontSize: 17,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.border,
    marginTop: 6,
  },
  questionBox: {
    padding: 16, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.like,
    backgroundColor: "rgba(230,57,70,0.06)",
  },
  questionLabel: { color: COLORS.like, fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  questionText: { color: COLORS.textPrimary, fontSize: 16, fontWeight: "700", marginTop: 8, lineHeight: 22 },
  err: { color: COLORS.like, fontSize: 13, fontWeight: "700", marginTop: 14 },
  primaryBtn: {
    marginTop: 24,
    backgroundColor: COLORS.like,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontSize: 14, fontWeight: "900", letterSpacing: 2 },
  successBox: { alignItems: "center", marginTop: 40 },
  successIcon: { fontSize: 64 },
  successText: { color: COLORS.textPrimary, fontSize: 20, fontWeight: "900", marginTop: 16, textAlign: "center" },
  successSub: { color: COLORS.textMuted, fontSize: 14, marginTop: 10, textAlign: "center" },
  pwdRow: { flexDirection: "row", alignItems: "flex-end" },
  eyeBtn: { paddingHorizontal: 10, paddingBottom: 10 },
});
