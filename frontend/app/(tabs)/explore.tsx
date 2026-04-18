import { useCallback, useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, useWindowDimensions, ImageBackground,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Globe, MapPin } from "lucide-react-native";
import { useAuth } from "../../src/contexts/AuthContext";
import api from "../../src/api/client";
import { COLORS, categoryColor } from "../../src/theme";
import { t } from "../../src/i18n/translations";
import { countryFlag } from "../../src/i18n/countries";
import { EventData } from "../../src/components/EventCard";

const CATS = ["wars", "science", "culture", "sports", "politics"];
const DECADES = [1900, 1920, 1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020];

export default function Explore() {
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const lang = (user?.language as any) || "it";

  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [activeDecade, setActiveDecade] = useState<number | null>(null);
  const [activeScope, setActiveScope] = useState<"all" | "global" | "local">("all");
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
    <SafeAreaView style={styles.c} testID="explore-screen" edges={["top"]}>
      <LinearGradient colors={["#0a0a0a", "#050505"]} style={StyleSheet.absoluteFillObject} />
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>{t(lang, "explore").toUpperCase()}</Text>
          <View style={styles.titleUnderline} />
        </View>

        <Text style={styles.sectionLabel}>SCOPE</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={{ paddingHorizontal: 24, gap: 8 }}>
          <TouchableOpacity
            testID="scope-all"
            style={[styles.chip, activeScope === "all" && styles.chipActive]}
            onPress={() => setActiveScope("all")}
          >
            <Text style={[styles.chipText, activeScope === "all" && styles.chipTextActive]}>TUTTO</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="scope-global"
            style={[styles.chip, activeScope === "global" && styles.chipActive]}
            onPress={() => setActiveScope("global")}
          >
            <Globe size={14} color={activeScope === "global" ? "#050505" : COLORS.textSecondary} strokeWidth={2.5} />
            <Text style={[styles.chipText, activeScope === "global" && styles.chipTextActive]}>MONDO</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="scope-local"
            style={[styles.chip, activeScope === "local" && styles.chipActive]}
            onPress={() => setActiveScope("local")}
          >
            <MapPin size={14} color={activeScope === "local" ? "#050505" : COLORS.textSecondary} strokeWidth={2.5} />
            <Text style={[styles.chipText, activeScope === "local" && styles.chipTextActive]}>
              {countryFlag(user?.country || "IT")} {user?.country || "IT"}
            </Text>
          </TouchableOpacity>
        </ScrollView>

        <Text style={styles.sectionLabel}>{t(lang, "allCategories").toUpperCase()}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={{ paddingHorizontal: 24, gap: 8 }}>
          <TouchableOpacity
            testID="cat-all"
            style={[styles.chip, activeCat === null && styles.chipActive]}
            onPress={() => setActiveCat(null)}
          >
            <Text style={[styles.chipText, activeCat === null && styles.chipTextActive]}>
              {t(lang, "allCategories").toUpperCase()}
            </Text>
          </TouchableOpacity>
          {CATS.map((c) => (
            <TouchableOpacity
              key={c}
              testID={`cat-${c}`}
              style={[
                styles.chip,
                activeCat === c && { backgroundColor: categoryColor(c), borderColor: categoryColor(c) },
              ]}
              onPress={() => setActiveCat(c)}
            >
              <Text style={[styles.chipText, activeCat === c && styles.chipTextActive]}>
                {t(lang, c as any).toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.sectionLabel}>{t(lang, "filterDecade").toUpperCase()}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={{ paddingHorizontal: 24, gap: 8 }}>
          <TouchableOpacity
            testID="decade-all"
            style={[styles.chip, activeDecade === null && styles.chipActive]}
            onPress={() => setActiveDecade(null)}
          >
            <Text style={[styles.chipText, activeDecade === null && styles.chipTextActive]}>
              {t(lang, "allDecades").toUpperCase()}
            </Text>
          </TouchableOpacity>
          {DECADES.map((d) => (
            <TouchableOpacity
              key={d}
              testID={`decade-${d}`}
              style={[styles.chip, activeDecade === d && styles.chipActive]}
              onPress={() => setActiveDecade(d)}
            >
              <Text style={[styles.chipText, activeDecade === d && styles.chipTextActive]}>{d}s</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? (
          <View style={{ padding: 40, alignItems: "center" }}>
            <ActivityIndicator color={COLORS.like} />
          </View>
        ) : (
          <View style={styles.grid}>
            {events.map((ev) => {
              const accent = categoryColor(ev.category);
              return (
                <View key={ev.id} style={[styles.tile, { width: tileW }]} testID={`explore-tile-${ev.id}`}>
                  <ImageBackground
                    source={{
                      uri: ev.image_url ||
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
                      <Text style={styles.tileYear}>{ev.year}</Text>
                      <Text style={styles.tileTitle} numberOfLines={2}>{ev.title}</Text>
                    </View>
                  </ImageBackground>
                </View>
              );
            })}
            {events.length === 0 && (
              <Text style={styles.empty}>Nessun risultato</Text>
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
