import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, Platform, StatusBar, KeyboardAvoidingView,
  Animated, Easing, ActivityIndicator, Alert, Modal, RefreshControl
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, Shadow } from '../../design-system/tokens';
import { mockChats, currentUser } from '../../data/mockData';
import {
  fetchMessages,
  sendMessage,
  reactToMessage,
  deleteMessage,
  clearConversationHistory,
  markConversationAsRead,
  fetchConversationMessages,
  sendMessageAdmin,
} from '../../services/chatService';
import { fetchProfile } from '../../services/authService';

const PRIMARY = '#3B82F6';
const PRIMARY_LIGHT = '#EFF6FF';

type Message = {
  id: string;
  text: string;
  mine: boolean;
  time: string;
  status?: 'sent' | 'delivered' | 'read';
  attachment?: { name: string; size: string };
  senderName?: string;
  reactions?: { user: string; emoji: string }[];
};

const SEED_MESSAGES: Record<string, Message[]> = {
  C001: [
    { id: '1', text: "Hey! How's the PR coming along?", mine: false, time: '10:28 AM', status: 'read' },
    { id: '2', text: 'Almost done, will push in 30 mins 🚀', mine: true, time: '10:30 AM', status: 'read' },
    { id: '3', text: 'Please review the PR when you get a chance', mine: false, time: '10:32 AM', status: 'read' },
    { id: '4', text: 'Sure! Dropping a comment thread now', mine: true, time: '10:35 AM', status: 'delivered' },
  ],
  C002: [
    { id: '1', text: 'Team sync moved to 3 PM', mine: false, time: '09:10 AM', status: 'read' },
    { id: '2', text: 'Got it, thanks! 👍', mine: true, time: '09:12 AM', status: 'read' },
    { id: '3', text: 'Meeting rescheduled to 3 PM', mine: false, time: '09:15 AM', status: 'read' },
    { id: '4', text: 'Can we also discuss the sprint backlog?', mine: true, time: '09:18 AM', status: 'sent' },
    { id: '5', text: 'Absolutely, agenda updated ✓', mine: false, time: '09:20 AM', status: 'read' },
  ],
  C003: [
    { id: '1', text: 'Hi, just checking on your leave request', mine: false, time: 'Yesterday', status: 'read' },
    { id: '2', text: 'Your leave has been approved ✓', mine: false, time: 'Yesterday', status: 'read' },
    { id: '3', text: 'Thank you so much! 🙏', mine: true, time: 'Yesterday', status: 'read' },
  ],
  C004: [
    { id: '1', text: 'Updated the design files — let me know if changes needed', mine: false, time: 'Yesterday', status: 'read' },
    { id: '2', text: 'Design file attached', mine: false, time: 'Yesterday', status: 'read', attachment: { name: 'Dashboard_v3.fig', size: '4.2 MB' } },
    { id: '3', text: 'Looks great! Just one minor tweak on the header spacing', mine: true, time: 'Yesterday', status: 'read' },
  ],
  C005: [
    { id: '1', text: 'Sprint review at 4 PM today 📅', mine: false, time: 'Jun 3', status: 'read' },
    { id: '2', text: "I'll be there!", mine: true, time: 'Jun 3', status: 'read' },
    { id: '3', text: 'Please prepare your demo screens', mine: false, time: 'Jun 3', status: 'read' },
  ],
};

const AVATAR_COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#EF4444', '#06B6D4'];
function getAvatarColor(name: string) {
  let h = 0; for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function Avatar({ name, initials, size = 36, online = false }: { name: string; initials?: string; size?: number; online?: boolean }) {
  const bg = getAvatarColor(name);
  const letters = initials ?? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontSize: size * 0.36, fontWeight: '700' }}>{letters}</Text>
      {online && <View style={{ position: 'absolute', bottom: 1, right: 1, width: size * 0.27, height: size * 0.27, borderRadius: size * 0.14, backgroundColor: '#10B981', borderWidth: 2, borderColor: '#fff' }} />}
    </View>
  );
}

function TypingIndicator() {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  useEffect(() => {
    const anims = dots.map((d, i) =>
      Animated.loop(Animated.sequence([
        Animated.delay(i * 150),
        Animated.timing(d, { toValue: -5, duration: 300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(d, { toValue: 0, duration: 300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.delay(600),
      ]))
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, []);

  return (
    <View style={styles.typingWrap}>
      <View style={styles.typingBubble}>
        {dots.map((d, i) => (
          <Animated.View key={i} style={[styles.typingDot, { transform: [{ translateY: d }] }]} />
        ))}
      </View>
    </View>
  );
}

interface MessageBubbleProps {
  item: Message;
  prevMine?: boolean;
  onLongPress: () => void;
}

function MessageBubble({ item, prevMine, onLongPress }: MessageBubbleProps) {
  const slideAnim = useRef(new Animated.Value(item.mine ? 20 : -20)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 80, friction: 10, useNativeDriver: true }),
    ]).start();
  }, []);

  const showTail = !prevMine || prevMine !== item.mine;

  return (
    <Animated.View style={[
      styles.bubbleRow,
      item.mine ? styles.bubbleRowMine : styles.bubbleRowTheirs,
      { opacity: fadeAnim, transform: [{ translateX: slideAnim }] },
      !showTail && { marginTop: 2 },
    ]}>
      {!item.mine && showTail && (
        <View style={{ marginRight: 8, alignSelf: 'flex-end' }}>
          <Avatar name={item.senderName || "Sender"} size={28} />
        </View>
      )}
      {!item.mine && !showTail && <View style={{ width: 36 }} />}

      <TouchableOpacity
        activeOpacity={0.9}
        onLongPress={onLongPress}
        style={[
          styles.bubble,
          item.mine ? styles.bubbleMine : styles.bubbleTheirs,
          showTail && item.mine && styles.bubbleMineWithTail,
          showTail && !item.mine && styles.bubbleTheirsWithTail,
        ]}
      >
        {item.attachment && (
          <View style={[styles.attachCard, item.mine && styles.attachCardMine]}>
            <Ionicons name="document-attach-outline" size={20} color={item.mine ? 'rgba(255,255,255,0.9)' : PRIMARY} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.attachName, item.mine && { color: '#fff' }]} numberOfLines={1}>{item.attachment.name}</Text>
              <Text style={[styles.attachSize, item.mine && { color: 'rgba(255,255,255,0.7)' }]}>{item.attachment.size}</Text>
            </View>
            <Ionicons name="download-outline" size={16} color={item.mine ? 'rgba(255,255,255,0.8)' : Colors.gray500} />
          </View>
        )}

        {!item.mine && showTail && item.senderName && (
          <Text style={styles.bubbleSenderName}>{item.senderName}</Text>
        )}

        {item.text.length > 0 && (
          <Text style={[styles.bubbleText, item.mine && styles.bubbleTextMine]}>{item.text}</Text>
        )}

        {item.reactions && item.reactions.length > 0 && (
          <View style={styles.reactionsRow}>
            {Array.from(new Set(item.reactions.map(r => r.emoji))).map((emoji, idx) => (
              <View key={idx} style={styles.reactionBadge}>
                <Text style={styles.reactionEmoji}>{emoji}</Text>
                {item.reactions!.filter(r => r.emoji === emoji).length > 1 && (
                  <Text style={styles.reactionCount}>{item.reactions!.filter(r => r.emoji === emoji).length}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        <View style={[styles.bubbleMeta, item.mine && { justifyContent: 'flex-end' }]}>
          <Text style={[styles.bubbleTime, item.mine && styles.bubbleTimeMine]}>{item.time}</Text>
          {item.mine && (
            <Ionicons
              name={item.status === 'read' ? 'checkmark-done' : item.status === 'delivered' ? 'checkmark-done-outline' : 'checkmark-outline'}
              size={13}
              color={item.status === 'read' ? '#93C5FD' : 'rgba(255,255,255,0.6)'}
              style={{ marginLeft: 3 }}
            />
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const normalizeMessage = (item: any, currentUserId: string = currentUser.employeeId): Message => {
  const mine = item.sender && typeof item.sender === 'object'
    ? (item.sender._id === currentUserId || item.sender.id === currentUserId)
    : (item.sender === currentUserId || item.mine);

  let time = '';
  if (item.createdAt) {
    try {
      time = new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      time = item.time || '';
    }
  }

  return {
    id: item._id || item.id || '',
    text: item.text || '',
    mine,
    time: time || item.time || '',
    status: item.status || 'read',
    attachment: item.attachment || undefined,
    senderName: item.sender && typeof item.sender === 'object' ? item.sender.name : (item.senderName || ''),
    reactions: Array.isArray(item.reactions) ? item.reactions : [],
  };
};

export default function ChatDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const chat = mockChats.find(c => c.id === id) || { id, name: 'Active Conversation', isGroup: false };

  // Messages states
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [myUserId, setMyUserId] = useState<string>(currentUser.employeeId);
  const [userRole, setUserRole] = useState<'employee' | 'superadmin' | 'hr' | 'manager'>('employee');

  // Options menus states
  const [showActions, setShowActions] = useState(false);
  const [longPressedMessage, setLongPressedMessage] = useState<Message | null>(null);

  const listRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const headerScale = useRef(new Animated.Value(0.97)).current;
  const headerOpacity = useRef(new Animated.Value(0)).current;

  const loadMessages = async (showIndicator = true) => {
    if (showIndicator) setLoading(true);
    try {
      let selfId = currentUser.employeeId;
      try {
        const prof = await fetchProfile();
        if (prof && prof.user) {
          const role = prof.user.role || 'employee';
          setUserRole(role);
          if (prof.user._id) {
            selfId = prof.user._id;
            setMyUserId(prof.user._id);
          }
        } else if (prof && prof._id) {
          selfId = prof._id;
          setMyUserId(prof._id);
        }
      } catch (e) {
        console.warn('Could not fetch user profile for chat ID, using fallback:', e);
      }

      let res;
      if (userRole === 'superadmin' || userRole === 'hr' || userRole === 'manager') {
        res = await fetchConversationMessages(id);
      } else {
        res = await fetchMessages(id);
      }

      let list: any[] = [];
      if (res && res.success && Array.isArray(res.messages)) {
        list = res.messages;
      } else if (res && res.success && Array.isArray(res.data)) {
        list = res.data;
      } else if (Array.isArray(res)) {
        list = res;
      } else if (res && Array.isArray(res.data)) {
        list = res.data;
      }
      setMessages(list.map(m => normalizeMessage(m, selfId)));
    } catch (err) {
      console.warn('Failed to load messages from API:', err);
      setMessages([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(headerScale, { toValue: 1, tension: 80, friction: 12, useNativeDriver: true }),
    ]).start();

    loadMessages();
    try {
      markConversationAsRead(id);
    } catch (e) {
      console.warn('Failed to mark conversation as read:', e);
    }

    // Auto-scroll on loading
    const t = setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 500);
    return () => clearTimeout(t);
  }, [id]);

  const onRefresh = () => {
    setRefreshing(true);
    loadMessages(false);
  };

  // ── Send Message ──
  const send = async () => {
    if (!input.trim()) return;
    const currentText = input.trim();
    setInput('');

    // Optimistic local update
    const tempId = 'temp_' + Date.now();
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const localMsg: Message = { id: tempId, text: currentText, mine: true, time, status: 'sent' };
    setMessages(prev => [...prev, localMsg]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      if (userRole === 'superadmin' || userRole === 'hr' || userRole === 'manager') {
        const payload = {
          chatId: id,
          content: currentText
        };
        await sendMessageAdmin(payload);
      } else {
        const formData = new FormData();
        formData.append('conversationId', id);
        formData.append('text', currentText);
        await sendMessage(formData);
      }
      // Reload messages list
      loadMessages(false);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to send message.');
      setMessages(prev => prev.filter(m => m.id !== tempId));
    }
  };

  // ── Clear Conversation History ──
  const handleClearHistory = () => {
    setShowActions(false);
    Alert.alert(
      'Clear Conversation',
      'Are you sure you want to delete all messages in this chat? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Chat',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearConversationHistory(id);
              setMessages([]);
              Alert.alert('Success', 'Conversation history cleared.');
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to clear conversation history.');
            }
          }
        }
      ]
    );
  };

  // ── React to Message ──
  const handleReactToMessage = async (emoji: string) => {
    if (!longPressedMessage) return;
    const msgId = longPressedMessage.id;
    setLongPressedMessage(null);
    try {
      const res = await reactToMessage(msgId, emoji);
      if (res && res.success && Array.isArray(res.reactions)) {
        setMessages(prev =>
          prev.map(m => m.id === msgId ? { ...m, reactions: res.reactions } : m)
        );
      } else {
        Alert.alert('Error', 'Failed to add reaction.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add reaction.');
    }
  };

  // ── Delete Message ──
  const handleDeleteMessage = () => {
    if (!longPressedMessage) return;
    const msgId = longPressedMessage.id;
    setLongPressedMessage(null);
    Alert.alert(
      'Delete Message',
      'Are you sure you want to delete this message?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMessage(msgId);
              setMessages(prev => prev.filter(m => m.id !== msgId));
            } catch (err: any) {
              setMessages(prev => prev.filter(m => m.id !== msgId));
              Alert.alert('Success', 'Message deleted locally.');
            }
          }
        }
      ]
    );
  };

  const isOnline = !chat.isGroup && (chat as any).online;
  const allMessages = typing ? [...messages, { id: 'typing', text: '', mine: false, time: '' }] : messages;

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" translucent />

      {/* Sticky Header */}
      <Animated.View style={[styles.header, { opacity: headerOpacity, transform: [{ scale: headerScale }] }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1E293B" />
        </TouchableOpacity>

        <View style={styles.headerAvatarWrap}>
          <Avatar name={chat.name} initials={(chat as any).initials} size={40} online={isOnline} />
          {chat.isGroup && (
            <View style={styles.headerGroupBadge}>
              <Ionicons name="people" size={10} color="#fff" />
            </View>
          )}
        </View>

        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{chat.name}</Text>
          <View style={styles.headerStatusRow}>
            {isOnline && <View style={styles.onlineDot} />}
            <Text style={[styles.headerSub, isOnline && { color: '#10B981' }]}>
              {chat.isGroup ? `${(chat as any).members || 2} members` : isOnline ? 'Active now' : 'Offline'}
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerIconBtn}>
            <Ionicons name="call-outline" size={18} color={Colors.gray600} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn}>
            <Ionicons name="videocam-outline" size={18} color={Colors.gray600} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => setShowActions(!showActions)}>
            <Ionicons name="ellipsis-vertical" size={18} color={Colors.gray600} />
          </TouchableOpacity>
        </View>

        {showActions && (
          <View style={styles.actionMenu}>
            {['View Profile', 'Search in Chat', 'Clear Chat'].map((label, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.actionMenuItem, i < 2 && { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }]}
                onPress={() => label === 'Clear Chat' ? handleClearHistory() : setShowActions(false)}
              >
                <Text style={[styles.actionMenuText, label === 'Clear Chat' && { color: Colors.danger }]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </Animated.View>

      {/* Messages */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={{ marginTop: 8, color: Colors.gray500 }}>Fetching messages...</Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={allMessages}
          keyExtractor={m => m.id}
          contentContainerStyle={styles.msgList}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} />}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item, index }) => {
            if (item.id === 'typing') return <TypingIndicator />;
            const prev = index > 0 ? messages[index - 1] : undefined;
            return (
              <MessageBubble
                item={item}
                prevMine={prev?.mine}
                onLongPress={() => setLongPressedMessage(item)}
              />
            );
          }}
        />
      )}

      {/* Composer */}
      <View style={styles.composer}>
        <TouchableOpacity style={styles.composerBtn}>
          <Ionicons name="add-circle-outline" size={24} color={'#A4A4AD'} />
        </TouchableOpacity>
        <View style={styles.composerInputWrap}>
          <TextInput
            ref={inputRef}
            style={styles.composerInput}
            value={input}
            onChangeText={setInput}
            placeholder="Type a message..."
            placeholderTextColor={'#A4A4AD'}
            multiline
            returnKeyType="default"
          />
          <TouchableOpacity style={styles.emojiBtn}>
            <Ionicons name="happy-outline" size={20} color={'#A4A4AD'} />
          </TouchableOpacity>
        </View>
        {input.trim().length > 0 ? (
          <TouchableOpacity style={styles.sendBtn} onPress={send}>
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.composerBtn}>
            <Ionicons name="mic-outline" size={22} color={'#A4A4AD'} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Modal 4: Message Long Press Context Modal ── */}
      <Modal visible={longPressedMessage !== null} transparent animationType="fade" onRequestClose={() => setLongPressedMessage(null)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setLongPressedMessage(null)} />
          <View style={styles.contextCard}>
            <Text style={styles.contextTitle}>React with Emoji</Text>
            <View style={styles.emojiRow}>
              {['👍', '❤️', '🎉', '🔥', '👏', '😂'].map(emoji => (
                <TouchableOpacity key={emoji} style={styles.emojiButton} onPress={() => handleReactToMessage(emoji)}>
                  <Text style={styles.emojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.contextSeparator} />

            {longPressedMessage && longPressedMessage.mine && (
              <TouchableOpacity style={styles.contextAction} onPress={handleDeleteMessage}>
                <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                <Text style={styles.contextActionTextDanger}>Delete Message</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.contextAction} onPress={() => setLongPressedMessage(null)}>
              <Ionicons name="close-circle-outline" size={16} color={Colors.gray600} />
              <Text style={styles.contextActionText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const ptop = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : 52;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff',
    paddingTop: ptop, paddingHorizontal: 12, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
    gap: 8, zIndex: 20,
    ...Shadow.sm,
  },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F8FAFF', alignItems: 'center', justifyContent: 'center' },
  headerAvatarWrap: { position: 'relative' },
  headerGroupBadge: { position: 'absolute', bottom: 0, right: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: '#8B5CF6', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  headerInfo: { flex: 1 },
  headerName: { fontSize: Typography.fontSize.base, fontWeight: '700', color: '#0F172A', letterSpacing: -0.2 },
  headerStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#10B981' },
  headerSub: { fontSize: Typography.fontSize.xs, color: Colors.gray400 },
  headerRight: { flexDirection: 'row', gap: 2 },
  headerIconBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#F8FAFF', alignItems: 'center', justifyContent: 'center' },

  actionMenu: {
    position: 'absolute', top: '100%', right: 12,
    backgroundColor: '#fff', borderRadius: 14,
    borderWidth: 1, borderColor: '#F1F5F9',
    zIndex: 100, minWidth: 180,
    ...Shadow.lg,
  },
  actionMenuItem: { paddingHorizontal: 16, paddingVertical: 12 },
  actionMenuText: { fontSize: Typography.fontSize.sm, color: '#1E293B', fontWeight: '500' },

  msgList: { paddingHorizontal: 12, paddingTop: 16, paddingBottom: 12, gap: 4 },

  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', marginVertical: 2 },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleRowTheirs: { justifyContent: 'flex-start' },

  bubble: {
    maxWidth: '75%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10,
    ...Shadow.sm,
  },
  bubbleMine: { backgroundColor: PRIMARY, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: '#fff', borderBottomLeftRadius: 4 },
  bubbleMineWithTail: { borderBottomRightRadius: 4 },
  bubbleTheirsWithTail: { borderBottomLeftRadius: 4 },
  bubbleSenderName: { fontSize: 10, fontWeight: '700', color: PRIMARY, marginBottom: 4 },
  bubbleText: { fontSize: Typography.fontSize.sm, color: '#1E293B', lineHeight: 20 },
  bubbleTextMine: { color: '#fff' },
  bubbleMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  bubbleTime: { fontSize: 10, color: Colors.gray400 },
  bubbleTimeMine: { color: 'rgba(255,255,255,0.65)' },

  attachCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#EFF6FF', borderRadius: 10, padding: 10,
    marginBottom: 6,
  },
  attachCardMine: { backgroundColor: 'rgba(255,255,255,0.18)' },
  attachName: { fontSize: Typography.fontSize.xs, fontWeight: '600', color: '#1E293B' },
  attachSize: { fontSize: 10, color: Colors.gray500, marginTop: 1 },

  typingWrap: { flexDirection: 'row', alignItems: 'flex-end', paddingLeft: 44, marginVertical: 4 },
  typingBubble: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#fff', borderRadius: 16, borderBottomLeftRadius: 4,
    paddingHorizontal: 14, paddingVertical: 12,
    ...Shadow.sm,
  },
  typingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.gray400 },

  composer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    borderTopWidth: 1, borderTopColor: '#F1F5F9',
    ...Shadow.sm,
  },
  composerBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F8FAFF', alignItems: 'center', justifyContent: 'center' },
  composerInputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'flex-end',
    backgroundColor: '#F8FAFF', borderRadius: 14,
    borderWidth: 1, borderColor: '#E2E8F0',
    paddingRight: 4, minHeight: 42,
  },
  composerInput: {
    flex: 1, minHeight: 40, maxHeight: 110,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: Typography.fontSize.sm, color: '#0F172A',
  },
  emojiBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  sendBtn: { width: 42, height: 42, borderRadius: 13, backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center', ...Shadow.md },

  // Context overlay Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  contextCard: { backgroundColor: '#fff', width: '80%', borderRadius: 16, padding: 18, ...Shadow.lg },
  contextTitle: { fontSize: 13, fontWeight: '700', color: Colors.gray600, marginBottom: 12 },
  emojiRow: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 6 },
  emojiButton: { padding: 8, borderRadius: 8, backgroundColor: '#F8FAFF' },
  emojiText: { fontSize: 22 },
  contextSeparator: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 12 },
  contextAction: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  contextActionText: { fontSize: 14, fontWeight: '600', color: Colors.gray800 },
  contextActionTextDanger: { fontSize: 14, fontWeight: '700', color: Colors.danger },

  // Reactions style
  reactionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6, alignSelf: 'flex-start' },
  reactionBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: '#E2E8F0' },
  reactionEmoji: { fontSize: 12 },
  reactionCount: { fontSize: 9, color: Colors.gray600, fontWeight: '700', marginLeft: 2 },
});
