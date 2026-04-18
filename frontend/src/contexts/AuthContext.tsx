import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api, { ACCESS_KEY, REFRESH_KEY } from "../api/client";
import { Lang } from "../i18n/translations";

export type User = {
  id: string;
  email: string;
  name: string;
  role: string;
  language: Lang;
  country: string;
  notifications_enabled: boolean;
  created_at?: string;
};

type AuthState = {
  user: User | null | undefined; // undefined = loading
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, language: Lang, country: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (patch: Partial<User>) => Promise<void>;
  setLanguage: (lang: Lang) => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  const loadMe = useCallback(async () => {
    const token = await AsyncStorage.getItem(ACCESS_KEY);
    if (!token) {
      setUser(null);
      return;
    }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
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
  };

  const register = async (email: string, password: string, name: string, language: Lang, country: string) => {
    const { data } = await api.post("/auth/register", { email, password, name, language, country });
    await persistTokens(data.access_token, data.refresh_token);
    setUser(data.user);
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
    <AuthContext.Provider value={{ user, login, register, logout, updateUser, setLanguage }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
};
