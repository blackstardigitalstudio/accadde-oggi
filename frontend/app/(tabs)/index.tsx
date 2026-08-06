import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, useWindowDimensions,
  ActivityIndicator, RefreshControl, TouchableOpacity,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../../src/contexts/AuthContext";
import { useTheme } from "../../src/contexts/ThemeContext";
import api from "../../src/api/client";
import EventCard, { EventData } from "../../src/components/EventCard";
import { COLORS } from "../../src/theme";
import { t, T, Lang } from "../../src/i18n/translations";
import { countryFlag } from "../../src/i18n/countries";
import { useTabBarHeight } from "../../src/hooks/useTabBarHeight";

export default function Feed() {
  const { user } = useAuth();
  const { colors, mode } = useTheme();
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Same source of truth as the bar itself: computing it here as well is what
  // left a 12px strip of the next card showing under every screen.
  const { height: tabBarHeight } = useTabBarHeight();
  const cardHeight = height - tabBarHeight;

  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const lang: Lang = (user?.language as Lang) || "it";

  const load = useCallback(async () => {
    setErr(null);
    try {
      const { data } = await api.get("/events/today", { params: { limit: 120 } });
      setEvents(data.events || []);
    } catch (e: any) {
      setErr(t(lang, "errorFeed"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [lang]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const handleInteract = async (id: string, action: "like" | "dislike" | "save" | "unsave") => {
    // Optimistic update
    setEvents((prev) =>
      prev.map((e) => {
        if (e.id !== id) return e;
        const patch: Partial<EventData> = {};
        if (action === "like") {
          patch.liked = !e.liked;
          if (patch.liked) patch.disliked = false;
        } else if (action === "dislike") {
          patch.disliked = !e.disliked;
          if (patch.disliked) patch.liked = false;
        } else if (action === "save") {
          patch.saved = !e.saved;
        }
        return { ...e, ...patch };
      })
    );
    try {
      await api.post("/events/interact", { event_id: id, action });
    } catch {}
  };

  const now = useMemo(() => {
    const d = new Date();
    const months =
      lang === "it"
        ? ["GEN", "FEB", "MAR", "APR", "MAG", "GIU", "LUG", "AGO", "SET", "OTT", "NOV", "DIC"]
        : lang === "es"
        ? ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"]
        : ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    return `${d.getDate()} ${months[d.getMonth()]}`;
  }, [lang]);

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems[0]) setActiveIndex(viewableItems[0].index || 0);
  }).current;

  if (loading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.bg }]} testID="feed-loading">
        {mode === "dark" && <LinearGradient colors={["#0a0a0a", "#050505"]} style={StyleSheet.absoluteFillObject} />}
        <Text style={[styles.brand, { color: colors.textPrimary }]}>{T[lang].accadde}</Text>
        <Text style={[styles.brand, { color: colors.like }]}>{T[lang].oggi}</Text>
        <ActivityIndicator color={colors.like} style={{ marginTop: 32 }} size="large" />
        <Text style={[styles.loadTxt, { color: colors.textSecondary }]}>{t(lang, "loadingFeed")}</Text>
      </SafeAreaView>
    );
  }

  if (err || events.length === 0) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.bg }]} testID="feed-error">
        <Text style={[styles.brand, { color: colors.textPrimary }]}>{T[lang].accadde}</Text>
        <Text style={[styles.brand, { color: colors.like }]}>{T[lang].oggi}</Text>
        <Text style={[styles.errText, { color: colors.textSecondary }]}>{err || t(lang, "errorFeed")}</Text>
        <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.like }]} onPress={load} testID="feed-retry">
          <Text style={styles.retryTxt}>{t(lang, "retry")}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]} testID="feed-screen">
      {/* Floating top header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.dateLabel}>{now.toUpperCase()}</Text>
            <Text style={[styles.headerBrand, { color: colors.textPrimary }]}>
              {T[lang].accadde} <Text style={{ color: colors.like }}>{T[lang].oggi}</Text>
            </Text>
          </View>
          <View style={styles.counterBox}>
            <Text style={[styles.counterNum, { color: colors.textPrimary }]}>
              {String(activeIndex + 1).padStart(2, "0")}
              <Text style={[styles.counterTotal, { color: colors.textMuted }]}>/{String(events.length).padStart(2, "0")}</Text>
            </Text>
            <Text style={[styles.counterLabel, { color: colors.textMuted }]}>{t(lang, "events").toUpperCase()}</Text>
          </View>
          <View style={[styles.countryBadge, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
            <Text style={styles.countryFlag}>{countryFlag(user?.country || "IT")}</Text>
          </View>
        </View>
      </View>

      <FlatList
        data={events}
        keyExtractor={(i) => i.id}
        snapToInterval={cardHeight}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.like} />
        }
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        onViewableItemsChanged={onViewableItemsChanged}
        renderItem={({ item }) => (
          <EventCard
            event={item}
            lang={lang}
            height={cardHeight}
            onLike={() => handleInteract(item.id, "like")}
            onDislike={() => handleInteract(item.id, "dislike")}
            onSave={() => handleInteract(item.id, "save")}
          />
        )}
        getItemLayout={(_, index) => ({
          length: cardHeight,
          offset: cardHeight * index,
          index,
        })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: {
    flex: 1, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center", padding: 24,
  },
  brand: { color: COLORS.textPrimary, fontSize: 48, fontWeight: "900", letterSpacing: -2, lineHeight: 50 },
  loadTxt: { color: COLORS.textSecondary, marginTop: 16, letterSpacing: 2, fontSize: 11 },
  errText: { color: COLORS.textSecondary, marginTop: 20, fontSize: 13 },
  retryBtn: { marginTop: 16, backgroundColor: COLORS.like, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 8 },
  retryTxt: { color: "#fff", fontWeight: "800", letterSpacing: 2 },
  header: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    zIndex: 10,
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: "rgba(5,5,5,0.92)",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dateLabel: { color: COLORS.like, fontSize: 11, fontWeight: "800", letterSpacing: 3 },
  headerBrand: { color: COLORS.textPrimary, fontSize: 22, fontWeight: "900", letterSpacing: -1, marginTop: 2 },
  counterBox: { alignItems: "center" },
  counterNum: { color: COLORS.textPrimary, fontSize: 18, fontWeight: "900" },
  counterTotal: { color: COLORS.textMuted, fontSize: 14 },
  counterLabel: { color: COLORS.textMuted, fontSize: 9, letterSpacing: 2, fontWeight: "700" },
  countryBadge: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1, borderColor: COLORS.border,
    alignItems: "center", justifyContent: "center",
  },
  countryFlag: { fontSize: 20 },
});
