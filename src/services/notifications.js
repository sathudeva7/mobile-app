/**
 * Notification Service
 * Handles push notification registration and sending.
 * Uses Expo Notifications + Firebase Cloud Messaging.
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { doc, updateDoc } from 'firebase/firestore';
import { db, COLLECTIONS } from './firebase.client';
import { expo as expoConfig } from '../config';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
  }),
});

// ─── Register device for push notifications ───────────────────────
export async function registerForPushNotifications(userId) {
  if (!Device.isDevice) {
    console.warn('Push notifications require a physical device.');
    return null;
  }

  // Request permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('Push notification permission denied.');
    return null;
  }

  // Android channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name:              'Rivnitz',
      importance:        Notifications.AndroidImportance.MAX,
      vibrationPattern:  [0, 250, 250, 250],
      lightColor:        '#D4933A',
    });

    await Notifications.setNotificationChannelAsync('live', {
      name:              'Rabbi Live Sessions',
      importance:        Notifications.AndroidImportance.MAX,
      vibrationPattern:  [0, 500, 250, 500],
      lightColor:        '#E05C5C',
      sound:             'default',
    });
  }

  // Get Expo push token (needs projectId from app.json extra or EXPO_PROJECT_ID)
  const projectId = expoConfig.projectId || undefined;
  const token = (await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : {}
  )).data;

  // Save token to user profile
  if (userId && token && db) {
    await updateDoc(doc(db, COLLECTIONS.USERS, userId), {
      expoPushToken: token,
      pushEnabled:   true,
    });
  }

  return token;
}

// ─── Schedule morning motivation notification ─────────────────────
export async function scheduleMorningMotivation(hour = 9, minute = 0) {
  // Cancel existing morning notifications first
  await cancelMorningNotifications();

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🔥 Good morning — your daily intention awaits',
      body:  'Open Rivnitz to see your personalized guidance for today.',
      data:  { screen: 'Growth' },
    },
    trigger: {
      type:   Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

// ─── Cancel morning notifications ────────────────────────────────
export async function cancelMorningNotifications() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const notif of scheduled) {
    if (notif.content.data?.screen === 'Growth') {
      await Notifications.cancelScheduledNotificationAsync(notif.identifier);
    }
  }
}  

// ─── Listen for notification interactions ────────────────────────
// Call this in App.js to handle navigation from notification taps
export function setupNotificationListeners(navigationRef) {
  // Notification received while app is open
  const foregroundSub = Notifications.addNotificationReceivedListener(notification => {
    console.log('Notification received (foreground):', notification);
  });

  // User tapped a notification
  const responseSub = Notifications.addNotificationResponseReceivedListener(response => {
    const screen = response.notification.request.content.data?.screen;
    if (screen && navigationRef?.current) {
      navigationRef.current.navigate(screen);
    }
  });

  // Return cleanup function
  return () => {
    foregroundSub.remove();
    responseSub.remove();
  };
}

export default {
  registerForPushNotifications,
  scheduleMorningMotivation,
  cancelMorningNotifications,
  setupNotificationListeners,
};
