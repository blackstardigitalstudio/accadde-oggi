import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api, { ACCESS_KEY, REFRESH_KEY } from "../api/client";
import { Lang } from "../i18n/translations";
import {
  scheduleRandomDailyNotifications,
  getScheduledInfo,
  registerPushToken,
  INTENSITY_PER_DAY,
  Intensity,
  Window,
  SCHEDULE_DAYS,
} from "../services/notifications";

const USER_CACHE_KEY = "accadde:user";
const LANG_KEY = "accadde:lang";  // keep in sync with LanguageContext
const DEVICE_KEY = "accadde:deviceId";

/**
 * A random id for this install, made here rather than read from the device.
 *
 * It identifies the guest account and nothing else: no hardware identifier, no
 * way to recognise the same person anywhere else. Clearing the app's data makes
 * a new one, which is the correct behaviour for something this anonymous.
 */
async function getDeviceId(): Promise<string> {
  const saved = await AsyncStorage.getItem(DEVICE_KEY);
  if (saved) return saved;
  const fresh =
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  await AsyncStorage.setItem(DEVICE_KEY, fresh);
  return fresh;
}
export const NOTIF_WINDOW_KEY = "accadde:notifWindow";
export const NOTIF_INTENSITY_KEY = "accadde:notifIntensity";

/** The user's saved notification preferences, with sensible defaults. */
export async function readNotifPrefs(): Promise<{ window: Window; intensity: Intensity }> {
  const [w, i] = await Promise.all([
    AsyncStorage.getItem(NOTIF_WINDOW_KEY),
    AsyncStorage.getItem(NOTIF_INTENSITY_KEY),
  ]);
  return {
    window: (w as Window) || "random",
    intensity: (i as Intensity) || "normal",
  };
}

export type User = {
  id: string;
  email: string;
  name: string;
  role: string;
  language: Lang;
  country: string;
  interests: string[];
  notifications_enabled: boolean;
  has_security_question?: boolean;
  auth_provider?: "password" | "google" | "guest";
  is_guest?: boolean;
  has_password?: boolean;
  created_at?: string;
};

type AuthState = {
  user: User | null | undefined; // undefined = loading
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (idToken: string, language: Lang, country: string) => Promise<boolean>;
  register: (
    email: string, password: string, name: string, language: Lang, country: string,
    security_question?: string, security_answer?: string
  ) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (patch: Partial<User>) => Promise<User>;
  setLanguage: (lang: Lang) => Promise<void>;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  /**
   * Top the notification queue back up.
   *
   * Local schedules are finite (and iOS only keeps the 64 soonest), so every
   * launch is a chance to refill them with the days ahead. The server push is
   * the backstop for someone who never opens the app at all.
   */
  const ensureNotificationsScheduled = async (lang: Lang, country?: string) => {
    try {
      const { window, intensity } = await readNotifPrefs();
      const perDay = INTENSITY_PER_DAY[intensity];
      const info = await getScheduledInfo();
      // Refill when the queue is running low rather than on every single launch.
      if (info.count < perDay * 3) {
        await scheduleRandomDailyNotifications(window, lang, SCHEDULE_DAYS, perDay);
      }
      registerPushToken(lang, country);
    } catch {}
  };

  const persistTokens = async (access: string, refresh: string) => {
    await AsyncStorage.setItem(ACCESS_KEY, access);
    await AsyncStorage.setItem(REFRESH_KEY, refresh);
  };

  /**
   * Get in without being asked anything.
   *
   * The app used to open on a sign-up form: people had to hand over an email
   * before seeing a single card, which is asking for commitment before giving
   * any reason to commit. Now a guest account is created silently on first
   * launch and the app opens on the feed. Signing up later upgrades that same
   * account, so nothing saved is lost.
   */
  const startAsGuest = useCallback(async () => {
    try {
      const device_id = await getDeviceId();
      const lang = (await AsyncStorage.getItem(LANG_KEY)) || "it";
      const { data } = await api.post("/auth/guest", { device_id, language: lang });
      await persistTokens(data.access_token, data.refresh_token);
      setUser(data.user);
      await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(data.user));
    } catch {
      // Server unreachable on a cold start: show the sign-in screen rather than
      // a dead end, so there is still a way forward.
      setUser(null);
    }
  }, []);

  const loadMe = useCallback(async () => {
    const token = await AsyncStorage.getItem(ACCESS_KEY);
    const refresh = await AsyncStorage.getItem(REFRESH_KEY);
    if (!token && !refresh) {
      await startAsGuest();
      return;
    }
    // Hydrate from cache immediately so the app stays logged in even offline
    const cached = await AsyncStorage.getItem(USER_CACHE_KEY);
    if (cached) {
      try {
        setUser(JSON.parse(cached));
      } catch {}
    }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
      await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(data));
      if (data?.notifications_enabled) {
        ensureNotificationsScheduled(data.language || "it", data.country);
      }
    } catch (e: any) {
      // Only log out on explicit auth errors (401/403). For network errors, keep the cached user.
      const status = e?.response?.status;
      if (status === 401 || status === 403) {
        await AsyncStorage.multiRemove([ACCESS_KEY, REFRESH_KEY, USER_CACHE_KEY]);
        setUser(null);
      } else if (!cached) {
        // no cache & no network — fall through to login screen
        setUser(null);
      }
      // else: keep cached user — app remains usable offline
    }
  }, [startAsGuest]);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  /** Shared tail of every successful sign-in. */
  const applySession = async (data: any) => {
    await persistTokens(data.access_token, data.refresh_token);

    // The language chosen on the sign-in screen wins over whatever the account
    // remembers. Someone who taps the Italian flag and then gets an English app
    // has been ignored — and the notifications, built at this very moment, were
    // being written in the account's old language.
    const picked = await AsyncStorage.getItem(LANG_KEY);
    let lang: Lang = data.user?.language || "it";
    if ((picked === "it" || picked === "en" || picked === "es") && picked !== lang) {
      lang = picked;
      try {
        const { data: updated } = await api.patch("/auth/me", { language: lang });
        data = { ...data, user: updated };
      } catch {
        // Offline: honour the choice locally anyway rather than override it.
        data = { ...data, user: { ...data.user, language: lang } };
      }
    }

    setUser(data.user);
    await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(data.user));
    await AsyncStorage.setItem(LANG_KEY, lang);

    if (data.user?.notifications_enabled) {
      const { window, intensity } = await readNotifPrefs();
      scheduleRandomDailyNotifications(
        window, lang, SCHEDULE_DAYS, INTENSITY_PER_DAY[intensity]
      );
      registerPushToken(lang, data.user.country);
    }
  };

  const login = async (email: string, password: string) => {
    const { data } = await api.post("/auth/login", { email, password });
    await applySession(data);
  };

  const loginWithGoogle = async (idToken: string, language: Lang, country: string) => {
    const { data } = await api.post("/auth/google", {
      id_token: idToken,
      language,
      country,
    });
    await applySession(data);
    return data.created as boolean;
  };

  const register = async (
    email: string, password: string, name: string, language: Lang, country: string,
    security_question?: string, security_answer?: string
  ) => {
    const payload: any = { email, password, name, language, country };
    if (security_question && security_answer) {
      payload.security_question = security_question;
      payload.security_answer = security_answer;
    }
    const { data } = await api.post("/auth/register", payload);
    await applySession(data);
  };

  const logout = async () => {
    await AsyncStorage.multiRemove([ACCESS_KEY, REFRESH_KEY, USER_CACHE_KEY]);
    // Back to browsing as a guest rather than to a locked door: leaving your
    // account should not mean losing the app.
    await startAsGuest();
  };

  const updateUser = async (patch: Partial<User>) => {
    const { data } = await api.patch("/auth/me", patch);
    setUser(data);
    await AsyncStorage.setItem(USER_CACHE_KEY, JSON.stringify(data));
    if (data?.language) {
      await AsyncStorage.setItem(LANG_KEY, data.language);
    }
    return data as User;
  };

  const setLanguage = async (lang: Lang) => {
    const updated = await updateUser({ language: lang });
    // Notifications are written when they are queued, not when they fire, so
    // the ones already waiting still carry the old language. Switching to
    // Italian and then getting an English notification hours later makes the
    // app look broken. Rewrite the queue in the new language.
    if (!updated?.notifications_enabled) return;
    try {
      const { window, intensity } = await readNotifPrefs();
      await scheduleRandomDailyNotifications(
        window, lang, SCHEDULE_DAYS, INTENSITY_PER_DAY[intensity]
      );
      registerPushToken(lang, updated.country);
    } catch {}
  };

  return (
    <AuthContext.Provider value={{ user, login, loginWithGoogle, register, logout, updateUser, setLanguage, refreshMe: loadMe }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
};
