import { useCallback, useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, useWindowDimensions, ImageBackground,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Globe, MapPin } from "lucide-react-native";
import { useLocalSearchParams } from "expo-router";
import { useAuth } from "../../src/contexts/AuthContext";
import { useTheme } from "../../src/contexts/ThemeContext";
import api from "../../src/api/client";
import { COLORS, categoryColor } from "../../src/theme";
import { t, tp } from "../../src/i18n/translations";
import { countryFlag } from "../../src/i18n/countries";
import { EventData } from "../../src/components/EventCard";
import { proxyImage } from "../../src/utils/image";

const CATS = ["wars", "science", "culture", "sports", "politics"];
const DECADES = [1900, 1920, 1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020];

export default function Explore() {
  const { user } = useAuth();
  const { colors, mode } = useTheme();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ category?: string; scope?: string }>();
  const lang = (user?.language as any) || "it";

  const [activeCat, setActiveCat] = useState<string | null>(
    (typeof params.category === "string" && CATS.includes(params.category)) ? params.category : null
  );
  const [activeDecade, setActiveDecade] = useState<number | null>(null);
  const [activeScope, setActiveScope] = useState<"all" | "global" | "local">(
    (params.scope === "global" || params.scope === "local") ? params.scope : "all"
  );
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { limit: 50, scope: activeScope };
      if (activeCat) params.category = activeCat;
      if (activeDecade !== null) params.decade = activeDecade;
      const { data } = await api.get("/events/today", { params });
      setEvents(data.events || []);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [activeCat, activeDecade, activeScope]);

  useEffect(() => { load(); }, [load]);

  const tileW = (width - 48 - 12) / 2;

  return (
    <SafeAreaView style={[styles.c, { backgroundColor: colors.bg }]} testID="explore-screen" edges={["top"]}>
      {mode === "dark" && (
        <LinearGradient colors={["#0a0a0a", "#050505"]} style={StyleSheet.absoluteFillObject} />
      )}
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{t(lang, "explore").toUpperCase()}</Text>
          <View style={styles.titleUnderline} />
          {!loading && events.length > 0 && (
            <Text style={[styles.sub, { color: colors.textMuted }]}>
              {tp(lang, "eventSingular", "eventPlural", events.length)}
            </Text>
          )}
        </View>

        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t(lang, "scope").toUpperCase()}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={{ paddingHorizontal: 24, gap: 8 }}>
          <TouchableOpacity
            testID="scope-all"
            style={[styles.chip, { borderColor: colors.border }, activeScope === "all" && { backgroundColor: colors.textPrimary, borderColor: colors.textPrimary }]}
            onPress={() => setActiveScope("all")}
          >
            <Text style={[styles.chipText, { color: colors.textSecondary }, activeScope === "all" && { color: colors.bg }]}>{t(lang, "all").toUpperCase()}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="scope-global"
            style={[styles.chip, { borderColor: colors.border }, activeScope === "global" && { backgroundColor: colors.textPrimary, borderColor: colors.textPrimary }]}
            onPress={() => setActiveScope("global")}
          >
            <Globe size={14} color={activeScope === "global" ? colors.bg : colors.textSecondary} strokeWidth={2.5} />
            <Text style={[styles.chipText, { color: colors.textSecondary }, activeScope === "global" && { color: colors.bg }]}>{t(lang, "global").toUpperCase()}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="scope-local"
            style={[styles.chip, { borderColor: colors.border }, activeScope === "local" && { backgroundColor: colors.textPrimary, borderColor: colors.textPrimary }]}
            onPress={() => setActiveScope("local")}
          >
            <MapPin size={14} color={activeScope === "local" ? colors.bg : colors.textSecondary} strokeWidth={2.5} />
            <Text style={[styles.chipText, { color: colors.textSecondary }, activeScope === "local" && { color: colors.bg }]}>
              {countryFlag(user?.country || "IT")} {user?.country || "IT"}
            </Text>
          </TouchableOpacity>
        </ScrollView>

        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t(lang, "allCategories").toUpperCase()}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={{ paddingHorizontal: 24, gap: 8 }}>
          <TouchableOpacity
            testID="cat-all"
            style={[styles.chip, { borderColor: colors.border }, activeCat === null && { backgroundColor: colors.textPrimary, borderColor: colors.textPrimary }]}
            onPress={() => setActiveCat(null)}
          >
            <Text style={[styles.chipText, { color: colors.textSecondary }, activeCat === null && { color: colors.bg }]}>
              {t(lang, "allCategories").toUpperCase()}
            </Text>
          </TouchableOpacity>
          {CATS.map((c) => (
            <TouchableOpacity
              key={c}
              testID={`cat-${c}`}
              style={[
                styles.chip,
                { borderColor: colors.border },
                activeCat === c && { backgroundColor: categoryColor(c), borderColor: categoryColor(c) },
              ]}
              onPress={() => setActiveCat(c)}
            >
              <Text style={[styles.chipText, { color: colors.textSecondary }, activeCat === c && { color: "#fff" }]}>
                {t(lang, c as any).toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{t(lang, "filterDecade").toUpperCase()}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={{ paddingHorizontal: 24, gap: 8 }}>
          <TouchableOpacity
            testID="decade-all"
            style={[styles.chip, { borderColor: colors.border }, activeDecade === null && { backgroundColor: colors.textPrimary, borderColor: colors.textPrimary }]}
            onPress={() => setActiveDecade(null)}
          >
            <Text style={[styles.chipText, { color: colors.textSecondary }, activeDecade === null && { color: colors.bg }]}>
              {t(lang, "allDecades").toUpperCase()}
            </Text>
          </TouchableOpacity>
          {DECADES.map((d) => (
            <TouchableOpacity
              key={d}
              testID={`decade-${d}`}
              style={[styles.chip, { borderColor: colors.border }, activeDecade === d && { backgroundColor: colors.textPrimary, borderColor: colors.textPrimary }]}
              onPress={() => setActiveDecade(d)}
            >
              <Text style={[styles.chipText, { color: colors.textSecondary }, activeDecade === d && { color: colors.bg }]}>{d}s</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? (
          <View style={{ padding: 40, alignItems: "center" }}>
            <ActivityIndicator color={colors.like} />
          </View>
        ) : (
          <View style={styles.grid}>
            {events.map((ev) => {
              const accent = categoryColor(ev.category);
              return (
                <View key={ev.id} style={[styles.tile, { width: tileW, backgroundColor: colors.surface }]} testID={`explore-tile-${ev.id}`}>
                  <ImageBackground
                    source={{
                      uri: proxyImage(ev.image_url) ||
                        "https://static.prod-images.emergentagent.com/jobs/a02b6ded-2c91-4333-b8ce-d270275f4133/images/97909e4beaea0a1ecf60c1511a07e13c7f87e525c448733397e57392b734f653.png",
                    }}
                    style={styles.tileBg}
                    imageStyle={{ borderRadius: 12 }}
                  >
                    <LinearGradient
                      colors={["transparent", "rgba(5,5,5,0.95)"]}
                      style={styles.tileGradient}
                    />
                    <View style={styles.tileTop}>
                      <View style={[styles.tileCat, { backgroundColor: accent }]}>
                        <Text style={styles.tileCatText}>
                          {t(lang, ev.category as any).substring(0, 3).toUpperCase()}
                        </Text>
                      </View>
                      {ev.scope === "global" ? (
                        <View style={styles.tileScope}>
                          <Globe size={10} color="#fff" strokeWidth={2.5} />
                        </View>
                      ) : (
                        <View style={styles.tileScope}>
                          <Text style={{ fontSize: 10 }}>{countryFlag(ev.origin || "")}</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.tileBottom}>
                      <Text style={[styles.tileYear, { color: "#fff" }]}>{ev.year}</Text>
                      <Text style={[styles.tileTitle, { color: "#fff" }]} numberOfLines={2}>{ev.title}</Text>
                    </View>
                  </ImageBackground>
                </View>
              );
            })}
            {events.length === 0 && (
              <Text style={[styles.empty, { color: colors.textMuted }]}>{t(lang, "noResults")}</Text>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 20 },
  title: { color: COLORS.textPrimary, fontSize: 38, fontWeight: "900", letterSpacing: -1.5 },
  titleUnderline: { width: 48, height: 4, backgroundColor: COLORS.like, marginTop: 6 },
  sub: { color: COLORS.textMuted, fontSize: 12, letterSpacing: 2, fontWeight: "700", marginTop: 10 },
  sectionLabel: { color: COLORS.textMuted, fontSize: 10, letterSpacing: 3, fontWeight: "800", marginTop: 18, marginLeft: 24 },
  chipScroll: { marginTop: 10 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingVertical: 10, paddingHorizontal: 14,
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 999,
  },
  chipActive: { backgroundColor: COLORS.textPrimary, borderColor: COLORS.textPrimary },
  chipText: { color: COLORS.textSecondary, fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
  chipTextActive: { color: "#050505" },
  grid: {
    flexDirection: "row", flexWrap: "wrap", gap: 12,
    paddingHorizontal: 24, marginTop: 20,
  },
  tile: {
    aspectRatio: 0.75,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: COLORS.surface,
  },
  tileBg: { flex: 1, justifyContent: "space-between" },
  tileGradient: { position: "absolute", left: 0, right: 0, bottom: 0, top: "35%" },
  tileTop: { flexDirection: "row", justifyContent: "space-between", padding: 10 },
  tileCat: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  tileCatText: { color: "#fff", fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  tileScope: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center", justifyContent: "center",
  },
  tileBottom: { padding: 10 },
  tileYear: { color: COLORS.textPrimary, fontSize: 22, fontWeight: "900", letterSpacing: -1 },
  tileTitle: { color: COLORS.textPrimary, fontSize: 12, fontWeight: "600", marginTop: 4 },
  empty: { color: COLORS.textMuted, fontSize: 14, padding: 40, textAlign: "center", width: "100%" },
});
