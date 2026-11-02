import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Platform, StatusBar, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, Shadow, IconBox } from '../../design-system/tokens';
import { mockNotifications } from '../../data/mockData';
import {
  fetchRecentNotificationsApi,
  markNotificationReadApi,
  markAllNotificationsReadApi,
  Notification,
} from '../../services/notificationService';
import { fetchProfile } from '../../services/authService';

const isNotificationRead = (n: any, currentUserId?: string) => {
  const readList = n.readBy || n.readUsers || n.read_by || n.read || [];
  const isReadArray = Array.isArray(readList) && (n.readBy || n.readUsers || n.read_by || Array.isArray(n.read));

  if (!currentUserId) {
    if (isReadArray) return false;
    return !!n.read || !!n.isRead;
  }
  
  if (n.isRead === true || n.read === true) return true;
  
  if (Array.isArray(readList) && readList.length > 0) {
    return readList.some((u: any) => {
      let targetId = u;
      if (typeof u === 'object' && u !== null) {
        if (u.user && typeof u.user === 'object') {
          targetId = u.user._id || u.user.id;
        } else if (u.userId && typeof u.userId === 'object') {
          targetId = u.userId._id || u.userId.id;
        } else {
          targetId = u.user || u.userId || u._id || u.id;
        }
      }
      return targetId?.toString() === currentUserId?.toString();
    });
  }
  return false;
};

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TYPE_CONFIG: Record<string, { icon: IoniconName; bg: string; color: string }> = {
  info: { icon: 'information-circle-outline', bg: '#FFF1F2', color: '#EA0071' },
  success: { icon: 'checkmark-circle-outline', bg: '#ECFDF5', color: '#009D88' },
  warning: { icon: 'warning-outline', bg: '#F5F3FF', color: '#9530FE' },
  danger: { icon: 'alert-circle-outline', bg: '#FFFBEB', color: '#FF7200' },
};

function NotifCard({ n, unread, onPress }: { n: any; unread: boolean; onPress?: () => void }) {
  const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.info;
  const CardWrapper = onPress ? TouchableOpacity : View;

  // Format visual timestamp
  let timeStr = n.time;
  if (!timeStr && n.createdAt) {
    const d = new Date(n.createdAt);
    timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <CardWrapper
      style={[styles.card, unread && styles.cardUnread]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {unread && <View style={styles.unreadBar} />}
      <View style={[styles.iconBox, { backgroundColor: cfg.bg }]}>
        <Ionicons name={cfg.icon} size={20} color={cfg.color} />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTopRow}>
          <Text style={[styles.cardTitle, !unread && styles.cardTitleRead]} numberOfLines={1}>
            {n.title}
          </Text>
          <Text style={styles.cardTime}>{timeStr}</Text>
        </View>
        <Text style={styles.cardMsg} numberOfLines={2}>{n.message}</Text>
      </View>
    </CardWrapper>
  );
}

function SectionLabel({ icon, label }: { icon: IoniconName; label: string }) {
  return (
    <View style={styles.sectionRow}>
      <Ionicons name={icon} size={13} color={Colors.gray400} />
      <Text style={styles.sectionLabel}>{label}</Text>
    </View>
  );
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  const loadNotifications = async (showIndicator = true) => {
    if (showIndicator) setLoading(true);

    try {
      const pData = await fetchProfile();
      let extractedUser = null;
      if (pData) {
        if (pData.user) extractedUser = pData.user;
        else if (pData.data && pData.data.user) extractedUser = pData.data.user;
        else if (pData.data) extractedUser = pData.data;
        else extractedUser = pData;
      }
      setUser(extractedUser);
    } catch (err) {
      console.warn('Failed to fetch profile in notifications:', err);
    }

    try {
      const res: any = await fetchRecentNotificationsApi();
      let list: any[] = [];
      if (res) {
        if (Array.isArray(res.notifications)) {
          list = res.notifications;
        } else if (Array.isArray(res.data)) {
          list = res.data;
        } else if (res.data && Array.isArray((res.data as any).notifications)) {
          list = (res.data as any).notifications;
        } else if (Array.isArray(res)) {
          list = res as any;
        }
      }
      setNotifications(list);
    } catch (err) {
      console.warn('Failed to fetch notifications from API:', err);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const currentUserId = user?._id || user?.id || user?.userId;
  const unread = notifications.filter(n => !isNotificationRead(n, currentUserId));
  const read = notifications.filter(n => isNotificationRead(n, currentUserId));

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsReadApi();
      setNotifications(prev => prev.map(n => {
        if (Array.isArray(n.readBy)) return { ...n, readBy: [...n.readBy, currentUserId] };
        if (Array.isArray(n.read)) return { ...n, read: [...n.read, { user: currentUserId }] };
        return { ...n, read: true, isRead: true };
      }));
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to mark all notifications as read.');
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await markNotificationReadApi(id);
      setNotifications(prev =>
        prev.map(n => {
          if ((n._id || n.id) === id) {
            if (Array.isArray(n.readBy)) return { ...n, readBy: [...n.readBy, currentUserId] };
            if (Array.isArray(n.read)) return { ...n, read: [...n.read, { user: currentUserId }] };
            return { ...n, read: true, isRead: true };
          }
          return n;
        })
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to mark notification as read.');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={22} color={Colors.gray900} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <TouchableOpacity onPress={handleMarkAllRead} disabled={unread.length === 0} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[styles.markAll, unread.length === 0 && styles.markAllDisabled]}>
            Mark all read
          </Text>
        </TouchableOpacity>
      </View>

      {/* Unread banner */}
      {unread.length > 0 && !loading && (
        <View style={styles.banner}>
          <View style={styles.bannerDot} />
          <Text style={styles.bannerText}>
            You have <Text style={styles.bannerCount}>{unread.length} unread</Text> notification{unread.length > 1 ? 's' : ''}
          </Text>
        </View>
      )}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {unread.length === 0 && read.length === 0 && (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="notifications-off-outline" size={36} color={Colors.gray300} />
              </View>
              <Text style={styles.emptyTitle}>All caught up!</Text>
              <Text style={styles.emptyMsg}>No notifications to show right now.</Text>
            </View>
          )}

          {unread.length > 0 && (
            <>
              <SectionLabel icon="radio-button-on-outline" label={`New · ${unread.length}`} />
              {unread.map(n => (
                <NotifCard
                  key={n._id || n.id}
                  n={n}
                  unread
                  onPress={() => handleMarkRead(n._id || n.id)}
                />
              ))}
            </>
          )}

          {read.length > 0 && (
            <View style={{ marginTop: unread.length > 0 ? Spacing[4] : 0 }}>
              <SectionLabel icon="time-outline" label="Earlier" />
              {read.map(n => (
                <NotifCard
                  key={n._id || n.id}
                  n={n}
                  unread={false}
                />
              ))}
            </View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },

  // Header
  header: {
    backgroundColor: Colors.white,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 12 : 56,
    paddingHorizontal: Spacing[4],
    paddingBottom: Spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },
  backBtn: { padding: 4 },
  headerTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: '700',
    color: Colors.gray900,
    flex: 1,
    textAlign: 'center',
  },
  markAll: {
    fontSize: Typography.fontSize.sm,
    color: Colors.primary,
    fontWeight: '600',
  },
  markAllDisabled: { color: Colors.gray300 },

  // Unread banner
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.overlayLight,
    paddingHorizontal: Spacing[4],
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.primary + '18',
    gap: 8,
  },
  bannerDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  bannerText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.gray600,
  },
  bannerCount: {
    fontWeight: '700',
    color: Colors.primary,
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing[4], paddingTop: Spacing[4] },

  // Section label
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing[2],
    marginLeft: 2,
  },
  sectionLabel: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
    color: Colors.gray400,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },

  // Card
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing[3],
    marginBottom: Spacing[2],
    overflow: 'hidden',
    ...Shadow.sm,
  },
  cardUnread: {
    borderColor: Colors.primary + '25',
    backgroundColor: '#F0F8FF',
  },
  unreadBar: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    width: 3,
    backgroundColor: Colors.primary,
    borderTopLeftRadius: Radius.lg,
    borderBottomLeftRadius: Radius.lg,
  },
  iconBox: {
    width: IconBox.size, height: IconBox.size,
    borderRadius: 12,
    backgroundColor: IconBox.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing[3],
    flexShrink: 0,
    ...IconBox.shadow as any,
  },
  cardBody: { flex: 1 },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
    color: Colors.gray900,
  },
  cardTitleRead: {
    fontWeight: '600',
    color: Colors.gray600,
  },
  cardTime: {
    fontSize: Typography.fontSize.xs,
    color: Colors.gray400,
    flexShrink: 0,
  },
  cardMsg: {
    fontSize: Typography.fontSize.xs,
    color: Colors.gray500,
    lineHeight: 18,
  },

  // Empty/Loading
  empty: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 10,
  },
  emptyIcon: {
    width: 72, height: 72,
    borderRadius: 36,
    backgroundColor: Colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: '700',
    color: Colors.gray700,
  },
  emptyMsg: {
    fontSize: Typography.fontSize.sm,
    color: Colors.gray400,
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 120 },
  loadingText: { fontSize: 13, color: Colors.gray500, marginTop: 10, fontWeight: '500' },
});

