import React, { memo, useState } from "react";
import {
  View, Text, ImageBackground, StyleSheet, TouchableOpacity,
  useWindowDimensions, Share, Platform, Modal, ScrollView, Linking, ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Heart, ThumbsDown, Bookmark, Share2, Globe, MapPin, X, ExternalLink, Sparkles } from "lucide-react-native";
import { COLORS, categoryColor } from "../theme";
import { t, Lang } from "../i18n/translations";
import { countryFlag, countryLabel } from "../i18n/countries";
import { eventImageSource } from "../utils/categoryImages";
import api from "../api/client";

export type EventData = {
  id: string;
  year: number;
  years_ago: number;
  title: string;
  text: string;
  image_url: string | null;
  category: string;
  scope: "global" | "local";
  sources?: string[];
  countries?: string[];
  origin?: string | null;
  wiki_url?: string | null;
  liked?: boolean;
  disliked?: boolean;
  saved?: boolean;
};

type Props = {
  event: EventData;
  lang: Lang;
  height: number;
  onLike: () => void;
  onDislike: () => void;
  onSave: () => void;
};

const EventCard: React.FC<Props> = ({ event, lang, height, onLike, onDislike, onSave }) => {
  const accent = categoryColor(event.category);
  const img = eventImageSource(event.image_url, event.category);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [aiText, setAiText] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(false);

  const doAiEnrich = async () => {
    if (aiLoading || aiText) return;
    setAiError(false);
    setAiLoading(true);
    try {
      const { data } = await api.post("/events/enrich", {
        event_id: event.id,
        text: event.text,
        year: event.year,
        category: event.category,
        lang,
        wiki_url: event.wiki_url,
      });
      setAiText(data?.text || "");
      if (!data?.text) setAiError(true);
    } catch {
      setAiError(true);
    } finally {
      setAiLoading(false);
    }
  };

  // Reset AI content when lang changes so user gets localized output
  React.useEffect(() => {
    setAiText("");
    setAiError(false);
  }, [lang, event.id]);
  // Header takes roughly insets.top + 72 (date + brand + bottom padding). Keep badges well clear.
  const topOffset = insets.top + 96;

  const onShare = async () => {
    try {
      await Share.share({
        message: `${t(lang, "shareText")} ${event.year} — ${event.title}\n\n${event.text}`,
      });
    } catch {}
  };

  const yearsLabel =
    event.years_ago === 1 ? t(lang, "yearAgoBadge") : t(lang, "yearsAgoBadge");

  return (
    <View style={[styles.card, { height }]} testID={`event-card-${event.id}`}>
      <ImageBackground source={img} style={StyleSheet.absoluteFillObject} resizeMode="cover">
        <LinearGradient
          colors={["transparent", "rgba(5,5,5,0.3)", "rgba(5,5,5,0.85)", "#050505"]}
          locations={[0, 0.35, 0.75, 1]}
          style={StyleSheet.absoluteFillObject}
        />
      </ImageBackground>

      {/* Top badges - pressable */}
      <View style={[styles.topRow, { top: topOffset }]}>
        <TouchableOpacity
          testID={`card-cat-${event.id}`}
          style={[styles.catPill, { borderLeftColor: accent }]}
          onPress={() => router.push({ pathname: "/explore", params: { category: event.category } })}
          activeOpacity={0.7}
        >
          <Text style={[styles.catText, { color: accent }]}>
            {t(lang, event.category as any).toUpperCase()}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID={`card-scope-${event.id}`}
          style={styles.scopePill}
          onPress={() => router.push({ pathname: "/explore", params: { scope: event.scope } })}
          activeOpacity={0.7}
        >
          {event.scope === "global" ? (
            <Globe color="#F8F8F6" size={12} strokeWidth={2.5} />
          ) : (
            <MapPin color={accent} size={12} strokeWidth={2.5} />
          )}
          <Text style={[styles.scopeText, event.scope === "local" && { color: accent }]}>
            {event.scope === "global"
              ? t(lang, "global").toUpperCase()
              : countryLabel(event.origin || (event.countries?.[0] || ""), lang).toUpperCase()}
          </Text>
          {event.scope === "local" && (
            <Text style={styles.flagText}>
              {countryFlag(event.origin || event.countries?.[0] || "")}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Bottom content */}
      <View style={styles.bottom}>
        <View style={styles.yearsBadge}>
          <View style={[styles.redBar, { backgroundColor: accent }]} />
          <View>
            <Text style={styles.yearsNum}>{event.years_ago}</Text>
            <Text style={[styles.yearsLabel, { color: accent }]}>{yearsLabel}</Text>
          </View>
        </View>

        <Text style={styles.yearTag}>{event.year}</Text>
        <Text style={styles.title} numberOfLines={3}>{event.title}</Text>
        <TouchableOpacity activeOpacity={0.85} onPress={() => setModalOpen(true)} testID={`expand-${event.id}`}>
          <Text style={styles.desc} numberOfLines={5}>{event.text}</Text>
          {event.text && event.text.length > 140 && (
            <Text style={[styles.readMore, { color: accent }]}>
              {t(lang, "readMore").toUpperCase()} →
            </Text>
          )}
        </TouchableOpacity>

        <View style={styles.actions}>
          <TouchableOpacity
            testID={`like-btn-${event.id}`}
            style={[styles.actionBtn, event.liked && styles.actionBtnActive]}
            onPress={onLike}
          >
            <Heart
              size={20}
              color={event.liked ? "#fff" : COLORS.textPrimary}
              fill={event.liked ? "#fff" : "transparent"}
              strokeWidth={2}
            />
          </TouchableOpacity>

          <TouchableOpacity
            testID={`dislike-btn-${event.id}`}
            style={[styles.actionBtn, event.disliked && styles.actionBtnDislikeActive]}
            onPress={onDislike}
          >
            <ThumbsDown
              size={20}
              color={event.disliked ? "#fff" : COLORS.textPrimary}
              fill={event.disliked ? "#fff" : "transparent"}
              strokeWidth={2}
            />
          </TouchableOpacity>

          <TouchableOpacity
            testID={`save-btn-${event.id}`}
            style={[styles.actionBtn, event.saved && styles.actionBtnSavedActive]}
            onPress={onSave}
          >
            <Bookmark
              size={20}
              color={event.saved ? "#050505" : COLORS.textPrimary}
              fill={event.saved ? COLORS.textPrimary : "transparent"}
              strokeWidth={2}
            />
          </TouchableOpacity>

          <TouchableOpacity
            testID={`share-btn-${event.id}`}
            style={styles.actionBtn}
            onPress={onShare}
          >
            <Share2 size={20} color={COLORS.textPrimary} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </View>

      {/* FULL ARTICLE MODAL */}
      <Modal
        visible={modalOpen}
        animationType="slide"
        onRequestClose={() => setModalOpen(false)}
        statusBarTranslucent
      >
        <View style={modalStyles.root}>
          <ImageBackground source={img} style={modalStyles.heroImg} resizeMode="cover">
            <LinearGradient
              colors={["rgba(5,5,5,0.4)", "rgba(5,5,5,0.7)", "#050505"]}
              style={StyleSheet.absoluteFillObject}
            />
            <TouchableOpacity
              testID={`modal-close-${event.id}`}
              style={[modalStyles.closeBtn, { top: insets.top + 12 }]}
              onPress={() => setModalOpen(false)}
            >
              <X size={22} color="#fff" strokeWidth={2.5} />
            </TouchableOpacity>
            <View style={modalStyles.heroBottom}>
              <View style={[modalStyles.catPillM, { borderLeftColor: accent }]}>
                <Text style={[modalStyles.catTextM, { color: accent }]}>
                  {t(lang, event.category as any).toUpperCase()}
                </Text>
              </View>
              <Text style={modalStyles.yearTagM}>{event.year} · {event.years_ago} {yearsLabel.toLowerCase()}</Text>
              <Text style={modalStyles.titleM}>{event.title}</Text>
            </View>
          </ImageBackground>

          <ScrollView style={modalStyles.body} contentContainerStyle={{ paddingBottom: 40 }}>
            <Text style={modalStyles.descFull}>{event.text}</Text>

            {/* AI ENRICHMENT SECTION */}
            {!aiText && !aiLoading && (
              <TouchableOpacity
                testID={`ai-enrich-btn-${event.id}`}
                style={[modalStyles.aiBtn, { borderColor: accent }]}
                onPress={doAiEnrich}
                activeOpacity={0.85}
              >
                <Sparkles size={16} color={accent} strokeWidth={2.5} />
                <Text style={[modalStyles.aiBtnText, { color: accent }]}>
                  ✨ {t(lang, "aiSummarize").toUpperCase()}
                </Text>
              </TouchableOpacity>
            )}

            {aiLoading && (
              <View style={modalStyles.aiLoadingBox} testID={`ai-loading-${event.id}`}>
                <ActivityIndicator color={accent} />
                <Text style={[modalStyles.aiLoadingText, { color: accent }]}>
                  {t(lang, "aiGenerating")}
                </Text>
              </View>
            )}

            {aiText ? (
              <View style={[modalStyles.aiResultBox, { borderColor: accent }]} testID={`ai-result-${event.id}`}>
                <View style={modalStyles.aiResultHeader}>
                  <Sparkles size={14} color={accent} strokeWidth={2.5} />
                  <Text style={[modalStyles.aiResultLabel, { color: accent }]}>
                    {t(lang, "aiSummary").toUpperCase()}
                  </Text>
                </View>
                <Text style={modalStyles.aiResultText}>{aiText}</Text>
              </View>
            ) : null}

            {aiError && !aiLoading && (
              <Text style={modalStyles.aiErr}>{t(lang, "aiUnavailable")}</Text>
            )}

            {event.wiki_url && (
              <TouchableOpacity
                testID={`wiki-link-${event.id}`}
                style={[modalStyles.wikiBtn, { borderColor: accent }]}
                onPress={() => event.wiki_url && Linking.openURL(event.wiki_url)}
              >
                <ExternalLink size={16} color={accent} strokeWidth={2.5} />
                <Text style={[modalStyles.wikiBtnText, { color: accent }]}>
                  {t(lang, "readOnWikipedia").toUpperCase()}
                </Text>
              </TouchableOpacity>
            )}

            <View style={modalStyles.actionsM}>
              <TouchableOpacity
                style={[modalStyles.actionBtnM, event.liked && { backgroundColor: COLORS.like, borderColor: COLORS.like }]}
                onPress={() => { onLike(); }}
              >
                <Heart size={20} color={event.liked ? "#fff" : COLORS.textPrimary} fill={event.liked ? "#fff" : "transparent"} strokeWidth={2} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[modalStyles.actionBtnM, event.disliked && { backgroundColor: COLORS.dislike, borderColor: COLORS.dislike }]}
                onPress={() => { onDislike(); }}
              >
                <ThumbsDown size={20} color={event.disliked ? "#fff" : COLORS.textPrimary} fill={event.disliked ? "#fff" : "transparent"} strokeWidth={2} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[modalStyles.actionBtnM, event.saved && { backgroundColor: COLORS.textPrimary, borderColor: COLORS.textPrimary }]}
                onPress={() => { onSave(); }}
              >
                <Bookmark size={20} color={event.saved ? "#050505" : COLORS.textPrimary} fill={event.saved ? COLORS.textPrimary : "transparent"} strokeWidth={2} />
              </TouchableOpacity>
              <TouchableOpacity style={modalStyles.actionBtnM} onPress={onShare}>
                <Share2 size={20} color={COLORS.textPrimary} strokeWidth={2} />
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

export default memo(EventCard);

const styles = StyleSheet.create({
  card: { width: "100%", backgroundColor: "#050505" },
  topRow: {
    position: "absolute",
    left: 24,
    right: 24,
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
    zIndex: 5,
  },
  catPill: {
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderLeftWidth: 3,
    borderRadius: 4,
  },
  catText: { fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  scopePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
  },
  scopeText: { fontSize: 10, fontWeight: "800", letterSpacing: 1.5, color: "#F8F8F6" },
  flagText: { fontSize: 12 },
  bottom: {
    position: "absolute",
    left: 24,
    right: 24,
    bottom: 40,
  },
  yearsBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  redBar: { width: 4, height: 48, borderRadius: 2 },
  yearsNum: {
    color: COLORS.textPrimary,
    fontSize: 36,
    fontWeight: "900",
    letterSpacing: -1,
    lineHeight: 36,
  },
  yearsLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
    marginTop: 2,
  },
  yearTag: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 3,
    marginTop: 4,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 28,
    fontWeight: "800",
    lineHeight: 32,
    marginTop: 8,
    letterSpacing: -0.5,
  },
  desc: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  actionBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnActive: { backgroundColor: COLORS.like, borderColor: COLORS.like },
  actionBtnDislikeActive: { backgroundColor: COLORS.dislike, borderColor: COLORS.dislike },
  actionBtnSavedActive: { backgroundColor: COLORS.textPrimary, borderColor: COLORS.textPrimary },
  readMore: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2,
  },
});

const modalStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#050505" },
  heroImg: {
    height: 320,
    justifyContent: "flex-end",
  },
  closeBtn: {
    position: "absolute",
    right: 16,
    backgroundColor: "rgba(0,0,0,0.55)",
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
    zIndex: 10,
  },
  heroBottom: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  catPillM: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderLeftWidth: 3,
    borderRadius: 4,
    marginBottom: 12,
  },
  catTextM: { fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  yearTagM: { color: COLORS.textSecondary, fontSize: 13, fontWeight: "700", letterSpacing: 3, marginBottom: 8 },
  titleM: { color: COLORS.textPrimary, fontSize: 28, fontWeight: "900", lineHeight: 32, letterSpacing: -0.5 },
  body: { flex: 1, paddingHorizontal: 24, paddingTop: 20 },
  descFull: {
    color: COLORS.textPrimary,
    fontSize: 16,
    lineHeight: 26,
  },
  wikiBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    borderWidth: 2,
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 24,
  },
  wikiBtnText: { fontSize: 12, fontWeight: "900", letterSpacing: 2 },
  aiBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    borderWidth: 2, borderStyle: "dashed",
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 24,
    backgroundColor: "rgba(230,57,70,0.05)",
  },
  aiBtnText: { fontSize: 12, fontWeight: "900", letterSpacing: 1.5 },
  aiLoadingBox: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    paddingVertical: 18, marginTop: 24,
    borderWidth: 1, borderColor: "rgba(230,57,70,0.25)", borderRadius: 10,
    backgroundColor: "rgba(230,57,70,0.05)",
  },
  aiLoadingText: { fontSize: 13, fontWeight: "700", letterSpacing: 1 },
  aiResultBox: {
    marginTop: 24,
    padding: 16,
    borderLeftWidth: 3,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  aiResultHeader: {
    flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10,
  },
  aiResultLabel: { fontSize: 11, fontWeight: "900", letterSpacing: 2 },
  aiResultText: {
    color: COLORS.textPrimary,
    fontSize: 15,
    lineHeight: 24,
  },
  aiErr: {
    color: COLORS.like, fontSize: 12, fontWeight: "700",
    marginTop: 12, textAlign: "center",
  },
  actionsM: {
    flexDirection: "row",
    gap: 10,
    marginTop: 24,
    justifyContent: "center",
  },
  actionBtnM: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1, borderColor: COLORS.border,
    alignItems: "center", justifyContent: "center",
  },
});
