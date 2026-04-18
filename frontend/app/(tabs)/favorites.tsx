import { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  useWindowDimensions, TouchableOpacity, ImageBackground,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BookmarkX } from "lucide-react-native";
import { useAuth } from "../../src/contexts/AuthContext";
import api from "../../src/api/client";
import { COLORS, categoryColor } from "../../src/theme";
import { t } from "../../src/i18n/translations";
import { EventData } from "../../src/components/EventCard";

export default function Favorites() {
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const lang = (user?.language as any) || "it";

  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/events/favorites");
      setEvents(data.events || []);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const remove = async (id: string) => {
    setEvents((p) => p.filter((e) => e.id !== id));
    try {
      await api.post("/events/interact", { event_id: id, action: "unsave" });
    } catch {}
  };

  return (
    <SafeAreaView style={styles.c} testID="favorites-screen" edges={["top"]}>
      <LinearGradient colors={["#0a0a0a", "#050505"]} style={StyleSheet.absoluteFillObject} />
      <View style={styles.header}>
        <Text style={styles.title}>{t(lang, "favorites").toUpperCase()}</Text>
        <View style={styles.titleUnderline} />
        <Text style={styles.sub}>{events.length} {t(lang, "events")}</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.like} />
        </View>
      ) : events.length === 0 ? (
        <View style={styles.center} testID="favorites-empty">
          <BookmarkX color={COLORS.textMuted} size={64} strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>{t(lang, "noFavorites")}</Text>
          <Text style={styles.emptySub}>{t(lang, "noFavoritesSub")}</Text>
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.like} />
          }
          renderItem={({ item }) => {
            const accent = categoryColor(item.category);
            return (
              <TouchableOpacity
                style={styles.row}
                testID={`fav-item-${item.id}`}
                onPress={() => remove(item.id)}
                activeOpacity={0.8}
              >
                <ImageBackground
                  source={{
                    uri: item.image_url ||
                      "https://static.prod-images.emergentagent.com/jobs/a02b6ded-2c91-4333-b8ce-d270275f4133/images/97909e4beaea0a1ecf60c1511a07e13c7f87e525c448733397e57392b734f653.png",
                  }}
                  style={styles.rowImg}
                  imageStyle={{ borderRadius: 10 }}
                >
                  <LinearGradient
                    colors={["rgba(5,5,5,0.2)", "rgba(5,5,5,0.85)"]}
                    style={StyleSheet.absoluteFillObject}
                  />
                  <View style={[styles.catBadge, { backgroundColor: accent }]}>
                    <Text style={styles.catBadgeText}>
                      {t(lang, item.category as any).substring(0, 3).toUpperCase()}
                    </Text>
                  </View>
                </ImageBackground>
                <View style={styles.rowBody}>
                  <Text style={styles.rowYear}>{item.year}</Text>
                  <Text style={styles.rowTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.rowYearsAgo}>
                    {item.years_ago} {item.years_ago === 1 ? t(lang, "yearAgo") : t(lang, "yearsAgo")}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16 },
  title: { color: COLORS.textPrimary, fontSize: 38, fontWeight: "900", letterSpacing: -1.5 },
  titleUnderline: { width: 48, height: 4, backgroundColor: COLORS.like, marginTop: 6 },
  sub: { color: COLORS.textMuted, fontSize: 12, letterSpacing: 2, fontWeight: "700", marginTop: 10 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  emptyTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: "800", marginTop: 20, textAlign: "center" },
  emptySub: { color: COLORS.textMuted, fontSize: 13, marginTop: 8, textAlign: "center" },
  row: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 14,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    overflow: "hidden",
    padding: 10,
  },
  rowImg: { width: 90, height: 90, borderRadius: 10, overflow: "hidden", justifyContent: "flex-start" },
  catBadge: { alignSelf: "flex-start", paddingHorizontal: 6, paddingVertical: 3, margin: 6, borderRadius: 4 },
  catBadgeText: { color: "#fff", fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  rowBody: { flex: 1, paddingVertical: 4 },
  rowYear: { color: COLORS.like, fontSize: 13, fontWeight: "900", letterSpacing: 2 },
  rowTitle: { color: COLORS.textPrimary, fontSize: 15, fontWeight: "700", marginTop: 4, lineHeight: 19 },
  rowYearsAgo: { color: COLORS.textMuted, fontSize: 11, marginTop: 6, letterSpacing: 1 },
});
