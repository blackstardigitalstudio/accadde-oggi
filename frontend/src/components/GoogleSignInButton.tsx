import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import { useAuth } from "../contexts/AuthContext";
import { Lang, t } from "../i18n/translations";
import { COLORS } from "../theme";
import api from "../api/client";

// Required so the browser tab that Google opens can hand the result back.
WebBrowser.maybeCompleteAuthSession();

// Build-time IDs are only a fallback. The real source is the server (below):
// an OAuth client ID is public by design, and serving it means a build already
// on the store can gain Google sign-in without being rebuilt.
const ENV_WEB_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const ENV_ANDROID_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
const ENV_IOS_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

export type GoogleConfig = {
  webClientId?: string;
  androidClientId?: string;
  iosClientId?: string;
};

/**
 * Ask the backend which Google client IDs to use.
 *
 * Returns undefined while loading and null when Google sign-in is not
 * configured, so the caller can render nothing rather than a button that fails.
 */
export function useGoogleConfig(): GoogleConfig | null | undefined {
  const [config, setConfig] = useState<GoogleConfig | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await api.get("/auth/google/config", { timeout: 12000 });
        if (!alive) return;
        const cfg: GoogleConfig = {
          webClientId: data?.web_client_id || ENV_WEB_ID,
          androidClientId: data?.android_client_id || ENV_ANDROID_ID,
          iosClientId: data?.ios_client_id || ENV_IOS_ID,
        };
        setConfig(cfg.webClientId || cfg.androidClientId || cfg.iosClientId ? cfg : null);
      } catch {
        if (!alive) return;
        // Server unreachable: fall back to whatever was compiled in, if anything.
        const cfg: GoogleConfig = {
          webClientId: ENV_WEB_ID,
          androidClientId: ENV_ANDROID_ID,
          iosClientId: ENV_IOS_ID,
        };
        setConfig(cfg.webClientId || cfg.androidClientId || cfg.iosClientId ? cfg : null);
      }
    })();
    return () => { alive = false; };
  }, []);

  return config;
}

type Props = {
  lang: Lang;
  config: GoogleConfig;
  country?: string;
  onSuccess: (created: boolean) => void;
  onError: (message: string) => void;
  disabled?: boolean;
};

export default function GoogleSignInButton({
  lang, config, country = "IT", onSuccess, onError, disabled,
}: Props) {
  const { loginWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: config.webClientId,
    androidClientId: config.androidClientId,
    iosClientId: config.iosClientId,
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
