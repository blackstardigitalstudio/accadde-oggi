import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { Lang } from "../i18n/translations";
import api from "../api/client";

export const NOTIFICATION_IDENTIFIER = "accadde-oggi";
export const SCHEDULE_DAYS = 14;

export type Window = "morning" | "afternoon" | "evening" | "random";

export const WINDOW_RANGES: Record<Window, { start: number; end: number }> = {
  morning: { start: 7, end: 10 },
  afternoon: { start: 12, end: 16 },
  evening: { start: 18, end: 22 },
  random: { start: 8, end: 22 },
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ============================================================
// FALLBACK GENERIC TEMPLATES (used if teaser fetch fails)
// ============================================================
const FALLBACK_TEMPLATES: Record<Lang, { title: string; body: string }[]> = {
  it: [
    { title: "📜 Accadde Oggi", body: "Un evento storico ti aspetta. Scoprilo ora." },
    { title: "🕰️ Oggi nella storia", body: "Qualcosa di straordinario è successo in questa data." },
    { title: "⚡ Nuovo giorno, nuova storia", body: "Apri l'app e tuffati nel passato." },
    { title: "🎭 Accadde Oggi", body: "Cosa successe oggi, 50, 100, 500 anni fa?" },
    { title: "🌍 Oggi nel mondo", body: "Un anniversario storico ti sta aspettando." },
  ],
  en: [
    { title: "📜 On This Day", body: "A historic event is waiting for you. Discover it now." },
    { title: "🕰️ Today in history", body: "Something extraordinary happened on this date." },
    { title: "⚡ New day, new story", body: "Open the app and dive into the past." },
    { title: "🎭 On This Day", body: "What happened today, 50, 100, 500 years ago?" },
    { title: "🌍 Today in the world", body: "A historical anniversary is waiting for you." },
  ],
  es: [
    { title: "📜 Un Día Como Hoy", body: "Un evento histórico te espera. Descúbrelo." },
    { title: "🕰️ Hoy en la historia", body: "Algo extraordinario pasó en esta fecha." },
    { title: "⚡ Nuevo día, nueva historia", body: "Abre la app y sumérgete en el pasado." },
    { title: "🎭 Un Día Como Hoy", body: "¿Qué pasó hoy hace 50, 100, 500 años?" },
    { title: "🌍 Hoy en el mundo", body: "Un aniversario histórico te espera." },
  ],
};

// ============================================================
// CURIOSITY HOOKS — per language + category
// ============================================================
const CURIOSITY_ICONS: Record<string, string> = {
  wars: "⚔️",
  science: "🔬",
  culture: "🎭",
  sports: "🏆",
  politics: "🏛️",
};

const CURIOSITY_TEMPLATES: Record<Lang, (year: number, yearsAgo: number, category: string) => { title: string; body: string }> = {
  it: (year, yearsAgo, category) => {
    const icon = CURIOSITY_ICONS[category] || "📜";
    const ageText =
      yearsAgo >= 1000 ? `${yearsAgo} anni fa` :
      yearsAgo >= 100 ? `esattamente ${yearsAgo} anni fa` :
      yearsAgo === 50 ? "mezzo secolo fa" :
      yearsAgo === 25 ? "un quarto di secolo fa" :
      yearsAgo <= 10 ? `solo ${yearsAgo} anni fa` :
      `${yearsAgo} anni fa`;
    const variants = [
      { title: `${icon} Sai cosa accadde nel ${year}?`, body: `Oggi, ${ageText}. La storia ti aspetta 👀` },
      { title: `${icon} Oggi nel ${year}…`, body: `Qualcosa di incredibile accadde. Riesci a indovinare?` },
      { title: `${icon} ${yearsAgo} anni fa, proprio oggi`, body: `Un evento che cambiò tutto. Scoprilo in 30 secondi.` },
      { title: `${icon} Flashback al ${year}`, body: `Tocca per scoprire la notizia che fece storia oggi.` },
      { title: `${icon} ${year}: oggi è l'anniversario`, body: `Non immagini cosa successe. Apri per svelarlo.` },
    ];
    return variants[Math.floor(Math.random() * variants.length)];
  },
  en: (year, yearsAgo, category) => {
    const icon = CURIOSITY_ICONS[category] || "📜";
    const ageText =
      yearsAgo >= 1000 ? `${yearsAgo} years ago` :
      yearsAgo >= 100 ? `exactly ${yearsAgo} years ago` :
      yearsAgo === 50 ? "half a century ago" :
      yearsAgo === 25 ? "a quarter century ago" :
      yearsAgo <= 10 ? `just ${yearsAgo} years ago` :
      `${yearsAgo} years ago`;
    const variants = [
      { title: `${icon} Do you know what happened in ${year}?`, body: `Today, ${ageText}. History awaits 👀` },
      { title: `${icon} Today in ${year}…`, body: `Something incredible happened. Can you guess?` },
      { title: `${icon} ${yearsAgo} years ago, today`, body: `An event that changed everything. Find out in 30 seconds.` },
      { title: `${icon} Flashback to ${year}`, body: `Tap to reveal the story that made history today.` },
      { title: `${icon} ${year}: today is the anniversary`, body: `You won't guess what happened. Open to discover.` },
    ];
    return variants[Math.floor(Math.random() * variants.length)];
  },
  es: (year, yearsAgo, category) => {
    const icon = CURIOSITY_ICONS[category] || "📜";
    const ageText =
      yearsAgo >= 1000 ? `hace ${yearsAgo} años` :
      yearsAgo >= 100 ? `hace exactamente ${yearsAgo} años` :
      yearsAgo === 50 ? "medio siglo atrás" :
      yearsAgo === 25 ? "hace un cuarto de siglo" :
      yearsAgo <= 10 ? `hace solo ${yearsAgo} años` :
      `hace ${yearsAgo} años`;
    const variants = [
      { title: `${icon} ¿Sabes qué pasó en ${year}?`, body: `Hoy, ${ageText}. La historia te espera 👀` },
      { title: `${icon} Hoy en ${year}…`, body: `Algo increíble sucedió. ¿Puedes adivinar?` },
      { title: `${icon} Hace ${yearsAgo} años, hoy`, body: `Un evento que cambió todo. Descúbrelo en 30 segundos.` },
      { title: `${icon} Flashback al ${year}`, body: `Toca para revelar la noticia que hizo historia hoy.` },
      { title: `${icon} ${year}: hoy es el aniversario`, body: `No adivinarás qué pasó. Abre para descubrirlo.` },
    ];
    return variants[Math.floor(Math.random() * variants.length)];
  },
};

// ============================================================
// Build a notification content from a real event teaser
// ============================================================
function realTeaserContent(
  lang: Lang,
  teaser: { year: number; years_ago: number; category: string; title?: string; title_short?: string; text_short?: string }
): { title: string; body: string } {
  const icon = CURIOSITY_ICONS[teaser.category] || "📜";
  const title_txt =
    teaser.title_short || teaser.title || `${teaser.year}`;

  const prefix = lang === "it"
    ? `${icon} ${teaser.year} · ${teaser.years_ago} anni fa`
    : lang === "es"
    ? `${icon} ${teaser.year} · hace ${teaser.years_ago} años`
    : `${icon} ${teaser.year} · ${teaser.years_ago} years ago`;

  // Body = truncated real text (already trimmed server-side)
  const body = teaser.text_short && teaser.text_short.length > 10
    ? teaser.text_short
    : title_txt;

  return { title: prefix, body };
}

// ============================================================
// PERMISSIONS
// ============================================================
export async function ensureNotificationPermissions(): Promise<boolean> {
  if (!Device.isDevice && Platform.OS !== "web") {
    return false;
  }
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === "granted") return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

export async function setupAndroidChannel() {
  if (Platform.OS === "android") {
    try {
      await Notifications.setNotificationChannelAsync("accadde-daily", {
        name: "Accadde Oggi",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#E63946",
      });
    } catch {}
  }
}

export async function cancelAllNotifications() {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of scheduled) {
      if (n.identifier?.startsWith(NOTIFICATION_IDENTIFIER)) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }
  } catch {}
}

function randomInRange(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

// ============================================================
// FETCH TEASERS FROM BACKEND
// ============================================================
type Teaser = {
  id: string;
  year: number;
  years_ago: number;
  category: string;
  scope: string;
  title?: string;
  title_short?: string;
  text_short?: string;
};

async function fetchTeasers(lang: Lang, month?: number, day?: number, count: number = 30): Promise<Teaser[]> {
  try {
    const params: any = { lang, count };
    if (month) params.month = month;
    if (day) params.day = day;
    const { data } = await api.get("/events/teasers", { params, timeout: 10000 });
    return Array.isArray(data?.teasers) ? data.teasers : [];
  } catch (e) {
    return [];
  }
}

// ============================================================
// SCHEDULE NOTIFICATIONS WITH REAL EVENT TEASERS + CURIOSITY HOOKS
// Each slot rotates 50/50 between:
//   A) Real excerpt: "📜 1969 · 56 anni fa" + truncated real text
//   B) Curiosity hook: "🤔 Sai cosa accadde nel 1969?"
// ============================================================
export async function scheduleRandomDailyNotifications(
  window: Window,
  lang: Lang,
  days: number = SCHEDULE_DAYS,
  perDay: number = 3
): Promise<{ ok: boolean; count: number }> {
  const ok = await ensureNotificationPermissions();
  if (!ok) return { ok: false, count: 0 };
  await setupAndroidChannel();
  await cancelAllNotifications();

  const range = WINDOW_RANGES[window];
  const now = new Date();
  let scheduled = 0;

  // Fetch today's teasers (used for today + rotating pool)
  const todayTeasers = await fetchTeasers(lang);

  const pickCountForDay = () => perDay + (Math.random() < 0.35 ? 1 : 0);

  for (let i = 0; i < days; i++) {
    const target0 = new Date(now);
    target0.setDate(now.getDate() + i);

    // For each future day, fetch that day's teasers (capped: only for next 3 days to save requests)
    let dayTeasers: Teaser[] = todayTeasers;
    if (i > 0 && i <= 2) {
      const t = await fetchTeasers(lang, target0.getMonth() + 1, target0.getDate(), 20);
      if (t.length > 0) dayTeasers = t;
    }

    const slots = pickCountForDay();
    const span = range.end - range.start;
    const segment = span / slots;

    // Shuffle teaser order so we don't repeat inside the same day
    const teaserOrder = dayTeasers.map((_, idx) => idx).sort(() => Math.random() - 0.5);

    for (let s = 0; s < slots; s++) {
      const segStart = range.start + segment * s;
      const segEnd = segStart + segment;
      const hourFloat = randomInRange(segStart + 0.1, segEnd - 0.1);
      const hour = Math.floor(hourFloat);
      const minute = Math.floor((hourFloat - hour) * 60);

      const target = new Date(target0);
      target.setHours(hour, minute, 0, 0);
      if (target.getTime() <= now.getTime() + 60_000) continue;

      // Pick a teaser
      const teaser: Teaser | undefined = dayTeasers.length > 0
        ? dayTeasers[teaserOrder[s % teaserOrder.length]]
        : undefined;

      // 50% real excerpt, 50% curiosity hook — plus fallback to generic
      let content: { title: string; body: string };
      if (teaser) {
        const useCuriosity = Math.random() < 0.5;
        if (useCuriosity) {
          content = CURIOSITY_TEMPLATES[lang](teaser.year, teaser.years_ago, teaser.category);
        } else {
          content = realTeaserContent(lang, teaser);
        }
      } else {
        // Fallback: generic template
        const fb = FALLBACK_TEMPLATES[lang] || FALLBACK_TEMPLATES.en;
        content = fb[Math.floor(Math.random() * fb.length)];
      }

      try {
        await Notifications.scheduleNotificationAsync({
          identifier: `${NOTIFICATION_IDENTIFIER}-${target.getTime()}-${s}`,
          content: {
            title: content.title,
            body: content.body,
            sound: "default",
            data: teaser ? { eventId: teaser.id, year: teaser.year } : {},
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: target,
          },
        });
        scheduled++;
      } catch {}
    }
  }

  return { ok: true, count: scheduled };
}

export async function getScheduledInfo(): Promise<{
  count: number;
  nextDate?: Date;
  nextTitle?: string;
  nextBody?: string;
}> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const ours = scheduled.filter((n) => n.identifier?.startsWith(NOTIFICATION_IDENTIFIER));
    if (ours.length === 0) return { count: 0 };
    const withDate = ours
      .map((n) => {
        const trig: any = n.trigger;
        const ts = trig?.value || trig?.timestamp || trig?.date;
        let date: Date | undefined;
        if (typeof ts === "number") date = new Date(ts);
        else if (ts instanceof Date) date = ts;
        return { n, date };
      })
      .filter((x) => x.date)
      .sort((a, b) => (a.date!.getTime() - b.date!.getTime()));
    const first = withDate[0];
    return {
      count: ours.length,
      nextDate: first?.date,
      nextTitle: first?.n?.content?.title || undefined,
      nextBody: first?.n?.content?.body || undefined,
    };
  } catch {
    return { count: 0 };
  }
}

// Show a sample notification immediately (for preview/testing)
export async function sendPreviewNotification(lang: Lang): Promise<boolean> {
  const ok = await ensureNotificationPermissions();
  if (!ok) return false;
  await setupAndroidChannel();
  try {
    const teasers = await fetchTeasers(lang, undefined, undefined, 10);
    let content: { title: string; body: string };
    if (teasers.length > 0) {
      const t = teasers[Math.floor(Math.random() * teasers.length)];
      const useCuriosity = Math.random() < 0.5;
      content = useCuriosity
        ? CURIOSITY_TEMPLATES[lang](t.year, t.years_ago, t.category)
        : realTeaserContent(lang, t);
    } else {
      const fb = FALLBACK_TEMPLATES[lang] || FALLBACK_TEMPLATES.en;
      content = fb[Math.floor(Math.random() * fb.length)];
    }
    await Notifications.scheduleNotificationAsync({
      identifier: `${NOTIFICATION_IDENTIFIER}-preview-${Date.now()}`,
      content: {
        title: content.title,
        body: content.body,
        sound: "default",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 2,
      },
    });
    return true;
  } catch {
    return false;
  }
}
