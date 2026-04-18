import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { Lang } from "../i18n/translations";

export const NOTIFICATION_IDENTIFIER = "accadde-oggi";
export const SCHEDULE_DAYS = 30;

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

const TEMPLATES: Record<Lang, { title: string; body: string }[]> = {
  it: [
    { title: "📜 Accadde Oggi", body: "Un evento storico ti aspetta. Scoprilo ora." },
    { title: "🕰️ Oggi nella storia", body: "Qualcosa di straordinario è successo in questa data." },
    { title: "⚡ Nuovo giorno, nuova storia", body: "Apri l'app e tuffati nel passato." },
    { title: "🎭 Accadde Oggi", body: "Cosa successe oggi, 50, 100, 500 anni fa?" },
    { title: "🌍 Oggi nel mondo", body: "Un anniversario storico ti sta aspettando." },
    { title: "📖 La storia ti chiama", body: "3 minuti, 10 eventi incredibili. Vieni a leggerli." },
    { title: "🗓️ Accadde Oggi", body: "Non perdere l'evento del giorno scelto per te." },
    { title: "✨ Storia personalizzata", body: "Nuovi eventi basati sui tuoi gusti ti aspettano." },
  ],
  en: [
    { title: "📜 On This Day", body: "A historic event is waiting for you. Discover it now." },
    { title: "🕰️ Today in history", body: "Something extraordinary happened on this date." },
    { title: "⚡ New day, new story", body: "Open the app and dive into the past." },
    { title: "🎭 On This Day", body: "What happened today, 50, 100, 500 years ago?" },
    { title: "🌍 Today in the world", body: "A historical anniversary is waiting for you." },
    { title: "📖 History calls", body: "3 minutes, 10 incredible events. Come read them." },
    { title: "🗓️ On This Day", body: "Don't miss today's event picked for you." },
    { title: "✨ Personalized history", body: "New events based on your taste are here." },
  ],
  es: [
    { title: "📜 Un Día Como Hoy", body: "Un evento histórico te espera. Descúbrelo." },
    { title: "🕰️ Hoy en la historia", body: "Algo extraordinario pasó en esta fecha." },
    { title: "⚡ Nuevo día, nueva historia", body: "Abre la app y sumérgete en el pasado." },
    { title: "🎭 Un Día Como Hoy", body: "¿Qué pasó hoy hace 50, 100, 500 años?" },
    { title: "🌍 Hoy en el mundo", body: "Un aniversario histórico te espera." },
    { title: "📖 La historia llama", body: "3 minutos, 10 eventos increíbles. Ven a leerlos." },
    { title: "🗓️ Un Día Como Hoy", body: "No te pierdas el evento de hoy elegido para ti." },
    { title: "✨ Historia personalizada", body: "Nuevos eventos según tus gustos te esperan." },
  ],
};

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

/**
 * Schedule N days of notifications with randomized times within a window.
 * Each day picks a random hour:minute inside the user's chosen window
 * and a random content template — so the user is never habituated to a fixed slot.
 */
export async function scheduleRandomDailyNotifications(
  window: Window,
  lang: Lang,
  days: number = SCHEDULE_DAYS
): Promise<{ ok: boolean; count: number }> {
  const ok = await ensureNotificationPermissions();
  if (!ok) return { ok: false, count: 0 };
  await setupAndroidChannel();
  await cancelAllNotifications();

  const range = WINDOW_RANGES[window];
  const templates = TEMPLATES[lang] || TEMPLATES.en;
  const now = new Date();
  let scheduled = 0;

  for (let i = 0; i < days; i++) {
    const target = new Date(now);
    target.setDate(now.getDate() + i);

    // Random hour+minute within window
    const hourFloat = randomInRange(range.start, range.end);
    const hour = Math.floor(hourFloat);
    const minute = Math.floor((hourFloat - hour) * 60);

    target.setHours(hour, minute, 0, 0);

    // Skip if the computed time for today has already passed
    if (target.getTime() <= now.getTime() + 60_000) continue;

    // Random template for variety
    const tpl = templates[Math.floor(Math.random() * templates.length)];

    try {
      await Notifications.scheduleNotificationAsync({
        identifier: `${NOTIFICATION_IDENTIFIER}-${target.getTime()}`,
        content: {
          title: tpl.title,
          body: tpl.body,
          sound: "default",
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: target,
        },
      });
      scheduled++;
    } catch (e) {
      // keep going
    }
  }

  return { ok: true, count: scheduled };
}

export async function getScheduledInfo(): Promise<{
  count: number;
  nextDate?: Date;
}> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const ours = scheduled.filter((n) => n.identifier?.startsWith(NOTIFICATION_IDENTIFIER));
    if (ours.length === 0) return { count: 0 };
    const dates: Date[] = [];
    for (const n of ours) {
      const trig: any = n.trigger;
      const ts = trig?.value || trig?.timestamp || trig?.date;
      if (typeof ts === "number") dates.push(new Date(ts));
      else if (ts instanceof Date) dates.push(ts);
    }
    dates.sort((a, b) => a.getTime() - b.getTime());
    return { count: ours.length, nextDate: dates[0] };
  } catch {
    return { count: 0 };
  }
}
