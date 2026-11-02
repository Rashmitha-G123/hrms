import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Platform, StatusBar, FlatList, Animated, useWindowDimensions,
  ActivityIndicator, RefreshControl
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, Shadow } from '../../design-system/tokens';
import { mockChats, currentUser } from '../../data/mockData';
import { fetchConversations } from '../../services/chatService';
import { fetchProfile } from '../../services/authService';

const PRIMARY = '#3B82F6';
const PRIMARY_LIGHT = '#EFF6FF';

type ChatItem = {
  id: string;
  name: string;
  isGroup?: boolean;
  members?: number;
  online?: boolean;
  initials?: string;
  role?: string;
  lastMessage: string;
  time: string;
  unread: number;
};

const AVATAR_COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#EF4444', '#06B6D4'];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function InitialsAvatar({ name, initials, size = 44, online = false, style }: { name: string; initials?: string; size?: number; online?: boolean; style?: any }) {
  const bg = getAvatarColor(name);
  const letters = initials ?? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: bg }, style]}>
      <Text style={{ color: '#fff', fontSize: size * 0.36, fontWeight: '700', letterSpacing: 0.5 }}>{letters}</Text>
      {online && (
        <View style={{
          position: 'absolute', bottom: 1, right: 1,
          width: size * 0.27, height: size * 0.27,
          borderRadius: size * 0.14, backgroundColor: '#10B981',
          borderWidth: 2, borderColor: '#fff',
        }} />
      )}
    </View>
  );
}

function ChatRow({ item, onPress, index }: { item: ChatItem; onPress: () => void; index: number }) {
  const slide = useRef(new Animated.Value(30)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 320, delay: index * 60, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 320, delay: index * 60, useNativeDriver: true }),
    ]).start();
  }, []);

  const onIn = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start();
  const onOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
  const hasUnread = item.unread > 0;

  return (
    <Animated.View style={{ opacity: fade, transform: [{ translateX: slide }, { scale }] }}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={onIn}
        onPressOut={onOut}
        onPress={onPress}
        style={[styles.chatRow, hasUnread && styles.chatRowUnread]}
      >
        <View style={styles.chatRowAvatar}>
          <InitialsAvatar name={item.name} initials={item.initials} size={48} online={!item.isGroup && item.online} />
          {item.isGroup && (
            <View style={styles.groupBadgeIcon}>
              <Ionicons name="people" size={9} color="#fff" />
            </View>
          )}
        </View>
        <View style={styles.chatRowBody}>
          <View style={styles.chatRowTop}>
            <Text style={[styles.chatRowName, hasUnread && { color: '#0F172A', fontWeight: '700' }]} numberOfLines={1}>{item.name}</Text>
            <Text style={[styles.chatRowTime, hasUnread && { color: PRIMARY, fontWeight: '600' }]}>{item.time}</Text>
          </View>
          <View style={styles.chatRowBottom}>
            <Text style={[styles.chatRowPreview, hasUnread && { color: '#374151', fontWeight: '500' }]} numberOfLines={1}>
              {item.lastMessage}
            </Text>
            {hasUnread ? (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{item.unread > 9 ? '9+' : item.unread}</Text>
              </View>
            ) : (
              <Ionicons name="checkmark-done" size={14} color="#10B981" style={{ marginLeft: 4 }} />
            )}
          </View>
          {item.isGroup && (
            <Text style={styles.chatRowMeta}>{item.members} members · Group</Text>
          )}
          {!item.isGroup && !!item.role && (
            <Text style={styles.chatRowMeta}>{item.role}</Text>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const normalizeConversation = (item: any, currentUserId: string = currentUser.employeeId): ChatItem => {
  const isGroup = !!item.isGroup;

  let name = item.name || '';
  let initials = item.initials || '';
  let role = item.role || '';
  let online = !!item.online;

  if (!isGroup && Array.isArray(item.participants)) {
    const otherParticipant = item.participants.find((p: any) => p._id !== currentUserId && p.id !== currentUserId) || item.participants[0];
    if (otherParticipant) {
      name = otherParticipant.name || otherParticipant.fullName || name;
      initials = otherParticipant.initials || '';
      role = otherParticipant.designation || '';
      online = !!otherParticipant.online;
    }
  }

  let lastMessage = 'No messages yet';
  let time = '';
  if (item.lastMessage) {
    if (typeof item.lastMessage === 'string') {
      lastMessage = item.lastMessage;
    } else if (typeof item.lastMessage === 'object') {
      lastMessage = item.lastMessage.text || lastMessage;
      if (item.lastMessage.createdAt) {
        try {
          time = new Date(item.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch (e) {
          time = '';
        }
      }
    }
  }

  return {
    id: item._id || item.id || '',
    name: name || 'Group Chat',
    isGroup,
    members: item.members || (item.participants ? item.participants.length : 2),
    online,
    initials,
    role,
    lastMessage,
    time: time || item.time || '',
    unread: item.unreadCount || item.unread || 0,
  };
};

export default function ChatScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'user' | 'project'>('user');
  const headerAnim = useRef(new Animated.Value(0)).current;

  // Conversations states
  const [conversations, setConversations] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadConversations = async (showIndicator = true) => {
    if (showIndicator) setLoading(true);
    try {
      let selfId = currentUser.employeeId;
      try {
        const prof = await fetchProfile();
        if (prof && prof.user && prof.user._id) {
          selfId = prof.user._id;
        } else if (prof && prof._id) {
          selfId = prof._id;
        }
      } catch (e) {
        console.warn('Could not fetch user profile for chat ID, using fallback:', e);
      }

      const res = await fetchConversations();
      let list: any[] = [];
      if (res && res.success && Array.isArray(res.conversations)) {
        list = res.conversations;
      } else if (Array.isArray(res)) {
        list = res;
      } else if (res && Array.isArray(res.data)) {
        list = res.data;
      }
      setConversations(list.map(c => normalizeConversation(c, selfId)));
    } catch (err) {
      console.warn('Failed to load conversations from API:', err);
      setConversations([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    Animated.timing(headerAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    loadConversations();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadConversations(false);
  };

  const userChats = conversations.filter(c => !c.isGroup);
  const projectChats = conversations.filter(c => c.isGroup);

  const userUnreadCount = userChats.reduce((sum, c) => sum + c.unread, 0);
  const projectUnreadCount = projectChats.reduce((sum, c) => sum + c.unread, 0);

  const chatsToShow = (activeTab === 'user' ? userChats : projectChats).filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.lastMessage.toLowerCase().includes(search.toLowerCase())
  );

  const totalUnread = conversations.reduce((s, c) => s + c.unread, 0);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Main Panel */}
      <View style={styles.main}>
        {/* Sticky Header */}
        <Animated.View style={[styles.header, { opacity: headerAnim, transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }] }]}>
          <View style={styles.headerTop}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>Messages</Text>
              {totalUnread > 0 && (
                <View style={styles.headerBadge}>
                  <Text style={styles.headerBadgeText}>{totalUnread}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Search Bar */}
          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={16} color={'#A4A4AD'} style={{ marginLeft: 12 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search messages, people..."
              placeholderTextColor={'#A4A4AD'}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} style={{ padding: 8 }}>
                <Ionicons name="close-circle" size={16} color={Colors.gray400} />
              </TouchableOpacity>
            )}
          </View>

          {/* Table Tab Selector (Users / Projects) */}
          <View style={styles.tabsContainer}>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.tabBtn, activeTab === 'user' && styles.tabBtnActive]}
              onPress={() => setActiveTab('user')}
            >
              <View style={styles.tabLabelRow}>
                <Text style={[styles.tabLabelText, activeTab === 'user' && styles.tabLabelTextActive]}>Users</Text>
                {userUnreadCount > 0 && (
                  <View style={styles.tabBadge}>
                    <Text style={styles.tabBadgeText}>{userUnreadCount}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.tabBtn, activeTab === 'project' && styles.tabBtnActive]}
              onPress={() => setActiveTab('project')}
            >
              <View style={styles.tabLabelRow}>
                <Text style={[styles.tabLabelText, activeTab === 'project' && styles.tabLabelTextActive]}>Projects</Text>
                {projectUnreadCount > 0 && (
                  <View style={styles.tabBadge}>
                    <Text style={styles.tabBadgeText}>{projectUnreadCount}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Chat List */}
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={PRIMARY} />
            <Text style={styles.loadingText}>Loading conversations...</Text>
          </View>
        ) : (
          <FlatList
            data={chatsToShow}
            keyExtractor={i => i.id}
            contentContainerStyle={{ paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} />}
            renderItem={({ item, index }) => (
              <ChatRow item={item} index={index} onPress={() => router.push(`/chat/${item.id}` as any)} />
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="chatbubbles-outline" size={48} color={Colors.gray300} />
                <Text style={styles.emptyStateText}>No conversations found</Text>
              </View>
            }
          />
        )}

        {/* FAB */}
        <TouchableOpacity style={styles.fab} activeOpacity={0.85} onPress={() => router.push('/chat/new' as any)}>
          <Ionicons name="chatbubble-ellipses" size={22} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const ptop = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : 52;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FAFAFA' },
  main: { flex: 1, backgroundColor: '#FAFAFA' },
  header: {
    backgroundColor: '#fff',
    paddingTop: ptop,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
    ...Shadow.sm,
    zIndex: 10,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: Typography.fontSize.xl, fontWeight: '800', color: '#0F172A', letterSpacing: -0.5 },
  headerBadge: { backgroundColor: PRIMARY, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  headerBadgeText: { fontSize: 11, color: '#fff', fontWeight: '700' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8FAFF', borderRadius: 12,
    borderWidth: 1, borderColor: '#E2E8F0',
    height: 42, marginBottom: 10,
  },
  searchInput: { flex: 1, paddingHorizontal: 10, fontSize: Typography.fontSize.sm, color: '#0F172A' },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    height: 44,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: PRIMARY,
  },
  tabLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tabLabelText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '600',
    color: '#64748B',
  },
  tabLabelTextActive: {
    color: PRIMARY,
    fontWeight: '700',
  },
  tabBadge: {
    backgroundColor: PRIMARY,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeText: {
    fontSize: 9,
    color: '#fff',
    fontWeight: '700',
  },
  chatRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#fff', marginHorizontal: 12, marginBottom: 4,
    borderRadius: 14, ...Shadow.sm,
  },
  chatRowUnread: { backgroundColor: PRIMARY_LIGHT, borderLeftWidth: 3, borderLeftColor: PRIMARY },
  chatRowAvatar: { position: 'relative', marginRight: 12 },
  groupBadgeIcon: {
    position: 'absolute', bottom: 0, right: -2,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#8B5CF6', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  chatRowBody: { flex: 1 },
  chatRowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  chatRowName: { fontSize: Typography.fontSize.base, fontWeight: '600', color: '#1E293B', flex: 1, marginRight: 8 },
  chatRowTime: { fontSize: Typography.fontSize.xs, color: Colors.gray400 },
  chatRowBottom: { flexDirection: 'row', alignItems: 'center' },
  chatRowPreview: { flex: 1, fontSize: Typography.fontSize.sm, color: Colors.gray500, lineHeight: 18 },
  chatRowMeta: { fontSize: 10, color: Colors.gray400, marginTop: 3 },
  unreadBadge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  unreadBadgeText: { fontSize: 10, color: '#fff', fontWeight: '700' },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyStateText: { fontSize: Typography.fontSize.base, color: Colors.gray400 },
  fab: {
    position: 'absolute', right: 20, bottom: 90,
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center',
    ...Shadow.lg,
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  loadingText: { marginTop: 10, fontSize: 13, color: Colors.gray500 },
});
