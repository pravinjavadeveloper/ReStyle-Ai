import React, { useEffect } from "react";
import { View, Image, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

type Props = {
  garmentUri: string;
  onTransformChange?: (t: { x: number; y: number; scale: number; rot: number }) => void;
  initial?: { x?: number; y?: number; scale?: number; rot?: number };
  autoFitKey?: string; // change to trigger autofit
};

export default function TryOnOverlay({
  garmentUri,
  onTransformChange,
  initial,
  autoFitKey,
}: Props) {
  const x = useSharedValue(initial?.x ?? 0);
  const y = useSharedValue(initial?.y ?? 0);
  const scale = useSharedValue(initial?.scale ?? 1);
  const rot = useSharedValue(initial?.rot ?? 0);

  const savedScale = useSharedValue(scale.value);
  const savedRot = useSharedValue(rot.value);

  const notify = () => {
    onTransformChange?.({
      x: x.value,
      y: y.value,
      scale: scale.value,
      rot: rot.value,
    });
  };

  const pan = Gesture.Pan()
    .onChange((e) => {
      x.value += e.changeX;
      y.value += e.changeY;
    })
    .onEnd(() => {
      if (onTransformChange) runOnJS(notify)();
    });

  const pinch = Gesture.Pinch()
    .onBegin(() => {
      savedScale.value = scale.value;
    })
    .onChange((e) => {
      const next = savedScale.value * e.scale;
      scale.value = Math.max(0.25, Math.min(next, 4));
    })
    .onEnd(() => {
      if (onTransformChange) runOnJS(notify)();
    });

  const rotate = Gesture.Rotation()
    .onBegin(() => {
      savedRot.value = rot.value;
    })
    .onChange((e) => {
      rot.value = savedRot.value + e.rotation;
    })
    .onEnd(() => {
      if (onTransformChange) runOnJS(notify)();
    });

  const composed = Gesture.Simultaneous(pan, pinch, rotate);

  const aStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: x.value },
        { translateY: y.value },
        { scale: scale.value },
        { rotateZ: `${rot.value}rad` },
      ],
    };
  });

  // Auto-fit trigger: reset smoothly (caller sets x/y/scale before changing key if you want)
  useEffect(() => {
    // Keep it simple: bounce garment to center and standard scale
    x.value = withTiming(0, { duration: 220 });
    y.value = withTiming(0, { duration: 220 });
    scale.value = withTiming(1, { duration: 220 });
    rot.value = withTiming(0, { duration: 220 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFitKey]);

  if (!garmentUri) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <GestureDetector gesture={composed}>
        <Animated.View style={[styles.wrap, aStyle]}>
          <Image source={{ uri: garmentUri }} style={styles.img} resizeMode="contain" />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 280,
    height: 360,
    marginLeft: -140,
    marginTop: -180,
  },
  img: { width: "100%", height: "100%" },
});