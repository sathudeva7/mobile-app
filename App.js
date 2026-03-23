/**
 * Rivnitz App — Entry Point
 */

import React, { useEffect } from 'react';
import {
  useFonts,
  CormorantGaramond_400Regular,
  CormorantGaramond_700Bold,
} from '@expo-google-fonts/cormorant-garamond';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
} from '@expo-google-fonts/dm-sans';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { StripeProvider } from '@stripe/stripe-react-native';
import RootNavigator from './src/navigation';
import { useAuthStore } from './src/store/authStore';
import { googleSignIn, stripe } from './src/config';

SplashScreen.preventAutoHideAsync();

export default function App() {
  const { initAuth } = useAuthStore();

  const [fontsLoaded] = useFonts({
    CormorantGaramond_400Regular,
    CormorantGaramond_700Bold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
  });

  useEffect(() => {
    try {
      GoogleSignin.configure({
        webClientId:   googleSignIn.webClientId,
        iosClientId:   googleSignIn.iosClientId,
        offlineAccess: false,
      });
    } catch (e) {
      console.warn('GoogleSignin.configure failed:', e);
    }
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
      <StripeProvider
        publishableKey={stripe.publishableKey}
        merchantIdentifier="merchant.com.rivnitz"
      >
        <RootNavigator />
      </StripeProvider>
    </GestureHandlerRootView>
  );
}
