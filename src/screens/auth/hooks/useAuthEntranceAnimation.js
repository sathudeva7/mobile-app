import { useRef, useEffect } from 'react';
import { Animated } from 'react-native';

/**
 * Fade + slide-in for auth header and form blocks.
 * Tuning matches previous LoginScreen / SignUpScreen timings.
 */
export default function useAuthEntranceAnimation(options = {}) {
  const {
    staggerMs = 200,
    headerDuration = 700,
    formDuration = 600,
    headerTranslateY = 28,
    formTranslateY = 24,
  } = options;

  const headerAnim = useRef(new Animated.Value(0)).current;
  const formAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(staggerMs, [
      Animated.timing(headerAnim, {
        toValue: 1,
        duration: headerDuration,
        useNativeDriver: true,
      }),
      Animated.timing(formAnim, {
        toValue: 1,
        duration: formDuration,
        useNativeDriver: true,
      }),
    ]).start();
  }, [headerAnim, formAnim, staggerMs, headerDuration, formDuration]);

  const headerStyle = {
    opacity: headerAnim,
    transform: [
      {
        translateY: headerAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [headerTranslateY, 0],
        }),
      },
    ],
  };

  const formStyle = {
    opacity: formAnim,
    transform: [
      {
        translateY: formAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [formTranslateY, 0],
        }),
      },
    ],
  };

  return { headerStyle, formStyle };
}
