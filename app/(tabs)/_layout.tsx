import React from 'react';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Radius } from '../../src/design-system/tokens';
import { useAuth } from '../../src/context/AuthContext';

interface TabIconProps {
  name: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  focused: boolean;
  color: any;
}

const TabIcon: React.FC<TabIconProps> = ({ name, label, focused, color }) => (
  <View style={styles.tabItem}>
    <View style={focused ? styles.activeIconBg : styles.iconBg}>
      <View><Ionicons name={name} size={20} color={focused ? '#fff' : color} /></View>
    </View>
    <Text style={[styles.tabLabel, { color: focused ? Colors.primary : color, fontWeight: focused ? '700' : '500' }]}>{label}</Text>
  </View>
);

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'android' ? 12 : 0);
  const { canViewModule } = useAuth();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: [styles.tabBar, {
          height: (Platform.OS === 'ios' ? 60 : 56) + bottomPad,
          paddingBottom: bottomPad,
        }],
        tabBarItemStyle: { paddingTop: 8 },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.gray400,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name={focused ? 'home' : 'home-outline'} label="Home" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          title: 'Attendance',
          href: canViewModule('attendance') ? undefined : null,
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name={focused ? 'time' : 'time-outline'} label="Attend" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="leaves"
        options={{
          title: 'Leaves',
          href: canViewModule('leaves') ? undefined : null,
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name={focused ? 'calendar' : 'calendar-outline'} label="Leaves" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="announcements"
        options={{
          title: 'Announcements',
          href: canViewModule('announcements') ? undefined : null,
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name={focused ? 'megaphone' : 'megaphone-outline'} label="Notice" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name={focused ? 'person' : 'person-outline'} label="Profile" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon name={focused ? 'grid' : 'grid-outline'} label="More" focused={focused} color={color} />
          ),
        }}
      />

      {/* Hidden from footer — accessible via Quick Actions */}
      <Tabs.Screen
        name="tasks"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="leads"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="leads-form"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 0,
    paddingTop: 8,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px -4px 16px rgba(77,168,218,0.10)' }
      : { shadowColor: '#4DA8DA', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.10, shadowRadius: 16, elevation: 20 }
    ),
  },
  tabItem: {
    alignItems: 'center', justifyContent: 'center',
    minWidth: 38, minHeight: 44, gap: 2,
  },
  tabItemFocused: {},
  iconBg: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 2,
  },
  activeIconBg: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 2,
  },
  tabLabel: { fontSize: 10, letterSpacing: 0.1 },
});
