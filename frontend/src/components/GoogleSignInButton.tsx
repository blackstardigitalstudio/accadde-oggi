import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import { useAuth } from "../contexts/AuthContext";
import { Lang, t } from "../i18n/translations";
import { COLORS } from "../theme";

// Required so the browser tab that Google opens can hand the result back.
WebBrowser.maybeCompleteAuthSession();

const WEB_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const ANDROID_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
const IOS_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

/**
 * Whether Google sign-in is configured for this build.
 *
 * Without client IDs the button is not rendered at all — a button that always
 * fails is worse than no button.
 */
export const GOOGLE_ENABLED = Boolean(WEB_ID || ANDROID_ID || IOS_ID);

type Props = {
  lang: Lang;
  country?: string;
  onSuccess: (created: boolean) => void;
  onError: (message: string) => void;
  disabled?: boolean;
};

export default function GoogleSignInButton({
  lang, country = "IT", onSuccess, onError, disabled,
}: Props) {
  const { loginWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: WEB_ID,
    androidClientId: ANDROID_ID,
    iosClientId: IOS_ID,
  });

  useEffect(() => {
    if (!response) return;
    if (response.type === "dismiss" || response.type === "cancel") {
      setBusy(false);
      return;
    }
    if (response.type === "error") {
      setBusy(false);
      onError(t(lang, "googleError"));
      return;
    }
    if (response.type !== "success") return;

    const idToken =
      (response.params as any)?.id_token ||
      (response.authentication as any)?.idToken;
    if (!idToken) {
      setBusy(false);
      onError(t(lang, "googleError"));
      return;
    }

    (async () => {
      try {
        const created = await loginWithGoogle(idToken, lang, country);
        onSuccess(created);
      } catch (e: any) {
        const detail = e?.response?.data?.detail;
        onError(typeof detail === "string" ? detail : t(lang, "googleError"));
      } finally {
        setBusy(false);
      }
    })();
    // loginWithGoogle/onSuccess/onError are stable enough for this one-shot effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);

  const start = async () => {
    setBusy(true);
    try {
      await promptAsync();
    } catch {
      setBusy(false);
      onError(t(lang, "googleError"));
    }
  };

  return (
    <TouchableOpacity
      testID="google-signin-button"
      accessibilityRole="button"
      accessibilityLabel={t(lang, "continueWithGoogle")}
      style={[styles.btn, (disabled || busy || !request) && styles.btnDisabled]}
      onPress={start}
      disabled={disabled || busy || !request}
      activeOpacity={0.85}
    >
      {busy ? (
        <ActivityIndicator color="#1F1F1F" />
      ) : (
        <>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>G</Text>
          </View>
          <Text style={styles.label}>{t(lang, "continueWithGoogle")}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginTop: 14,
    // Comfortably above the 44px minimum touch target.
    minHeight: 54,
    paddingVertical: 15,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
  },
  btnDisabled: { opacity: 0.55 },
  badge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F3F4",
  },
  badgeText: {
    color: "#4285F4",
    fontSize: 16,
    fontWeight: "900",
  },
  label: {
    color: "#1F1F1F",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
});

export const googleDividerStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 22,
  },
  line: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.18)" },
  text: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
  },
});
