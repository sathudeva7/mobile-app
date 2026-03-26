/**
 * Rivnitz App — Entry Point
 */

import React, { useEffect } from 'react';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import RootNavigator from './src/navigation';
import { useAuthStore } from './src/store/authStore';

SplashScreen.preventAutoHideAsync();

export default function App() {
  const { initAuth } = useAuthStore();

  const [fontsLoaded] = useFonts({
    'CormorantGaramond-Regular': require('./assets/fonts/CormorantGaramond-Regular.ttf'),
    'CormorantGaramond-Bold':    require('./assets/fonts/CormorantGaramond-Bold.ttf'),
    'DMSans-Regular':            require('./assets/fonts/DMSans-Regular.ttf'),
    'DMSans-Medium':             require('./assets/fonts/DMSans-Medium.ttf'),
    'DMSans-SemiBold':           require('./assets/fonts/DMSans-SemiBold.ttf'),
  });

  useEffect(() => {
    initAuth();
  }, []);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <RootNavigator />
    </GestureHandlerRootView>
  );
}
