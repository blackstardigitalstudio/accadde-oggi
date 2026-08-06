import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Height of the bar itself, above the safe-area padding. */
export const TAB_BAR_CONTENT_HEIGHT = 58;

/**
 * The one place that decides how tall the bottom bar is.
 *
 * The feed sizes each card as "screen minus bar" and the bar sizes itself:
 * when the two worked it out separately they disagreed by 12px, leaving a gap
 * at the bottom of every card through which the next card showed. It only
 * looked like a glitch when the next image happened to be bright.
 */
export function useTabBarHeight() {
  const insets = useSafeAreaInsets();
  const bottomInset = insets.bottom || (Platform.OS === "android" ? 12 : 0);
  return {
    bottomInset,
    height: TAB_BAR_CONTENT_HEIGHT + bottomInset,
  };
}
