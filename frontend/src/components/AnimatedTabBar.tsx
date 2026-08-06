import React, { useEffect } from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Home, Compass, Heart, User } from "lucide-react-native";
import { useTheme } from "../contexts/ThemeContext";

const ICONS: Record<string, React.ComponentType<any>> = {
  index: Home,
  explore: Compass,
  favorites: Heart,
  profile: User,
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Springs tuned to feel answered rather than bouncy: quick, with just enough
// overshoot to read as physical. Anything springier starts to feel like a toy.
const SPRING = { damping: 15, stiffness: 220, mass: 0.6 };

type ItemProps = {
  label: string;
  routeName: string;
  focused: boolean;
  color: string;
  activeColor: string;
  onPress: () => void;
  onLongPress: () => void;
};

function TabItem({ label, routeName, focused, color, activeColor, onPress, onLongPress }: ItemProps) {
  const Icon = ICONS[routeName] || Home;
  // 0 = at rest, 1 = selected. Icon and label are both derived from this one
  // value, so they can never disagree with each other.
  const active = useSharedValue(focused ? 1 : 0);
  const pressed = useSharedValue(0);

  useEffect(() => {
    active.value = withSpring(focused ? 1 : 0, SPRING);
  }, [focused, active]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(active.value, [0, 1], [1, 1.18]) * (1 - pressed.value * 0.12) },
      { translateY: interpolate(active.value, [0, 1], [0, -3]) },
    ],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(active.value, [0, 1], [0.6, 1]),
    transform: [{ translateY: interpolate(active.value, [0, 1], [0, 1]) }],
  }));

  return (
    <AnimatedPressable
      testID={`tab-${routeName}`}
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      onPress={() => {
        // A tab you can feel is a tab you trust you actually hit.
        if (Platform.OS !== "web") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
        onPress();
      }}
      onLongPress={onLongPress}
      onPressIn={() => { pressed.value = withTiming(1, { duration: 90 }); }}
      onPressOut={() => { pressed.value = withTiming(0, { duration: 140 }); }}
      style={styles.item}
    >
      <Animated.View style={iconStyle}>
        <Icon color={focused ? activeColor : color} size={23} strokeWidth={focused ? 2.6 : 2.1} />
      </Animated.View>
      <Animated.Text
        numberOfLines={1}
        style={[styles.label, { color: focused ? activeColor : color }, labelStyle]}
      >
        {label}
      </Animated.Text>
    </AnimatedPressable>
  );
}

/**
 * Bottom bar with a sliding highlight.
 *
 * The default bar just recoloured an icon, which gave no sense of moving from
 * one place to another. Here a single pill slides to the selected tab, so the
 * change of place is something you watch happen rather than infer.
 */
export default function AnimatedTabBar({
  state, descriptors, navigation, bottomInset, height,
}: BottomTabBarProps & { bottomInset: number; height: number }) {
  const { colors } = useTheme();
  const count = state.routes.length;
  const slide = useSharedValue(state.index);

  useEffect(() => {
    slide.value = withSpring(state.index, SPRING);
  }, [state.index, slide]);

  const pillStyle = useAnimatedStyle(() => ({
    left: `${(slide.value * 100) / count}%`,
    width: `${100 / count}%`,
  }));

  return (
    <View
      style={[
        styles.bar,
        {
          height,
          paddingBottom: bottomInset,
          backgroundColor: colors.tabBar,
          borderTopColor: colors.border,
        },
      ]}
    >
      <Animated.View style={[styles.pillWrap, pillStyle]} pointerEvents="none">
        <View style={[styles.pill, { backgroundColor: colors.like }]} />
      </Animated.View>

      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label = String(options.title ?? route.name);
        const focused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            // The navigator's own types insist on `never` here; the route name
            // is the only correct value to pass, so it goes through untyped.
            (navigation.navigate as (name: string, params?: object) => void)(
              route.name, route.params
            );
          }
        };

        return (
          <TabItem
            key={route.key}
            label={label}
            routeName={route.name}
            focused={focused}
            color={colors.textSecondary}
            activeColor={colors.like}
            onPress={onPress}
            onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    borderTopWidth: 1,
    paddingTop: 10,
  },
  pillWrap: {
    position: "absolute",
    top: 0,
    alignItems: "center",
  },
  pill: {
    width: 34,
    height: 3,
    borderRadius: 2,
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 4,
    // Comfortably past the 44px minimum touch target, thumb included.
    minHeight: 48,
  },
  label: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
});
