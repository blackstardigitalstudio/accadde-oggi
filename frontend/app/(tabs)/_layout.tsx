import { Tabs } from "expo-router";
import { Home, Compass, Heart, User } from "lucide-react-native";
import { useAuth } from "../../src/contexts/AuthContext";
import { useTheme } from "../../src/contexts/ThemeContext";
import { t } from "../../src/i18n/translations";
import AnimatedTabBar from "../../src/components/AnimatedTabBar";
import { useTabBarHeight } from "../../src/hooks/useTabBarHeight";

export default function TabsLayout() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const lang = (user?.language as "it" | "en" | "es") || "it";
  // Shared with the feed, so the cards and the bar can never disagree.
  const { bottomInset, height: tabHeight } = useTabBarHeight();

  return (
    <Tabs
      // The bar draws itself: a highlight slides to the tab you picked, the icon
      // lifts, and the phone gives a small tap back. The stock bar only changed
      // a colour, which never quite reads as "I moved somewhere".
      tabBar={(props) => (
        <AnimatedTabBar {...props} bottomInset={bottomInset} height={tabHeight} />
      )}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.like,
        tabBarInactiveTintColor: colors.textSecondary,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t(lang, "feed").toUpperCase(),
          tabBarIcon: ({ color }) => <Home color={color} size={22} strokeWidth={2.2} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: t(lang, "explore").toUpperCase(),
          tabBarIcon: ({ color }) => <Compass color={color} size={22} strokeWidth={2.2} />,
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: t(lang, "favorites").toUpperCase(),
          tabBarIcon: ({ color }) => <Heart color={color} size={22} strokeWidth={2.2} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t(lang, "profile").toUpperCase(),
          tabBarIcon: ({ color }) => <User color={color} size={22} strokeWidth={2.2} />,
        }}
      />
    </Tabs>
  );
}
