import { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { LogOut, Heart, Bookmark, ThumbsDown, Globe, ChevronRight } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/contexts/AuthContext";
import api from "../../src/api/client";
import { COLORS, categoryColor } from "../../src/theme";
import { t, T, LANGS, Lang } from "../../src/i18n/translations";
import { COUNTRIES, countryFlag } from "../../src/i18n/countries";

type Stats = {
  likes: number;
  dislikes: number;
  saves: number;
  top_categories: { category: string; count: number }[];
};

export default function Profile() {
  const { user, logout, updateUser } = useAuth();
  const router = useRouter();
  const lang = (user?.language as Lang) || "it";
  const [stats, setStats] = useState<Stats | null>(null);
  const [showCountry, setShowCountry] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const { data } = await api.get("/events/stats");
      setStats(data);
    } catch {}
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  const doLogout = () => {
    Alert.alert(
      T[lang].logout,
      "?",
      [
        { text: "Annulla", style: "cancel" },
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

  const toggleNotif = async () => {
    await updateUser({ notifications_enabled: !user?.notifications_enabled });
  };

  return (
    <SafeAreaView style={styles.c} testID="profile-screen" edges={["top"]}>
      <LinearGradient colors={["#0a0a0a", "#050505"]} style={StyleSheet.absoluteFillObject} />
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(user?.name || user?.email || "U").slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.name} testID="profile-name">{user?.name || "—"}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          {user?.created_at && (
            <Text style={styles.since}>
              {t(lang, "memberSince")} {new Date(user.created_at).toLocaleDateString()}
            </Text>
          )}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox} testID="stat-likes">
            <Heart color={COLORS.like} size={22} fill={COLORS.like} strokeWidth={0} />
            <Text style={styles.statNum}>{stats?.likes ?? 0}</Text>
            <Text style={styles.statLabel}>{t(lang, "totalLikes").toUpperCase()}</Text>
          </View>
          <View style={styles.statBox} testID="stat-saves">
            <Bookmark color={COLORS.textPrimary} size={22} fill={COLORS.textPrimary} strokeWidth={0} />
            <Text style={styles.statNum}>{stats?.saves ?? 0}</Text>
            <Text style={styles.statLabel}>{t(lang, "totalSaves").toUpperCase()}</Text>
          </View>
          <View style={styles.statBox} testID="stat-dislikes">
            <ThumbsDown color={COLORS.textMuted} size={22} strokeWidth={2} />
            <Text style={styles.statNum}>{stats?.dislikes ?? 0}</Text>
            <Text style={styles.statLabel}>DISLIKE</Text>
          </View>
        </View>

        {stats && stats.top_categories && stats.top_categories.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{t(lang, "topCats").toUpperCase()}</Text>
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
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t(lang, "settings").toUpperCase()}</Text>

          <View style={styles.settingGroup}>
            <Text style={styles.settingTitle}>{t(lang, "language").toUpperCase()}</Text>
            <View style={styles.langRow}>
              {LANGS.map((l) => (
                <TouchableOpacity
                  key={l.code}
                  testID={`set-lang-${l.code}`}
                  onPress={() => setLang(l.code)}
                  style={[styles.langChip, lang === l.code && styles.langChipActive]}
                >
                  <Text style={styles.langFlag}>{l.flag}</Text>
                  <Text style={[styles.langText, lang === l.code && styles.langTextActive]}>
                    {l.code.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity
            testID="country-toggle"
            style={styles.settingRow}
            onPress={() => setShowCountry((s) => !s)}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.settingTitle}>PAESE</Text>
              <Text style={styles.settingValue}>
                {countryFlag(user?.country || "IT")}{"  "}
                {COUNTRIES.find((x) => x.code === user?.country)?.[
                  lang === "it" ? "label_it" : lang === "es" ? "label_es" : "label_en"
                ] || user?.country}
              </Text>
            </View>
            <ChevronRight color={COLORS.textMuted} size={20} style={{ transform: [{ rotate: showCountry ? "90deg" : "0deg" }] }} />
          </TouchableOpacity>
          {showCountry && (
            <View style={styles.countryGrid}>
              {COUNTRIES.map((cn) => (
                <TouchableOpacity
                  key={cn.code}
                  testID={`set-country-${cn.code}`}
                  style={[styles.countryOpt, user?.country === cn.code && styles.countryOptActive]}
                  onPress={() => setCountry(cn.code)}
                >
                  <Text style={styles.langFlag}>{cn.flag}</Text>
                  <Text style={[styles.countryOptText, user?.country === cn.code && { color: "#050505" }]}>
                    {lang === "it" ? cn.label_it : lang === "es" ? cn.label_es : cn.label_en}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingTitle}>{t(lang, "notifications").toUpperCase()}</Text>
              <Text style={styles.settingHint}>Avvisi quotidiani</Text>
            </View>
            <Switch
              testID="notifications-toggle"
              value={!!user?.notifications_enabled}
              onValueChange={toggleNotif}
              trackColor={{ true: COLORS.like, false: COLORS.textMuted }}
              thumbColor="#fff"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t(lang, "about").toUpperCase()}</Text>
          <Text style={styles.aboutText}>{t(lang, "aboutText")}</Text>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={doLogout} testID="logout-button">
          <LogOut color={COLORS.like} size={18} strokeWidth={2.5} />
          <Text style={styles.logoutText}>{t(lang, "logout").toUpperCase()}</Text>
        </TouchableOpacity>
      </ScrollView>
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
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center", justifyContent: "center",
    gap: 10, marginTop: 30, marginHorizontal: 24,
    paddingVertical: 16,
    borderWidth: 1, borderColor: COLORS.like, borderRadius: 8,
  },
  logoutText: { color: COLORS.like, fontSize: 13, fontWeight: "900", letterSpacing: 2 },
});
