import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { Lang } from "../i18n/translations";
import api from "../api/client";

export const NOTIFICATION_IDENTIFIER = "accadde-oggi";
export const SCHEDULE_DAYS = 21;

export const CHANNEL_DAILY = "accadde-daily";
export const CHANNEL_ANNIVERSARY = "accadde-anniversary";

export type Window = "morning" | "afternoon" | "evening" | "random";

export const WINDOW_RANGES: Record<Window, { start: number; end: number }> = {
  morning: { start: 7, end: 10 },
  afternoon: { start: 12, end: 16 },
  evening: { start: 18, end: 22 },
  random: { start: 8, end: 22 },
};

// How many notifications a day. "normal" is the default: enough to build the
// habit, not enough to get the app muted.
export type Intensity = "soft" | "normal" | "max";
export const INTENSITY_PER_DAY: Record<Intensity, number> = {
  soft: 2,
  normal: 5,
  max: 10,
};

// iOS only keeps the 64 soonest pending notifications and Android caps scheduled
// alarms too, so there is no point queueing hundreds. The app reschedules every
// time it opens, which keeps the queue topped up.
const MAX_SCHEDULED = 180;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    priority: Notifications.AndroidNotificationPriority.MAX,
  }),
});

// Long, unmistakable buzz — the point of these is to be felt, not just seen.
const VIBRATION_DAILY = [0, 350, 150, 350];
const VIBRATION_ANNIVERSARY = [0, 500, 200, 500, 200, 700];

// ============================================================
// FALLBACK GENERIC TEMPLATES (used if teaser fetch fails)
// ============================================================
const FALLBACK_TEMPLATES: Record<Lang, { title: string; body: string }[]> = {
  it: [
    { title: "📜 Oggi non è un giorno qualsiasi", body: "È già successo tutto, una volta. Scopri cosa." },
    { title: "🕰️ Che giorno è oggi? Dipende dall'anno", body: "Apri e guarda cosa successe in questa data." },
    { title: "⚡ Ti sei perso qualcosa", body: "Una storia di oggi che quasi nessuno ricorda." },
  ],
  en: [
    { title: "📜 Today is not just any day", body: "It all happened before, once. Find out what." },
    { title: "🕰️ What day is it? Depends on the year", body: "Open and see what happened on this date." },
    { title: "⚡ You missed something", body: "A story from today almost nobody remembers." },
  ],
  es: [
    { title: "📜 Hoy no es un día cualquiera", body: "Ya pasó todo, una vez. Descubre qué." },
    { title: "🕰️ ¿Qué día es hoy? Depende del año", body: "Abre y mira qué pasó en esta fecha." },
    { title: "⚡ Te perdiste algo", body: "Una historia de hoy que casi nadie recuerda." },
  ],
};

// ============================================================
// CURIOSITY HOOKS — open on the gap, never on what the app does
// ============================================================
const KIND_ICON: Record<string, string> = {
  event: "📜",
  birth: "🎂",
  death: "🕯️",
};

const CATEGORY_ICON: Record<string, string> = {
  wars: "⚔️",
  science: "🔬",
  culture: "🎭",
  sports: "🏆",
  politics: "🏛️",
};

type Teaser = {
  id: string;
  kind?: "event" | "birth" | "death";
  year: number;
  years_ago: number;
  category: string;
  scope: string;
  title?: string;
  title_short?: string;
  text_short?: string;
};

type Content = { title: string; body: string; anniversary: boolean };

const ROUND_ANNIVERSARIES = [10, 20, 25, 50, 75, 100, 150, 200, 250, 500, 1000];

const HOOKS: Record<Lang, {
  anniversary: (y: number, year: number) => string;
  event: (year: number) => string[];
  birth: (year: number) => string[];
  death: (year: number) => string[];
  nudge: string[];
}> = {
  it: {
    anniversary: (y, year) => `${y} anni tondi. Oggi, nel ${year}`,
    event: (year) => [
      `Oggi nel ${year} successe una cosa`,
      `Sai cosa accadde oggi nel ${year}?`,
      `${year}: oggi è l'anniversario`,
    ],
    birth: (year) => [
      `Oggi nel ${year} nasceva qualcuno che conosci`,
      `Chi è nato oggi, nel ${year}?`,
    ],
    death: (year) => [
      `Oggi nel ${year} il mondo lo salutava`,
      `Chi ci ha lasciato oggi, nel ${year}?`,
    ],
    nudge: ["Trenta secondi e lo sai.", "Quasi nessuno se lo ricorda.", "Apri: dura meno di un caffè."],
  },
  en: {
    anniversary: (y, year) => `${y} years exactly. Today, in ${year}`,
    event: (year) => [
      `Something happened today in ${year}`,
      `Do you know what happened today in ${year}?`,
      `${year}: today is the anniversary`,
    ],
    birth: (year) => [
      `Someone you know was born today in ${year}`,
      `Who was born today, in ${year}?`,
    ],
    death: (year) => [
      `Today in ${year} the world said goodbye`,
      `Who did we lose today, in ${year}?`,
    ],
    nudge: ["Thirty seconds and you know.", "Almost nobody remembers this.", "Open it: shorter than a coffee."],
  },
  es: {
    anniversary: (y, year) => `${y} años justos. Hoy, en ${year}`,
    event: (year) => [
      `Hoy en ${year} pasó algo`,
      `¿Sabes qué pasó hoy en ${year}?`,
      `${year}: hoy es el aniversario`,
    ],
    birth: (year) => [
      `Hoy en ${year} nacía alguien que conoces`,
      `¿Quién nació hoy, en ${year}?`,
    ],
    death: (year) => [
      `Hoy en ${year} el mundo se despedía`,
      `¿A quién perdimos hoy, en ${year}?`,
    ],
    nudge: ["Treinta segundos y lo sabes.", "Casi nadie lo recuerda.", "Ábrelo: dura menos que un café."],
  },
};

function pick<T>(arr: T[], seed?: number): T {
  const i = seed === undefined ? Math.floor(Math.random() * arr.length) : seed % arr.length;
  return arr[i];
}

/**
 * Build one notification from a real event.
 *
 * The hook always comes first and it is always a question or a gap; the body is
 * the real excerpt. Nothing here describes the app or its features — that never
 * made anyone open anything.
 */
function buildContent(lang: Lang, teaser: Teaser, seed: number): Content {
  const hooks = HOOKS[lang] || HOOKS.en;
  const kind = teaser.kind || "event";
  const isAnniversary = ROUND_ANNIVERSARIES.includes(teaser.years_ago);
  const icon = isAnniversary
    ? "🎯"
    : CATEGORY_ICON[teaser.category] || KIND_ICON[kind] || "📜";

  const headline = isAnniversary
    ? hooks.anniversary(teaser.years_ago, teaser.year)
    : pick(hooks[kind] ? hooks[kind](teaser.year) : hooks.event(teaser.year), seed);

  const excerpt = teaser.text_short && teaser.text_short.length > 12
    ? teaser.text_short
    : teaser.title_short || teaser.title || pick(hooks.nudge, seed);

  return { title: `${icon} ${headline}`, body: excerpt, anniversary: isAnniversary };
}

// ============================================================
// PERMISSIONS + CHANNELS
// ============================================================
export async function ensureNotificationPermissions(): Promise<boolean> {
  if (!Device.isDevice && Platform.OS !== "web") {
    return false;
  }
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === "granted") return true;
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
        // Lets a genuinely time-bound notification (a round anniversary) break
        // through a focus mode. The user can still revoke it in iOS settings.
        allowProvisional: false,
      },
    });
    return status === "granted";
  } catch {
    return false;
  }
}

export async function setupAndroidChannels() {
  if (Platform.OS !== "android") return;
  try {
    await Notifications.setNotificationChannelAsync(CHANNEL_DAILY, {
      name: "Accadde Oggi — ogni giorno",
      description: "Le storie del giorno",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: VIBRATION_DAILY,
      enableVibrate: true,
      enableLights: true,
      lightColor: "#E63946",
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      sound: "default",
      showBadge: true,
    });
    await Notifications.setNotificationChannelAsync(CHANNEL_ANNIVERSARY, {
      name: "Accadde Oggi — anniversari importanti",
      description: "50, 100, 500 anni esatti da un evento",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: VIBRATION_ANNIVERSARY,
      enableVibrate: true,
      enableLights: true,
      lightColor: "#FCA311",
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      sound: "default",
      showBadge: true,
    });
  } catch {}
}

/** Kept for callers that used the old single-channel helper. */
export const setupAndroidChannel = setupAndroidChannels;

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
// PUSH TOKEN — lets the server reach the phone even if the app
// hasn't been opened in weeks (local schedules eventually run out)
// ============================================================
export async function registerPushToken(lang: Lang, country?: string): Promise<string | null> {
  if (Platform.OS === "web" || !Device.isDevice) return null;
  const granted = await ensureNotificationPermissions();
  if (!granted) return null;
  try {
    const projectId =
      (Constants?.expoConfig as any)?.extra?.eas?.projectId ||
      (Constants as any)?.easConfig?.projectId;
    if (!projectId) return null;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!token) return null;
    await api.post("/push/register", {
      token,
      lang,
      country,
      platform: Platform.OS,
    });
    return token;
  } catch {
    return null;
  }
}

// ============================================================
// FETCH TEASERS FROM BACKEND
// ============================================================
async function fetchTeasers(lang: Lang, month?: number, day?: number, count: number = 40): Promise<Teaser[]> {
  try {
    const params: any = { lang, count };
    if (month) params.month = month;
    if (day) params.day = day;
    const { data } = await api.get("/events/teasers", { params, timeout: 15000 });
    return Array.isArray(data?.teasers) ? data.teasers : [];
  } catch (e) {
    return [];
  }
}

// ============================================================
// SCHEDULE
// ============================================================
export async function scheduleRandomDailyNotifications(
  window: Window,
  lang: Lang,
  days: number = SCHEDULE_DAYS,
  perDay: number = INTENSITY_PER_DAY.normal
): Promise<{ ok: boolean; count: number }> {
  const ok = await ensureNotificationPermissions();
  if (!ok) return { ok: false, count: 0 };
  await setupAndroidChannels();
  await cancelAllNotifications();

  const range = WINDOW_RANGES[window];
  const now = new Date();
  let scheduled = 0;

  // Today's teasers double as the pool for days we don't fetch individually.
  const todayTeasers = await fetchTeasers(lang);

  for (let i = 0; i < days && scheduled < MAX_SCHEDULED; i++) {
    const target0 = new Date(now);
    target0.setDate(now.getDate() + i);

    // Fetch the real teasers for the next few days; further out we recycle,
    // because those notifications get rewritten long before they fire.
    let dayTeasers: Teaser[] = todayTeasers;
    if (i > 0 && i <= 3) {
      const t = await fetchTeasers(lang, target0.getMonth() + 1, target0.getDate(), 30);
      if (t.length > 0) dayTeasers = t;
    }

    const slots = perDay;
    const span = range.end - range.start;
    const segment = span / slots;

    // Shuffle so the same day never repeats a story
    const teaserOrder = dayTeasers.map((_, idx) => idx).sort(() => Math.random() - 0.5);

    for (let s = 0; s < slots && scheduled < MAX_SCHEDULED; s++) {
      const segStart = range.start + segment * s;
      const segEnd = segStart + segment;
      const hourFloat = randomInRange(segStart + 0.05, segEnd - 0.05);
      const hour = Math.floor(hourFloat);
      const minute = Math.floor((hourFloat - hour) * 60);

      const target = new Date(target0);
      target.setHours(hour, minute, 0, 0);
      if (target.getTime() <= now.getTime() + 60_000) continue;

      const teaser: Teaser | undefined = dayTeasers.length > 0
        ? dayTeasers[teaserOrder[s % teaserOrder.length]]
        : undefined;

      let content: Content;
      if (teaser) {
        content = buildContent(lang, teaser, i * 7 + s);
      } else {
        const fb = FALLBACK_TEMPLATES[lang] || FALLBACK_TEMPLATES.en;
        const chosen = fb[Math.floor(Math.random() * fb.length)];
        content = { ...chosen, anniversary: false };
      }

      try {
        await Notifications.scheduleNotificationAsync({
          identifier: `${NOTIFICATION_IDENTIFIER}-${target.getTime()}-${s}`,
          content: {
            title: content.title,
            body: content.body,
            sound: "default",
            priority: Notifications.AndroidNotificationPriority.MAX,
            vibrate: content.anniversary ? VIBRATION_ANNIVERSARY : VIBRATION_DAILY,
            color: content.anniversary ? "#FCA311" : "#E63946",
            interruptionLevel: content.anniversary ? "timeSensitive" : "active",
            data: teaser ? { eventId: teaser.id, year: teaser.year } : {},
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: target,
            channelId: content.anniversary ? CHANNEL_ANNIVERSARY : CHANNEL_DAILY,
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
  await setupAndroidChannels();
  try {
    const teasers = await fetchTeasers(lang, undefined, undefined, 20);
    let content: Content;
    if (teasers.length > 0) {
      const t = teasers[Math.floor(Math.random() * teasers.length)];
      content = buildContent(lang, t, Math.floor(Math.random() * 10));
    } else {
      const fb = FALLBACK_TEMPLATES[lang] || FALLBACK_TEMPLATES.en;
      content = { ...fb[Math.floor(Math.random() * fb.length)], anniversary: false };
    }
    await Notifications.scheduleNotificationAsync({
      identifier: `${NOTIFICATION_IDENTIFIER}-preview-${Date.now()}`,
      content: {
        title: content.title,
        body: content.body,
        sound: "default",
        priority: Notifications.AndroidNotificationPriority.MAX,
        vibrate: VIBRATION_DAILY,
        color: "#E63946",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 2,
        channelId: CHANNEL_DAILY,
      },
    });
    return true;
  } catch {
    return false;
  }
}
