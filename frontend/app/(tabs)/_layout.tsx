import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { Home, Compass, Heart, User } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../../src/theme";
import { useAuth } from "../../src/contexts/AuthContext";
import { t } from "../../src/i18n/translations";

export default function TabsLayout() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const lang = (user?.language as "it" | "en" | "es") || "it";

  // Add extra bottom padding to clear the Android system nav bar / iOS home indicator
  const bottomInset = insets.bottom || (Platform.OS === "android" ? 12 : 0);
  const tabHeight = 58 + bottomInset;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#0a0a0a",
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: tabHeight,
          paddingBottom: bottomInset + 4,
          paddingTop: 8,
        },
        tabBarActiveTintColor: COLORS.like,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarLabelStyle: { fontSize: 10, fontWeight: "700", letterSpacing: 1 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t(lang, "feed").toUpperCase(),
          tabBarIcon: ({ color }) => <Home color={color} size={22} strokeWidth={2.2} />,
          tabBarTestID: "tab-feed",
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: t(lang, "explore").toUpperCase(),
          tabBarIcon: ({ color }) => <Compass color={color} size={22} strokeWidth={2.2} />,
          tabBarTestID: "tab-explore",
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: t(lang, "favorites").toUpperCase(),
          tabBarIcon: ({ color }) => <Heart color={color} size={22} strokeWidth={2.2} />,
          tabBarTestID: "tab-favorites",
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t(lang, "profile").toUpperCase(),
          tabBarIcon: ({ color }) => <User color={color} size={22} strokeWidth={2.2} />,
          tabBarTestID: "tab-profile",
        }}
      />
    </Tabs>
  );
}
