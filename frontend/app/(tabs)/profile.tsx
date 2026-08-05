import { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, Modal, TextInput, ActivityIndicator, Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { LogOut, Heart, Bookmark, ThumbsDown, ChevronRight, Bell, Sun, Moon, Shield, X, Coffee } from "lucide-react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  useAuth, readNotifPrefs, NOTIF_WINDOW_KEY, NOTIF_INTENSITY_KEY,
} from "../../src/contexts/AuthContext";
import { useTheme } from "../../src/contexts/ThemeContext";
import api from "../../src/api/client";
import { COLORS, categoryColor } from "../../src/theme";
import { t, tp, T, LANGS, Lang } from "../../src/i18n/translations";
import { COUNTRIES, countryFlag, countryLabel } from "../../src/i18n/countries";
import { INTERESTS, subLabel } from "../../src/i18n/interests";
import { SECURITY_QUESTIONS, SECURITY_LABELS } from "../../src/i18n/security";
import MadeInItaly from "../../src/components/MadeInItaly";
import {
  scheduleRandomDailyNotifications, cancelAllNotifications, getScheduledInfo, sendPreviewNotification,
  Window, Intensity, INTENSITY_PER_DAY, SCHEDULE_DAYS,
} from "../../src/services/notifications";

const PAYPAL_URL = "https://paypal.me/cipollino66";

type Stats = {
  likes: number;
  dislikes: number;
  saves: number;
  top_categories: { category: string; count: number }[];
};

export default function Profile() {
  const { user, logout, updateUser, refreshMe } = useAuth();
  const { colors, mode, toggle: toggleTheme } = useTheme();
  const router = useRouter();
  const lang = (user?.language as Lang) || "it";
  const [stats, setStats] = useState<Stats | null>(null);
  const [showCountry, setShowCountry] = useState(false);
  const [notifWindow, setNotifWindow] = useState<Window>("random");
  const [notifIntensity, setNotifIntensity] = useState<Intensity>("normal");
  const [notifInfo, setNotifInfo] = useState<{ count: number; nextDate?: Date; nextTitle?: string; nextBody?: string }>({ count: 0 });
  const [previewSending, setPreviewSending] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [secModalOpen, setSecModalOpen] = useState(false);
  const [secCurrentPw, setSecCurrentPw] = useState("");
  const [secQid, setSecQid] = useState("pet");
  const [secCustom, setSecCustom] = useState("");
  const [secAnswer, setSecAnswer] = useState("");
  const [secSaving, setSecSaving] = useState(false);
  const [secErr, setSecErr] = useState("");

  const SEC_WARN_COLOR = "#FFB547";

  const loadStats = useCallback(async () => {
    try {
      const { data } = await api.get("/events/stats");
      setStats(data);
    } catch {}
  }, []);

  const loadNotifInfo = useCallback(async () => {
    const info = await getScheduledInfo();
    setNotifInfo(info);
  }, []);

  const loadNotifPrefs = useCallback(async () => {
    const prefs = await readNotifPrefs();
    setNotifWindow(prefs.window);
    setNotifIntensity(prefs.intensity);
  }, []);

  useEffect(() => {
    loadStats();
    loadNotifInfo();
    loadNotifPrefs();
  }, [loadStats, loadNotifInfo, loadNotifPrefs]);

  const doLogout = () => {
    Alert.alert(
      T[lang].logout,
      t(lang, "logoutConfirm"),
      [
        { text: t(lang, "cancel"), style: "cancel" },
        {
          text: T[lang].logout,
          style: "destructive",
          onPress: async () => {
            await logout();
            router.replace("/auth/login");
          },
        },
      ]
    );
  };

  const setLang = async (newLang: Lang) => {
    await updateUser({ language: newLang });
  };

  const setCountry = async (code: string) => {
    await updateUser({ country: code });
    setShowCountry(false);
  };

  const reschedule = async (w: Window, intensity: Intensity) => {
    return scheduleRandomDailyNotifications(w, lang, SCHEDULE_DAYS, INTENSITY_PER_DAY[intensity]);
  };

  const toggleNotif = async () => {
    const newState = !user?.notifications_enabled;
    if (newState) {
      const res = await reschedule(notifWindow, notifIntensity);
      if (!res.ok) {
      Alert.alert(
        t(lang, "permissionsNeeded"),
        t(lang, "permissionsNotifHint")
      );
        return;
      }
    } else {
      await cancelAllNotifications();
    }
    await updateUser({ notifications_enabled: newState });
    await loadNotifInfo();
  };

  const changeWindow = async (w: Window) => {
    setNotifWindow(w);
    await AsyncStorage.setItem(NOTIF_WINDOW_KEY, w);
    if (user?.notifications_enabled) {
      await reschedule(w, notifIntensity);
      await loadNotifInfo();
    }
  };

  const changeIntensity = async (intensity: Intensity) => {
    setNotifIntensity(intensity);
    await AsyncStorage.setItem(NOTIF_INTENSITY_KEY, intensity);
    if (user?.notifications_enabled) {
      await reschedule(notifWindow, intensity);
      await loadNotifInfo();
    }
  };

  const doPreviewNotif = async () => {
    setPreviewSending(true);
    const ok = await sendPreviewNotification(lang);
    setPreviewSending(false);
    if (!ok) {
      Alert.alert(
        t(lang, "permissionsNeeded"),
        t(lang, "permissionsPreviewHint")
      );
    } else {
      // Also refresh info
      setTimeout(loadNotifInfo, 500);
    }
  };

  const saveSecurityQuestion = async () => {
    setSecErr("");
    const selected = SECURITY_QUESTIONS[lang].find((q) => q.id === secQid);
    const qText = secQid === "custom" ? secCustom.trim() : (selected?.label || "");
    const aText = secAnswer.trim();
    // Google accounts have no password to confirm — the session itself is the proof.
    const needsPassword = user?.has_password !== false;
    if ((needsPassword && !secCurrentPw) || !qText || qText.length < 3 || !aText || aText.length < 2) {
      setSecErr(
        t(lang, "fillAllFields")
      );
      return;
    }
    setSecSaving(true);
    try {
      await api.patch("/auth/security-question", {
        current_password: secCurrentPw,
        question: qText,
        answer: aText,
      });
      await refreshMe();
      setSecModalOpen(false);
      setSecCurrentPw("");
      setSecCustom("");
      setSecAnswer("");
      Alert.alert("✓", t(lang, "updated"));
    } catch (e: any) {
      const d = e?.response?.data?.detail;
      setSecErr(typeof d === "string" ? d : t(lang, "unknownError"));
    } finally {
      setSecSaving(false);
    }
  };

  /** Wipe the likes that build the "top categories" list. */
  const clearLikes = () => {
    Alert.alert(
      t(lang, "clearTopCats"),
      t(lang, "clearTopCatsConfirm"),
      [
        { text: t(lang, "cancel"), style: "cancel" },
        {
          text: t(lang, "clearTopCats"),
          style: "destructive",
          onPress: async () => {
            setClearing(true);
            try {
              await api.post("/events/reset", { types: ["like", "dislike"] });
              await loadStats();
            } catch {}
            setClearing(false);
          },
        },
      ]
    );
  };

  /** Untick every interest at once. */
  const clearInterests = async () => {
    await updateUser({ interests: [] });
  };

  const toggleInterest = async (key: string) => {
    const current = new Set(user?.interests || []);
    if (current.has(key)) current.delete(key);
    else current.add(key);
    await updateUser({ interests: Array.from(current) });
  };

  const interestsSet = new Set(user?.interests || []);

  return (
    <SafeAreaView style={[styles.c, { backgroundColor: colors.bg }]} testID="profile-screen" edges={["top"]}>
      {mode === "dark" && (
        <LinearGradient colors={["#0a0a0a", "#050505"]} style={StyleSheet.absoluteFillObject} />
      )}
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(user?.name || user?.email || "U").slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <Text style={[styles.name, { color: colors.textPrimary }]} testID="profile-name">{user?.name || "—"}</Text>
          <Text style={[styles.email, { color: colors.textSecondary }]}>{user?.email}</Text>
          {user?.auth_provider === "google" && (
            <Text style={[styles.since, { color: colors.textMuted }]} testID="profile-google-hint">
              🔑 {t(lang, "googleAccountHint")}
            </Text>
          )}
          {user?.created_at && (
            <Text style={[styles.since, { color: colors.textMuted }]}>
              {t(lang, "memberSince")} {new Date(user.created_at).toLocaleDateString()}
            </Text>
          )}
        </View>

        {/* Theme toggle — prominent */}
        <View style={styles.themeToggleWrap}>
          <TouchableOpacity
            testID="theme-toggle"
            onPress={toggleTheme}
            style={[styles.themeToggle, { backgroundColor: colors.surface, borderColor: colors.border }]}
            activeOpacity={0.8}
          >
            {mode === "dark" ? (
              <Moon size={18} color={colors.textPrimary} strokeWidth={2.2} />
            ) : (
              <Sun size={18} color={colors.textPrimary} strokeWidth={2.2} />
            )}
            <Text style={[styles.themeToggleText, { color: colors.textPrimary }]}>
              {mode === "dark" ? t(lang, "darkTheme") : t(lang, "lightTheme")}
            </Text>
            <View style={[styles.themeSwitchPill, { backgroundColor: mode === "dark" ? COLORS.like : "#FCA311" }]}>
              <Text style={styles.themeSwitchPillText}>
                {mode === "dark" ? "→ ☀️" : "→ 🌙"}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statBox, { backgroundColor: colors.surface, borderColor: colors.border }]} testID="stat-likes">
            <Heart color={colors.like} size={22} fill={colors.like} strokeWidth={0} />
            <Text style={[styles.statNum, { color: colors.textPrimary }]}>{stats?.likes ?? 0}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t(lang, "totalLikes").toUpperCase()}</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.surface, borderColor: colors.border }]} testID="stat-saves">
            <Bookmark color={colors.textPrimary} size={22} fill={colors.textPrimary} strokeWidth={0} />
            <Text style={[styles.statNum, { color: colors.textPrimary }]}>{stats?.saves ?? 0}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t(lang, "totalSaves").toUpperCase()}</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.surface, borderColor: colors.border }]} testID="stat-dislikes">
            <ThumbsDown color={colors.textMuted} size={22} strokeWidth={2} />
            <Text style={[styles.statNum, { color: colors.textPrimary }]}>{stats?.dislikes ?? 0}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t(lang, "totalDislikes").toUpperCase()}</Text>
          </View>
        </View>

        {stats && stats.top_categories && stats.top_categories.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t(lang, "topCats").toUpperCase()}</Text>
            {/* Say where this list comes from. It is computed from likes, not
                from the interests below — without this line the two look like
                the same setting and the missing "save" button reads as a bug. */}
            <Text style={[styles.interestsHint, { color: colors.textMuted }]}>
              {t(lang, "topCatsHint")}
            </Text>
            <View style={styles.catsList}>
              {stats.top_categories.map((c) => (
                <View key={c.category} style={[styles.catPill, { borderColor: categoryColor(c.category) }]}>
                  <View style={[styles.catDot, { backgroundColor: categoryColor(c.category) }]} />
                  <Text style={[styles.catPillText, { color: categoryColor(c.category) }]}>
                    {t(lang, c.category as any).toUpperCase()}
                  </Text>
                  <Text style={styles.catPillCount}>{c.count}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity
              testID="clear-top-cats"
              onPress={clearLikes}
              disabled={clearing}
              style={[styles.clearBtn, { borderColor: colors.border, opacity: clearing ? 0.5 : 1 }]}
              accessibilityRole="button"
            >
              <Text style={[styles.clearBtnText, { color: colors.like }]}>
                {t(lang, "clearTopCats").toUpperCase()}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t(lang, "settings").toUpperCase()}</Text>

          <View style={styles.settingGroup}>
            <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>{t(lang, "language").toUpperCase()}</Text>
            <View style={styles.langRow}>
              {LANGS.map((l) => (
                <TouchableOpacity
                  key={l.code}
                  testID={`set-lang-${l.code}`}
                  onPress={() => setLang(l.code)}
                  style={[styles.langChip, { borderColor: colors.border }, lang === l.code && { backgroundColor: colors.textPrimary, borderColor: colors.textPrimary }]}
                >
                  <Text style={styles.langFlag}>{l.flag}</Text>
                  <Text style={[styles.langText, { color: colors.textSecondary }, lang === l.code && { color: colors.bg }]}>
                    {l.code.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity
            testID="country-toggle"
            style={[styles.settingRow, { borderTopColor: colors.border }]}
            onPress={() => setShowCountry((s) => !s)}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>{t(lang, "country").toUpperCase()}</Text>
              <Text style={[styles.settingValue, { color: colors.textSecondary }]}>
                {countryFlag(user?.country || "IT")}{"  "}
                {countryLabel(user?.country || "IT", lang)}
              </Text>
            </View>
            <ChevronRight color={colors.textMuted} size={20} style={{ transform: [{ rotate: showCountry ? "90deg" : "0deg" }] }} />
          </TouchableOpacity>
          {showCountry && (
            <View style={styles.countryGrid}>
              {COUNTRIES.map((cn) => (
                <TouchableOpacity
                  key={cn.code}
                  testID={`set-country-${cn.code}`}
                  style={[styles.countryOpt, { borderColor: colors.border }, user?.country === cn.code && { backgroundColor: colors.like, borderColor: colors.like }]}
                  onPress={() => setCountry(cn.code)}
                >
                  <Text style={styles.langFlag}>{cn.flag}</Text>
                  <Text style={[styles.countryOptText, { color: colors.textSecondary }, user?.country === cn.code && { color: "#fff" }]}>
                    {countryLabel(cn.code, lang)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={[styles.settingRow, { borderTopColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>{t(lang, "notifications").toUpperCase()}</Text>
              <Text style={[styles.settingHint, { color: colors.textMuted }]}>
                {user?.notifications_enabled
                  ? `${t(lang, `intensity${notifIntensity === "soft" ? "Soft" : notifIntensity === "max" ? "Max" : "Normal"}Hint` as any)} · ${notifInfo.count} ${t(lang, "nProgrammate")}`
                  : t(lang, "notificationsDisabled")}
              </Text>
            </View>
            <Switch
              testID="notifications-toggle"
              value={!!user?.notifications_enabled}
              onValueChange={toggleNotif}
              trackColor={{ true: COLORS.like, false: COLORS.textMuted }}
              thumbColor="#fff"
            />
          </View>

          {user?.notifications_enabled && (
            <View style={styles.hourPickerBox}>
              {/* How many — three tiles, one tap, the number spelled out. */}
              <Text style={styles.hourLabel}>{t(lang, "notifIntensity")}</Text>
              <View style={styles.intensityGrid}>
                {([
                  { id: "soft" as Intensity, icon: "🌱", label: t(lang, "intensitySoft"), hint: t(lang, "intensitySoftHint") },
                  { id: "normal" as Intensity, icon: "⚡", label: t(lang, "intensityNormal"), hint: t(lang, "intensityNormalHint") },
                  { id: "max" as Intensity, icon: "🔥", label: t(lang, "intensityMax"), hint: t(lang, "intensityMaxHint") },
                ]).map((opt) => {
                  const active = notifIntensity === opt.id;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      testID={`notif-intensity-${opt.id}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`${opt.label} — ${opt.hint}`}
                      style={[
                        styles.intensityTile,
                        { borderColor: colors.border },
                        active && { backgroundColor: colors.like, borderColor: colors.like },
                      ]}
                      onPress={() => changeIntensity(opt.id)}
                    >
                      <Text style={styles.intensityIcon}>{opt.icon}</Text>
                      <Text style={[styles.intensityLabel, { color: colors.textPrimary }, active && { color: "#fff" }]}>
                        {opt.label}
                      </Text>
                      <Text style={[styles.intensityHint, { color: colors.textMuted }, active && { color: "rgba(255,255,255,0.85)" }]}>
                        {opt.hint}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.hourLabel, { marginTop: 18 }]}>
                {t(lang, "notificationsWindow")}
              </Text>
              <View style={styles.windowGrid}>
                {([
                  { id: "morning" as Window, label: `${t(lang, "windowMorning")} 7–10`, icon: "☀️" },
                  { id: "afternoon" as Window, label: `${t(lang, "windowAfternoon")} 12–16`, icon: "🌤️" },
                  { id: "evening" as Window, label: `${t(lang, "windowEvening")} 18–22`, icon: "🌙" },
                  { id: "random" as Window, label: `${t(lang, "windowRandom")} 8–22`, icon: "🎲" },
                ]).map((w) => (
                  <TouchableOpacity
                    key={w.id}
                    testID={`notif-window-${w.id}`}
                    style={[styles.windowChip, notifWindow === w.id && styles.windowChipActive]}
                    onPress={() => changeWindow(w.id)}
                  >
                    <Text style={styles.windowIcon}>{w.icon}</Text>
                    <Text style={[styles.windowText, notifWindow === w.id && { color: "#050505" }]}>
                      {w.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {notifInfo.nextDate && (
                <View style={[styles.notifPreview, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.notifPreviewLabel, { color: colors.textMuted }]}>
                    {t(lang, "notificationPreviewLabel")}
                  </Text>
                  {notifInfo.nextTitle && (
                    <Text style={[styles.notifPreviewTitle, { color: colors.textPrimary }]} numberOfLines={2}>
                      {notifInfo.nextTitle}
                    </Text>
                  )}
                  {notifInfo.nextBody && (
                    <Text style={[styles.notifPreviewBody, { color: colors.textSecondary }]} numberOfLines={3}>
                      {notifInfo.nextBody}
                    </Text>
                  )}
                  <View style={styles.notifPreviewFooter}>
                    <Bell size={11} color={colors.textMuted} />
                    <Text style={[styles.nextHint, { color: colors.textMuted, marginTop: 0, marginLeft: 4 }]}>
                      {t(lang, "next")}:{" "}
                      {notifInfo.nextDate.toLocaleString()}
                    </Text>
                  </View>
                </View>
              )}

              <TouchableOpacity
                testID="notif-preview-btn"
                onPress={doPreviewNotif}
                disabled={previewSending}
                style={[styles.previewBtn, { backgroundColor: colors.like, opacity: previewSending ? 0.6 : 1 }]}
                activeOpacity={0.85}
              >
                <Bell size={14} color="#fff" strokeWidth={2.5} />
                <Text style={styles.previewBtnText}>
                  {previewSending
                    ? t(lang, "sendingNotif")
                    : t(lang, "tryNotification")}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
            {t(lang, "interestsTitle")}
          </Text>
          <Text style={[styles.interestsHint, { color: colors.textMuted }]}>
            {t(lang, "interestsHint")}
          </Text>
          {/* There is no save button because there is nothing to save: a tap is
              already stored. Saying so removes the doubt, and the reset gives a
              way out — the thing that was missing before. */}
          <View style={styles.interestsToolbar}>
            <Text style={[styles.autoSaved, { color: colors.textMuted }]}>
              ✓ {t(lang, "savedAutomatically")}
            </Text>
            {interestsSet.size > 0 && (
              <TouchableOpacity
                testID="clear-interests"
                onPress={clearInterests}
                accessibilityRole="button"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={[styles.clearInline, { color: colors.like }]}>
                  {t(lang, "clearInterests")}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {Object.keys(INTERESTS).map((cat) => {
            const accent = categoryColor(cat);
            const catSelected = interestsSet.has(cat);
            return (
              <View key={cat} style={styles.interestCat}>
                <TouchableOpacity
                  testID={`interest-cat-${cat}`}
                  style={[styles.interestCatHead, { borderLeftColor: accent }, catSelected && { backgroundColor: "rgba(230,57,70,0.08)" }]}
                  onPress={() => toggleInterest(cat)}
                >
                  <View style={[styles.catDotLarge, { backgroundColor: accent }]} />
                  <Text style={[styles.interestCatText, { color: accent }]}>
                    {t(lang, cat as any).toUpperCase()}
                  </Text>
                  <View style={[styles.interestCheck, catSelected && { backgroundColor: accent, borderColor: accent }]}>
                    {catSelected && <Text style={styles.checkMark}>✓</Text>}
                  </View>
                </TouchableOpacity>
                <View style={styles.interestSubs}>
                  {INTERESTS[cat].map((sub) => {
                    const key = `${cat}.${sub.id}`;
                    const selected = interestsSet.has(key);
                    return (
                      <TouchableOpacity
                        key={key}
                        testID={`interest-sub-${key}`}
                        style={[styles.interestChip, { borderColor: colors.border }, selected && { backgroundColor: accent, borderColor: accent }]}
                        onPress={() => toggleInterest(key)}
                      >
                        <Text style={styles.interestIcon}>{sub.icon}</Text>
                        <Text style={[styles.interestChipText, { color: colors.textSecondary }, selected && { color: "#fff", fontWeight: "800" }]}>
                          {subLabel(sub, lang)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          })}
          <Text style={styles.interestsCount}>
            {tp(lang, "selectedSingular", "selectedPlural", interestsSet.size)}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
            🔐 {SECURITY_LABELS[lang].sectionTitle}
          </Text>
          {!user?.has_security_question && (
            <Text style={[styles.interestsHint, { color: SEC_WARN_COLOR }]}>
              ⚠️ {SECURITY_LABELS[lang].setSecurityHint}
            </Text>
          )}
          {user?.has_security_question && (
            <Text style={[styles.interestsHint, { color: colors.textMuted }]}>
              ✓ {SECURITY_LABELS[lang].changeSecurityHint}
            </Text>
          )}
          <TouchableOpacity
            testID="security-open-modal"
            style={[styles.secBtn, { backgroundColor: user?.has_security_question ? colors.border : colors.like }]}
            onPress={() => setSecModalOpen(true)}
          >
            <Shield size={16} color={user?.has_security_question ? colors.textPrimary : "#fff"} strokeWidth={2.5} />
            <Text style={[styles.secBtnText, { color: user?.has_security_question ? colors.textPrimary : "#fff" }]}>
              {(user?.has_security_question
                ? SECURITY_LABELS[lang].changeSecurity
                : SECURITY_LABELS[lang].setSecurity
              ).toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.aboutText}>{t(lang, "aboutText")}</Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t(lang, "support").toUpperCase()}</Text>
          <Text style={[styles.interestsHint, { color: colors.textMuted }]}>{t(lang, "supportHint")}</Text>
          <TouchableOpacity style={styles.coffeeBtn} onPress={() => Linking.openURL(PAYPAL_URL)} testID="buy-coffee">
            <Coffee size={16} color="#050505" strokeWidth={2.5} />
            <Text style={styles.coffeeText}>{t(lang, "buyCoffee").toUpperCase()}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={doLogout} testID="logout-button">
          <LogOut color={COLORS.like} size={18} strokeWidth={2.5} />
          <Text style={styles.logoutText}>{t(lang, "logout").toUpperCase()}</Text>
        </TouchableOpacity>

        <MadeInItaly style={{ marginTop: 28 }} />
      </ScrollView>

      {/* SECURITY QUESTION MODAL */}
      <Modal
        visible={secModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSecModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                {SECURITY_LABELS[lang].sectionTitle}
              </Text>
              <TouchableOpacity onPress={() => setSecModalOpen(false)} testID="security-close-modal">
                <X size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 520 }}>
              {user?.has_password !== false && (
                <>
                  <Text style={[styles.modalLabel, { color: colors.textMuted }]}>
                    {SECURITY_LABELS[lang].currentPassword.toUpperCase()}
                  </Text>
                  <TextInput
                    testID="security-current-password"
                    value={secCurrentPw}
                    onChangeText={setSecCurrentPw}
                    placeholder="••••••••"
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry
                    style={[styles.modalInput, { color: colors.textPrimary, borderColor: colors.border }]}
                  />
                </>
              )}

              <Text style={[styles.modalLabel, { color: colors.textMuted, marginTop: 16 }]}>
                {SECURITY_LABELS[lang].questionLabel.toUpperCase()}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginTop: 8 }}
                contentContainerStyle={{ gap: 8, paddingRight: 20 }}
              >
                {SECURITY_QUESTIONS[lang].map((q) => (
                  <TouchableOpacity
                    key={q.id}
                    testID={`security-q-${q.id}`}
                    style={[
                      styles.secQChip,
                      { borderColor: colors.border },
                      secQid === q.id && { backgroundColor: colors.like, borderColor: colors.like },
                    ]}
                    onPress={() => setSecQid(q.id)}
                  >
                    <Text
                      numberOfLines={2}
                      style={[
                        styles.secQChipText,
                        { color: colors.textSecondary },
                        secQid === q.id && { color: "#fff", fontWeight: "800" },
                      ]}
                    >
                      {q.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {secQid === "custom" && (
                <TextInput
                  testID="security-custom"
                  value={secCustom}
                  onChangeText={setSecCustom}
                  placeholder={SECURITY_LABELS[lang].customQuestion}
                  placeholderTextColor={colors.textMuted}
                  style={[styles.modalInput, { color: colors.textPrimary, borderColor: colors.border, marginTop: 10 }]}
                />
              )}

              <Text style={[styles.modalLabel, { color: colors.textMuted, marginTop: 16 }]}>
                {SECURITY_LABELS[lang].answerLabel.toUpperCase()}
              </Text>
              <TextInput
                testID="security-answer"
                value={secAnswer}
                onChangeText={setSecAnswer}
                placeholder={SECURITY_LABELS[lang].answerLabel}
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                style={[styles.modalInput, { color: colors.textPrimary, borderColor: colors.border }]}
              />

              {secErr ? <Text style={styles.secErr}>{secErr}</Text> : null}

              <TouchableOpacity
                testID="security-save"
                style={[styles.modalSaveBtn, { backgroundColor: colors.like, opacity: secSaving ? 0.6 : 1 }]}
                disabled={secSaving}
                onPress={saveSecurityQuestion}
              >
                {secSaving ? <ActivityIndicator color="#fff" /> : (
                  <Text style={styles.modalSaveBtnText}>
                    {SECURITY_LABELS[lang].saveSecurity.toUpperCase()}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: COLORS.bg },
  header: { alignItems: "center", paddingTop: 20, paddingBottom: 24 },
  avatar: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: COLORS.like,
    alignItems: "center", justifyContent: "center",
    borderWidth: 3, borderColor: COLORS.textPrimary,
  },
  avatarText: { color: "#fff", fontSize: 36, fontWeight: "900" },
  name: { color: COLORS.textPrimary, fontSize: 24, fontWeight: "900", marginTop: 14, letterSpacing: -0.5 },
  email: { color: COLORS.textSecondary, fontSize: 13, marginTop: 4 },
  since: { color: COLORS.textMuted, fontSize: 11, marginTop: 6, letterSpacing: 1 },
  themeToggleWrap: { paddingHorizontal: 24, marginBottom: 14 },
  themeToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  themeToggleText: { flex: 1, fontSize: 12, fontWeight: "800", letterSpacing: 2 },
  themeSwitchPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  themeSwitchPillText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: 24,
    gap: 10,
  },
  statBox: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statNum: { color: COLORS.textPrimary, fontSize: 24, fontWeight: "900", marginTop: 6 },
  statLabel: { color: COLORS.textMuted, fontSize: 9, fontWeight: "800", letterSpacing: 1.5, marginTop: 4 },
  section: { marginTop: 28, paddingHorizontal: 24 },
  sectionLabel: { color: COLORS.textMuted, fontSize: 10, letterSpacing: 3, fontWeight: "800", marginBottom: 12 },
  catsList: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catPill: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderRadius: 999,
  },
  catDot: { width: 8, height: 8, borderRadius: 4 },
  catPillText: { fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  catPillCount: { color: COLORS.textSecondary, fontSize: 11, fontWeight: "700" },
  settingGroup: { marginBottom: 18 },
  settingTitle: { color: COLORS.textPrimary, fontSize: 12, fontWeight: "800", letterSpacing: 2 },
  settingValue: { color: COLORS.textSecondary, fontSize: 14, marginTop: 4 },
  settingHint: { color: COLORS.textMuted, fontSize: 11, marginTop: 4 },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  langRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  langChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 999, borderWidth: 1, borderColor: COLORS.border,
  },
  langChipActive: { backgroundColor: COLORS.textPrimary, borderColor: COLORS.textPrimary },
  langFlag: { fontSize: 14 },
  langText: { color: COLORS.textSecondary, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  langTextActive: { color: "#050505" },
  countryGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10, marginBottom: 16,
  },
  countryOpt: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 999, borderWidth: 1, borderColor: COLORS.border,
  },
  countryOptActive: { backgroundColor: COLORS.like, borderColor: COLORS.like },
  countryOptText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: "700" },
  aboutText: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 20 },
  coffeeBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    marginTop: 14, paddingVertical: 14, borderRadius: 10, backgroundColor: "#FCA311",
  },
  coffeeText: { color: "#050505", fontSize: 13, fontWeight: "900", letterSpacing: 1.8 },
  hourPickerBox: { marginTop: 10, marginBottom: 6 },
  hourLabel: { color: COLORS.textMuted, fontSize: 10, letterSpacing: 2, fontWeight: "800", marginBottom: 10 },
  hourChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 999, borderWidth: 1, borderColor: COLORS.border,
  },
  hourChipActive: { backgroundColor: COLORS.textPrimary, borderColor: COLORS.textPrimary },
  hourText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: "800", letterSpacing: 1 },
  intensityGrid: { flexDirection: "row", gap: 8, marginBottom: 4 },
  intensityTile: {
    flex: 1,
    alignItems: "center",
    // Well past the 44px minimum, so it is easy to hit with a thumb.
    minHeight: 88,
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  intensityIcon: { fontSize: 22 },
  intensityLabel: { fontSize: 13, fontWeight: "800", marginTop: 6 },
  intensityHint: { fontSize: 11, fontWeight: "600", marginTop: 2 },
  windowGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  windowChip: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
    flexGrow: 1, minWidth: "45%",
  },
  windowChipActive: { backgroundColor: COLORS.like, borderColor: COLORS.like },
  windowIcon: { fontSize: 16 },
  windowText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: "700" },
  nextHint: { color: COLORS.textMuted, fontSize: 11, marginTop: 10, letterSpacing: 0.5 },
  notifPreview: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  notifPreviewLabel: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: 6,
    color: COLORS.textMuted,
  },
  notifPreviewTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  notifPreviewBody: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  notifPreviewFooter: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  previewBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: COLORS.like,
  },
  previewBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 2,
  },
  interestsHint: { color: COLORS.textMuted, fontSize: 12, lineHeight: 18, marginBottom: 14 },
  interestsToolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  autoSaved: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  clearInline: { fontSize: 12, fontWeight: "800", textDecorationLine: "underline" },
  clearBtn: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
  },
  clearBtnText: { fontSize: 11, fontWeight: "900", letterSpacing: 1.5 },
  interestCat: { marginBottom: 14 },
  interestCatHead: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 10, paddingHorizontal: 12,
    borderLeftWidth: 3, borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  catDotLarge: { width: 10, height: 10, borderRadius: 5 },
  interestCatText: { fontSize: 13, fontWeight: "900", letterSpacing: 2, flex: 1 },
  interestCheck: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 1.5, borderColor: COLORS.border,
    alignItems: "center", justifyContent: "center",
  },
  checkMark: { color: "#050505", fontSize: 12, fontWeight: "900" },
  interestSubs: {
    flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8, paddingLeft: 4,
  },
  interestChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 999, borderWidth: 1, borderColor: COLORS.border,
  },
  interestIcon: { fontSize: 14 },
  interestChipText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: "600" },
  interestsCount: {
    color: COLORS.textMuted, fontSize: 11, letterSpacing: 1.5, fontWeight: "700",
    textAlign: "right", marginTop: 6,
  },
  secBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 10,
  },
  secBtnText: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "flex-end",
  },
  modalCard: {
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    minHeight: 380,
    maxHeight: "88%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  modalLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
  },
  modalInput: {
    fontSize: 16,
    paddingVertical: 10,
    borderBottomWidth: 2,
    marginTop: 4,
  },
  secQChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    backgroundColor: "rgba(255,255,255,0.04)",
    maxWidth: 220,
  },
  secQChipText: { fontSize: 12, fontWeight: "600", lineHeight: 16 },
  secErr: { color: COLORS.like, fontSize: 13, fontWeight: "700", marginTop: 14, textAlign: "center" },
  modalSaveBtn: {
    marginTop: 24,
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 12,
  },
  modalSaveBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 2,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center", justifyContent: "center",
    gap: 10, marginTop: 30, marginHorizontal: 24,
    paddingVertical: 16,
    borderWidth: 1, borderColor: COLORS.like, borderRadius: 8,
  },
  logoutText: { color: COLORS.like, fontSize: 13, fontWeight: "900", letterSpacing: 2 },
});
