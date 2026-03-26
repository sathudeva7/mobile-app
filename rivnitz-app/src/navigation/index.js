/**
 * Rivnitz App — Navigation
 * 
 * Structure:
 *   RootNavigator
 *   ├── AuthStack        (not logged in)
 *   │   ├── LoginScreen
 *   │   ├── SignUpScreen
 *   │   └── OnboardingScreen (nature quiz)
 *   └── AppDrawer        (logged in)
 *       ├── MainTabs
 *       │   ├── HomeScreen       (video feed)
 *       │   ├── CoachScreen      (AI chat)
 *       │   ├── CommunityScreen  (public chat)
 *       │   └── GrowthScreen     (daily tracker)
 *       ├── PrayersScreen
 *       ├── LiveSessionScreen
 *       ├── ProfileScreen
 *       └── SettingsScreen
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Colors, Typography, Spacing, Radius } from '../theme';
import { useAuthStore } from '../store/authStore';

// ─── Screen Imports ───────────────────────────────────────────────
// Auth
import LoginScreen        from '../screens/auth/LoginScreen';
import SignUpScreen       from '../screens/auth/SignUpScreen';
import OnboardingScreen   from '../screens/auth/OnboardingScreen';
import NatureQuizScreen   from '../screens/auth/NatureQuizScreen';
import ProfileSetupScreen from '../screens/auth/ProfileSetupScreen';

// Main tabs
import HomeScreen         from '../screens/home/HomeScreen';
import VideoPlayerScreen  from '../screens/home/VideoPlayerScreen';
import CoachScreen        from '../screens/coach/CoachScreen';
import CommunityScreen    from '../screens/community/CommunityScreen';
import GrowthScreen       from '../screens/growth/GrowthScreen';

// Sidebar
import PrayersScreen      from '../screens/prayers/PrayersScreen';
import LiveSessionScreen  from '../screens/live/LiveSessionScreen';
import ProfileScreen      from '../screens/profile/ProfileScreen';
import SettingsScreen     from '../screens/profile/SettingsScreen';

// ─── Navigators ───────────────────────────────────────────────────
const Stack  = createNativeStackNavigator();
const Tab    = createBottomTabNavigator();
const Drawer = createDrawerNavigator();

// ─── Bottom Tab Navigator ─────────────────────────────────────────
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: Colors.teal,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ color, focused }) => {
          const icons = {
            Home:      '🏠',
            Coach:     '🤖',
            Community: '💬',
            Growth:    '📈',
          };
          return (
            <View style={styles.tabIconWrap}>
              <Text style={[styles.tabIcon, { opacity: focused ? 1 : 0.5 }]}>
                {icons[route.name]}
              </Text>
              {focused && <View style={styles.tabDot} />}
            </View>
          );
        },
      })}
    >
      <Tab.Screen name="Home"      component={HomeScreen} />
      <Tab.Screen name="Coach"     component={CoachScreen} />
      <Tab.Screen name="Community" component={CommunityScreen} />
      <Tab.Screen name="Growth"    component={GrowthScreen} />
    </Tab.Navigator>
  );
}

// ─── Custom Drawer Content ────────────────────────────────────────
function CustomDrawerContent({ navigation }) {
  const { user, signOut } = useAuthStore();

  const menuItems = [
    { section: 'Main', items: [
      { label: 'Home',           icon: '🏠', screen: 'MainTabs' },
      { label: 'AI Coach',       icon: '🤖', screen: 'MainTabs' },
      { label: 'Community',      icon: '💬', screen: 'MainTabs' },
      { label: 'Daily Growth',   icon: '📈', screen: 'MainTabs' },
    ]},
    { section: 'Spiritual', items: [
      { label: 'Prayer & Blessings', icon: '🕯️', screen: 'Prayers' },
      { label: 'Rabbi Live',         icon: '📺', screen: 'Live',   badge: 'LIVE' },
      { label: 'Teaching Library',   icon: '📚', screen: 'Home' },
    ]},
    { section: 'Account', items: [
      { label: 'My Profile',   icon: '👤', screen: 'Profile' },
      { label: 'Settings',     icon: '⚙️', screen: 'Settings' },
      { label: 'Subscription', icon: '💳', screen: 'Settings' },
    ]},
  ];

  return (
    <View style={styles.drawer}>
      {/* User profile area */}
      <View style={styles.drawerHeader}>
        <View style={styles.drawerAvatar}>
          <Text style={styles.drawerAvatarText}>👤</Text>
        </View>
        <Text style={styles.drawerName}>{user?.displayName || 'Welcome'}</Text>
        <Text style={styles.drawerSub}>
          {user?.membershipTier || 'Member'}
        </Text>
        {user?.personalityType && (
          <View style={styles.drawerBadge}>
            <Text style={styles.drawerBadgeText}>
              🔥 {user.personalityType}
            </Text>
          </View>
        )}
      </View>

      {/* Menu items */}
      <View style={styles.drawerMenu}>
        {menuItems.map((group) => (
          <View key={group.section}>
            <Text style={styles.drawerSection}>{group.section}</Text>
            {group.items.map((item) => (
              <TouchableOpacity
                key={item.label}
                style={styles.drawerItem}
                onPress={() => navigation.navigate(item.screen)}
              >
                <Text style={styles.drawerItemIcon}>{item.icon}</Text>
                <Text style={styles.drawerItemLabel}>{item.label}</Text>
                {item.badge && (
                  <View style={styles.liveBadge}>
                    <Text style={styles.liveBadgeText}>{item.badge}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        ))}

        {/* Sign out */}
        <TouchableOpacity style={styles.drawerItem} onPress={signOut}>
          <Text style={styles.drawerItemIcon}>🚪</Text>
          <Text style={[styles.drawerItemLabel, { color: Colors.error }]}>
            Sign Out
          </Text>
        </TouchableOpacity>
      </View>

      {/* Brand footer */}
      <View style={styles.drawerFooter}>
        <Text style={styles.drawerFooterFlame}>🔥</Text>
        <View>
          <Text style={styles.drawerFooterName}>Rivnitz</Text>
          <Text style={styles.drawerFooterTagline}>Miracles Through Mission</Text>
        </View>
      </View>
    </View>
  );
}

// ─── App Drawer Navigator ─────────────────────────────────────────
function AppDrawer() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerPosition: 'right',
        drawerStyle: styles.drawerContainer,
      }}
    >
      <Drawer.Screen name="MainTabs" component={MainTabs} />
      <Drawer.Screen name="Prayers"  component={PrayersScreen} />
      <Drawer.Screen name="Live"     component={LiveSessionScreen} />
      <Drawer.Screen name="Profile"  component={ProfileScreen} />
      <Drawer.Screen name="Settings" component={SettingsScreen} />
    </Drawer.Navigator>
  );
}

// ─── Auth Stack ───────────────────────────────────────────────────
function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login"        component={LoginScreen} />
      <Stack.Screen name="SignUp"       component={SignUpScreen} />
      <Stack.Screen name="Onboarding"   component={OnboardingScreen} />
      <Stack.Screen name="NatureQuiz"   component={NatureQuizScreen} />
      <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
    </Stack.Navigator>
  );
}

// ─── App Stack (Drawer + modal screens) ──────────────────────────
const AppStack = createNativeStackNavigator();

function AppNavigator() {
  return (
    <AppStack.Navigator screenOptions={{ headerShown: false }}>
      <AppStack.Screen name="Drawer" component={AppDrawer} />
      <AppStack.Screen name="VideoPlayer" component={VideoPlayerScreen} />
      <AppStack.Screen name="NatureQuiz" component={NatureQuizScreen} />
      <AppStack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
    </AppStack.Navigator>
  );
}

// ─── Root Navigator ───────────────────────────────────────────────
export default function RootNavigator() {
  const { isLoggedIn, hasCompletedOnboarding } = useAuthStore();

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        {isLoggedIn ? <AppNavigator /> : <AuthStack />}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

// ─── Styles ───────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Bottom tabs
  tabBar: {
    backgroundColor: Colors.white,
    borderTopColor: Colors.borderLight,
    borderTopWidth: 1,
    paddingBottom: 8,
    paddingTop: 8,
    height: 60,
  },
  tabLabel: {
    fontSize: 9,
    fontFamily: Typography.body,
  },
  tabIconWrap: {
    alignItems: 'center',
    gap: 2,
  },
  tabIcon: {
    fontSize: 20,
  },
  tabDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.gold,
  },

  // Drawer
  drawerContainer: {
    width: 260,
    backgroundColor: Colors.white,
  },
  drawer: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  drawerHeader: {
    backgroundColor: Colors.tealDark,
    padding: Spacing.lg,
    paddingTop: Spacing['3xl'],
  },
  drawerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  drawerAvatarText: { fontSize: 22 },
  drawerName: {
    fontFamily: Typography.heading,
    fontSize: Typography.sizes.lg,
    color: Colors.white,
    marginBottom: 2,
  },
  drawerSub: {
    fontSize: Typography.sizes.xs,
    color: Colors.goldLight,
  },
  drawerBadge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    marginTop: Spacing.xs,
  },
  drawerBadgeText: {
    fontSize: Typography.sizes.xs,
    color: Colors.goldLight,
  },
  drawerMenu: {
    flex: 1,
    paddingVertical: Spacing.sm,
  },
  drawerSection: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontFamily: Typography.bodySemiBold,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  drawerItemIcon: { fontSize: 16 },
  drawerItemLabel: {
    fontSize: Typography.sizes.md,
    color: Colors.textPrimary,
    fontFamily: Typography.body,
    flex: 1,
  },
  liveBadge: {
    backgroundColor: Colors.error,
    borderRadius: Radius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  liveBadgeText: {
    fontSize: Typography.sizes.xs,
    color: Colors.white,
    fontFamily: Typography.bodySemiBold,
  },
  drawerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.base,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  drawerFooterFlame: { fontSize: 16 },
  drawerFooterName: {
    fontFamily: Typography.heading,
    fontSize: Typography.sizes.md,
    color: Colors.teal,
  },
  drawerFooterTagline: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
  },
});
