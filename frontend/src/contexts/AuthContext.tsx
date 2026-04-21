import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api, { ACCESS_KEY, REFRESH_KEY } from "../api/client";
import { Lang } from "../i18n/translations";
import { scheduleRandomDailyNotifications, getScheduledInfo } from "../services/notifications";

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
  created_at?: string;
};

type AuthState = {
  user: User | null | undefined; // undefined = loading
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string, password: string, name: string, language: Lang, country: string,
    security_question?: string, security_answer?: string
  ) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (patch: Partial<User>) => Promise<void>;
  setLanguage: (lang: Lang) => Promise<void>;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  const ensureNotificationsScheduled = async (lang: Lang) => {
    try {
      const info = await getScheduledInfo();
      // Only (re)schedule if nothing is queued yet — avoids thrashing
      if (info.count < 5) {
        await scheduleRandomDailyNotifications("random", lang, 30, 3);
      }
    } catch {}
  };

  const loadMe = useCallback(async () => {
    const token = await AsyncStorage.getItem(ACCESS_KEY);
    if (!token) {
      setUser(null);
      return;
    }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
      if (data?.notifications_enabled) {
        ensureNotificationsScheduled(data.language || "it");
      }
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  const persistTokens = async (access: string, refresh: string) => {
    await AsyncStorage.setItem(ACCESS_KEY, access);
    await AsyncStorage.setItem(REFRESH_KEY, refresh);
  };

  const login = async (email: string, password: string) => {
    const { data } = await api.post("/auth/login", { email, password });
    await persistTokens(data.access_token, data.refresh_token);
    setUser(data.user);
    if (data.user?.notifications_enabled) {
      scheduleRandomDailyNotifications("random", data.user.language || "it", 30, 3);
    }
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
    await persistTokens(data.access_token, data.refresh_token);
    setUser(data.user);
    // Default ON after registration - 3 notifications per day with random times
    if (data.user?.notifications_enabled) {
      scheduleRandomDailyNotifications("random", language, 30, 3);
    }
  };

  const logout = async () => {
    await AsyncStorage.multiRemove([ACCESS_KEY, REFRESH_KEY]);
    setUser(null);
  };

  const updateUser = async (patch: Partial<User>) => {
    const { data } = await api.patch("/auth/me", patch);
    setUser(data);
  };

  const setLanguage = async (lang: Lang) => {
    await updateUser({ language: lang });
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, updateUser, setLanguage, refreshMe: loadMe }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
};
