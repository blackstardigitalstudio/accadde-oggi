import React, { memo } from "react";
import {
  View, Text, ImageBackground, StyleSheet, TouchableOpacity,
  useWindowDimensions, Share, Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Heart, ThumbsDown, Bookmark, Share2, Globe, MapPin } from "lucide-react-native";
import { COLORS, categoryColor } from "../theme";
import { t, Lang } from "../i18n/translations";
import { countryFlag, countryLabel } from "../i18n/countries";

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

const FALLBACK_IMAGES: Record<string, string> = {
  wars: "https://static.prod-images.emergentagent.com/jobs/a02b6ded-2c91-4333-b8ce-d270275f4133/images/673c71cb98c6878d0d158148fc774b5d12c12aac651fbb5af7d3f12f34258511.png",
  science: "https://static.prod-images.emergentagent.com/jobs/a02b6ded-2c91-4333-b8ce-d270275f4133/images/91eeb5e2e0c33bb659ee0f9741d501c71b2a6962b65db607090b3b3e9400001a.png",
  sports: "https://static.prod-images.emergentagent.com/jobs/a02b6ded-2c91-4333-b8ce-d270275f4133/images/0f03e64a6fc90c69eabc1afb14ff98e872163eee22d492646e222bceeb2e5ed6.png",
  culture: "https://static.prod-images.emergentagent.com/jobs/a02b6ded-2c91-4333-b8ce-d270275f4133/images/97909e4beaea0a1ecf60c1511a07e13c7f87e525c448733397e57392b734f653.png",
  politics: "https://static.prod-images.emergentagent.com/jobs/a02b6ded-2c91-4333-b8ce-d270275f4133/images/97909e4beaea0a1ecf60c1511a07e13c7f87e525c448733397e57392b734f653.png",
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
  const img = event.image_url || FALLBACK_IMAGES[event.category] || FALLBACK_IMAGES.culture;

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
      <ImageBackground source={{ uri: img }} style={StyleSheet.absoluteFillObject} resizeMode="cover">
        <LinearGradient
          colors={["transparent", "rgba(5,5,5,0.3)", "rgba(5,5,5,0.85)", "#050505"]}
          locations={[0, 0.35, 0.75, 1]}
          style={StyleSheet.absoluteFillObject}
        />
      </ImageBackground>

      {/* Top badges */}
      <View style={styles.topRow}>
        <View style={[styles.catPill, { borderLeftColor: accent }]}>
          <Text style={[styles.catText, { color: accent }]}>
            {t(lang, event.category as any).toUpperCase()}
          </Text>
        </View>
        <View style={styles.scopePill}>
          {event.scope === "global" ? (
            <Globe color="#F8F8F6" size={12} strokeWidth={2.5} />
          ) : (
            <MapPin color={accent} size={12} strokeWidth={2.5} />
          )}
          <Text style={[styles.scopeText, event.scope === "local" && { color: accent }]}>
            {event.scope === "global"
              ? "MONDO"
              : countryLabel(event.origin || (event.countries?.[0] || ""), lang).toUpperCase()}
          </Text>
          {event.scope === "local" && (
            <Text style={styles.flagText}>
              {countryFlag(event.origin || event.countries?.[0] || "")}
            </Text>
          )}
        </View>
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
        <Text style={styles.desc} numberOfLines={5}>{event.text}</Text>

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
    </View>
  );
};

export default memo(EventCard);

const styles = StyleSheet.create({
  card: { width: "100%", backgroundColor: "#050505" },
  topRow: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 36,
    left: 24,
    right: 24,
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
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
});
