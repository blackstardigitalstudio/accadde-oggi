import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
export const API_URL = `${BASE_URL}/api`;

export const ACCESS_KEY = "accadde:access";
export const REFRESH_KEY = "accadde:refresh";

const api = axios.create({ baseURL: API_URL, timeout: 30000 });

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem(ACCESS_KEY);
  if (token) {
    config.headers = config.headers || {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let refreshQueue: Array<(token: string | null) => void> = [];

const flushQueue = (token: string | null) => {
  refreshQueue.forEach((cb) => cb(token));
  refreshQueue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    // Skip refresh for auth endpoints that don't need it (login/register/refresh/forgot).
    // BUT /auth/me MUST trigger refresh so the app stays logged in across access-token expiry.
    const url: string = original?.url || "";
    const skipRefresh =
      url.includes("/auth/login") ||
      url.includes("/auth/register") ||
      url.includes("/auth/refresh") ||
      url.includes("/auth/forgot");

    if (error.response?.status === 401 && !original._retry && !skipRefresh) {
      original._retry = true;
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push((token) => {
            if (token) {
              original.headers.Authorization = `Bearer ${token}`;
              resolve(api(original));
            } else {
              reject(error);
            }
          });
        });
      }
      isRefreshing = true;
      try {
        const refresh = await AsyncStorage.getItem(REFRESH_KEY);
        if (!refresh) throw new Error("no refresh");
        const { data } = await axios.post(`${API_URL}/auth/refresh`, { refresh_token: refresh });
        await AsyncStorage.setItem(ACCESS_KEY, data.access_token);
        original.headers.Authorization = `Bearer ${data.access_token}`;
        flushQueue(data.access_token);
        return api(original);
      } catch (e) {
        flushQueue(null);
        await AsyncStorage.multiRemove([ACCESS_KEY, REFRESH_KEY]);
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export default api;
