import React, { useEffect, useMemo, useRef } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Animated,
  Platform,
  useWindowDimensions,
} from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = BottomTabBarProps & {
  ACTIVE_BOX: string;
  BAR_BG: string;
  ACTIVE_TINT: string;
  INACTIVE_TINT: string;
  BORDER: string;
};

export default function AnimatedTabBar(props: Props) {
  const {
    state,
    descriptors,
    navigation,
    ACTIVE_BOX,
    BAR_BG,
    INACTIVE_TINT,
    BORDER,
  } = props;

  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const routes = state.routes;
  const tabCount = routes.length;

  // ✅ Pull tabBarStyle from options (so reserved space == rendered space)
  const firstKey = routes[0]?.key;
  const opts = firstKey ? descriptors[firstKey]?.options : undefined;
  const tabBarStyle: any = opts?.tabBarStyle || {};

  const STYLE_HEIGHT = typeof tabBarStyle?.height === "number" ? tabBarStyle.height : (Platform.OS === "ios" ? 88 : 60);
  const STYLE_PAD_TOP = typeof tabBarStyle?.paddingTop === "number" ? tabBarStyle.paddingTop : 2;
  const STYLE_PAD_BOTTOM =
    typeof tabBarStyle?.paddingBottom === "number"
      ? tabBarStyle.paddingBottom
      : (Platform.OS === "ios" ? 28 : 10);

  const barHeight = STYLE_HEIGHT;

  // ✅ bottom padding + safe area (keeps perfect across gesture/3-button phones)
  const bottomPad = Math.max(STYLE_PAD_BOTTOM, insets.bottom);

  // spacing (same style as your design)
  const H_PADDING = 10;
  const GAP = 10;

  const itemW = useMemo(() => {
    const available = width - H_PADDING * 2 - GAP * (tabCount - 1);
    return Math.max(50, Math.floor(available / tabCount));
  }, [width, tabCount]);

  // ✅ highlight box size (keep your look)
  const BOX_H = 60;
  const BOX_TOP =Math.max(0, STYLE_PAD_TOP - 18);

  // ✅ touch area uses the same bar space
  const ITEM_H = Math.max(44, barHeight - STYLE_PAD_TOP - bottomPad);

  // push content slightly
  const CONTENT_BOTTOM = Platform.OS === "ios" ? 8 : 6;

  // sliding active box X
  const x = useRef(new Animated.Value(0)).current;

  const targetX = useMemo(() => {
    const idx = state.index;
    return H_PADDING + idx * (itemW + GAP);
  }, [state.index, itemW]);

  useEffect(() => {
    Animated.spring(x, {
      toValue: targetX,
      useNativeDriver: true,
      damping: 18,
      stiffness: 190,
      mass: 0.9,
    }).start();
  }, [targetX, x]);

  const onPress = (routeKey: string, routeName: string, isFocused: boolean) => {
    const event = navigation.emit({
      type: "tabPress",
      target: routeKey,
      canPreventDefault: true,
    });

    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate(routeName as never);
    }
  };

  const onLongPress = (routeKey: string) => {
    navigation.emit({ type: "tabLongPress", target: routeKey });
  };

  const WRAP_POSITION = Platform.OS === "web" ? ("fixed" as any) : ("absolute" as const);

  return (
    <View
      style={[
        styles.wrap,
        {
          position: WRAP_POSITION,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9999,
          elevation: 30,
          backgroundColor: BAR_BG,
        },
      ]}
    >
      <View
        style={[
          styles.bar,
          {
            backgroundColor: BAR_BG,
            borderTopColor: BORDER,
            height: barHeight,
            paddingTop: STYLE_PAD_TOP,
            paddingBottom: bottomPad,
          },
        ]}
      >
        {/* active sliding highlight box */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.activeBox,
            {
              backgroundColor: ACTIVE_BOX,
              width: itemW,
              height: BOX_H,
              top: BOX_TOP,
              transform: [{ translateX: x }],
            },
          ]}
        />

        <View style={[styles.row, { paddingHorizontal: H_PADDING }]}>
          {routes.map((route, index) => {
            const isFocused = state.index === index;
            const options = descriptors[route.key].options;

            const icon =
              typeof options.tabBarIcon === "function"
                ? options.tabBarIcon({
                    focused: isFocused,
                    color: isFocused ? "#FFFFFF" : INACTIVE_TINT,
                    size: 24,
                  })
                : null;

            const label =
              options.tabBarLabel !== undefined
                ? options.tabBarLabel
                : options.title !== undefined
                ? options.title
                : route.name;

            const tint = isFocused ? "#FFFFFF" : INACTIVE_TINT;

            return (
              <Pressable
                key={route.key}
                onPress={() => onPress(route.key, route.name, isFocused)}
                onLongPress={() => onLongPress(route.key)}
                style={[
                  styles.item,
                  {
                    width: itemW,
                    height: ITEM_H,
                    marginRight: index === tabCount - 1 ? 0 : GAP,
                  },
                ]}
              >
                <View style={[styles.content, { paddingBottom: CONTENT_BOTTOM }]}>
                  {icon}
                  <Animated.Text
                    allowFontScaling={false}
                    style={[
                      styles.label,
                      { color: tint },
                      options.tabBarLabelStyle as any,
                    ]}
                    numberOfLines={1}
                  >
                    {String(label)}
                  </Animated.Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {},
  bar: {
    borderTopWidth: 1,
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  activeBox: {
    position: "absolute",
    left: 0,
    borderRadius: 12,
  },
  item: {
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  content: {
    alignItems: "center",
  },
  label: {
    marginTop: 3,
  },
});