import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Platform, StatusBar, useWindowDimensions,
  ActivityIndicator, Alert, Modal, KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IconBox, Colors, Radius, Spacing, Shadow } from '../../design-system/tokens';
import { useRouter } from 'expo-router';
import { mockAnnouncements } from '../../data/mockData';
import {
  fetchAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
  acknowledgeAnnouncementApi,
  reactToAnnouncementApi,
  Announcement,
} from '../../services/announcementService';
import { fetchProfile } from '../../services/authService';

const FILTERS = ['All', 'Policy', 'Event', 'Holiday', 'Urgent', 'General'] as const;

const PRIORITY_META: Record<string, { color: string; bg: string }> = {
  Low: { color: '#10B981', bg: '#D1FAE5' },
  Medium: { color: '#FE9A00', bg: '#FFF5E6' },
  High: { color: '#2563EB', bg: '#DBEAFE' },
  Urgent: { color: '#EC003F', bg: '#FFE9EE' },
};

const CATEGORY_META: Record<string, { color: string; bg: string }> = {
  Policy: { color: '#2563EB', bg: '#EFF6FF' },
  Event: { color: '#10B981', bg: '#ECFDF5' },
  Holiday: { color: '#F59E0B', bg: '#FFFBEB' },
  General: { color: '#6B7280', bg: '#F3F4F6' },
  Urgent: { color: '#EC003F', bg: '#FFE4EA' },
};

const TOP_BORDER: Record<string, string> = {
  Low: '#10B981', Medium: '#F59E0B', High: '#2563EB', Urgent: '#EC003F',
};

const cardShadow = Platform.OS === 'web'
  ? { boxShadow: '0px 2px 10px rgba(0,0,0,0.07)' }
  : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 3 };

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ icon, iconBg, iconColor, label, value, cardWidth }: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconBg: string; iconColor: string; label: string; value: number | string; cardWidth: number;
}) {
  return (
    <View style={[st.statCard, { width: cardWidth }]}>
      <View style={[st.statIconCircle, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <View style={st.statContent}>
        <Text style={st.statLabel}>{label}</Text>
        <Text style={st.statValue}>{value}</Text>
      </View>
    </View>
  );
}

function ReactionButton({ emoji, count, isActive, onPress }: {
  emoji: string; count: number; isActive: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[st.reactionBtn, isActive && st.reactionBtnActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={st.reactionEmoji}>{emoji}</Text>
      {count > 0 && <Text style={[st.reactionCount, isActive && st.reactionCountActive]}>{count}</Text>}
    </TouchableOpacity>
  );
}

interface AnnouncementCardProps {
  item: any;
  cardWidth: number;
  onDelete: (id: string) => void;
  onAcknowledge: (id: string) => void;
  onReact: (id: string, type: string) => void;
  currentUserId?: string;
  userRole?: string;
}

function AnnouncementCard({ item, cardWidth, onDelete, onAcknowledge, onReact, currentUserId, userRole }: AnnouncementCardProps) {
  const [expanded, setExpanded] = useState(false);
  const annId = item._id || item.id;
  const annTitle = item.title;
  const annContent = item.description || item.content;
  const annCategory = item.category || 'General';
  const annPriority = item.priority || 'Medium';
  const annDate = item.createdAt ? new Date(item.createdAt).toLocaleDateString() : item.date;
  const annAuthor = item.author || 'HR Team';

  const pm = PRIORITY_META[annPriority] ?? PRIORITY_META.Medium;
  const cm = CATEGORY_META[annCategory] ?? CATEGORY_META.General;
  const topColor = TOP_BORDER[annPriority] ?? '#2563EB';

  const showDelete = userRole === 'admin' || userRole === 'superadmin';
  const isAcknowledged = item.acknowledgedBy?.includes(currentUserId) || false;

  const reactions = item.reactions || [];
  const likeCount = reactions.filter((r: any) => r.type === 'like').length;
  const loveCount = reactions.filter((r: any) => r.type === 'love').length;
  const celebrateCount = reactions.filter((r: any) => r.type === 'celebrate').length;
  const rocketCount = reactions.filter((r: any) => r.type === 'rocket').length;

  const hasLiked = reactions.some((r: any) => r.user === currentUserId && r.type === 'like');
  const hasLoved = reactions.some((r: any) => r.user === currentUserId && r.type === 'love');
  const hasCelebrated = reactions.some((r: any) => r.user === currentUserId && r.type === 'celebrate');
  const hasRocketed = reactions.some((r: any) => r.user === currentUserId && r.type === 'rocket');

  return (
    <View style={[st.annCard, cardShadow, { borderTopColor: topColor, width: cardWidth }]}>
      <View style={st.annCardHeader}>
        <View style={st.annBadgeRow}>
          <View style={[st.badge, { backgroundColor: pm.bg }]}>
            <Text style={[st.badgeText, { color: pm.color }]}>{annPriority}</Text>
          </View>
          <View style={[st.badge, { backgroundColor: cm.bg }]}>
            <Text style={[st.badgeText, { color: cm.color }]}>{annCategory}</Text>
          </View>
        </View>
        {showDelete && (
          <TouchableOpacity
            style={st.deleteBtn}
            onPress={() => onDelete(annId)}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={16} color={Colors.danger} />
          </TouchableOpacity>
        )}
      </View>

      <Text style={st.annTitle} numberOfLines={2}>{annTitle}</Text>
      {/* Basic strip HTML tags from description if present */}
      <Text style={st.annDesc} numberOfLines={expanded ? undefined : 3}>
        {annContent ? annContent.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'") : ''}
      </Text>
      {annContent && annContent.replace(/<[^>]*>/g, '').length > 120 && (
        <TouchableOpacity onPress={() => setExpanded(!expanded)} style={{ marginTop: 2, marginBottom: 8 }} activeOpacity={0.7}>
          <Text style={{ color: '#2563EB', fontSize: 11, fontWeight: '700' }}>
            {expanded ? 'Show Less' : 'Read More'}
          </Text>
        </TouchableOpacity>
      )}

      <View style={st.annDivider} />

      {/* Action Row: Reactions and Read Status */}
      <View style={st.actionRow}>
        <View style={st.reactionsContainer}>
          <ReactionButton emoji="👍" count={likeCount} isActive={hasLiked} onPress={() => onReact(annId, 'like')} />
          <ReactionButton emoji="❤️" count={loveCount} isActive={hasLoved} onPress={() => onReact(annId, 'love')} />
          <ReactionButton emoji="🎉" count={celebrateCount} isActive={hasCelebrated} onPress={() => onReact(annId, 'celebrate')} />
          <ReactionButton emoji="🚀" count={rocketCount} isActive={hasRocketed} onPress={() => onReact(annId, 'rocket')} />
        </View>

        {isAcknowledged ? (
          <View style={st.acknowledgedBadge}>
            <Ionicons name="checkmark-circle" size={14} color="#137333" />
            <Text style={st.acknowledgedText}>Read</Text>
          </View>
        ) : (
          <TouchableOpacity style={st.acknowledgeBtn} onPress={() => onAcknowledge(annId)} activeOpacity={0.7}>
            <Text style={st.acknowledgeBtnText}>Mark Read</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={st.annDivider} />
      <View style={st.annFooter}>
        <View style={st.annMeta}>
          <View style={st.annMetaItem}>
            <Ionicons name="calendar-outline" size={11} color="#6B7280" />
            <Text style={st.annMetaText}>{annDate}</Text>
          </View>
          <View style={st.annMetaItem}>
            <Ionicons name="person-outline" size={11} color="#6B7280" />
            <Text style={st.annMetaText}>{annAuthor}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AnnouncementsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('All');

  // API State
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>('employee');
  const isSuperAdmin = userRole === 'superadmin';

  // Form State
  const [showAddModal, setShowAddModal] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCategory, setNewCategory] = useState<'Policy' | 'Event' | 'Holiday' | 'General' | 'Urgent'>('General');
  const [newPriority, setNewPriority] = useState<'Low' | 'Medium' | 'High' | 'Urgent'>('Medium');
  const [audienceType, setAudienceType] = useState<'All' | 'Department'>('All');
  const [audienceDept, setAudienceDept] = useState('');

  const H_PAD = 16;
  const isTablet = width >= 700;

  const statCols = isTablet ? 4 : 2;
  const statGap = 10;
  const statCardW = (width - H_PAD * 2 - statGap * (statCols - 1)) / statCols;

  const annCols = isTablet ? 2 : 1;
  const annGap = 14;
  const annCardW = (width - H_PAD * 2 - annGap * (annCols - 1)) / annCols;

  // ── Load Announcements ──
  const loadAnnouncements = useCallback(async (showIndicator = true) => {
    if (showIndicator) setLoading(true);
    try {
      // 1. Fetch Profile
      const profile = await fetchProfile().catch(() => null);
      if (profile && profile.user) {
        setUser(profile.user);
        setUserRole(profile.user.role || 'employee');
      } else {
        setUser({ _id: '60d0fe4f5311236168a109ca', name: 'Venil Mottana', role: 'employee' });
      }

      // 2. Fetch Announcements
      const res = await fetchAnnouncements();
      let list: any[] = [];
      if (res && res.success && Array.isArray(res.data)) {
        list = res.data;
      }
      setAnnouncements(list);
    } catch (err) {
      console.warn('Failed to fetch announcements from API:', err);
      setAnnouncements([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  // ── Acknowledge Action ──
  const handleAcknowledge = async (id: string) => {
    try {
      await acknowledgeAnnouncementApi(id);

      // Update state locally
      setAnnouncements(prev =>
        prev.map(ann => {
          if ((ann._id || ann.id) === id) {
            const currentUserId = user?._id || '60d0fe4f5311236168a109ca';
            const acknowledgedBy = ann.acknowledgedBy || [];
            if (!acknowledgedBy.includes(currentUserId)) {
              return {
                ...ann,
                acknowledgedBy: [...acknowledgedBy, currentUserId],
              };
            }
          }
          return ann;
        })
      );
      Alert.alert('Success', 'Announcement marked as read.');
    } catch (err: any) {
      // Simulate local success on failure (offline/fallback)
      setAnnouncements(prev =>
        prev.map(ann => {
          if ((ann._id || ann.id) === id) {
            const currentUserId = user?._id || '60d0fe4f5311236168a109ca';
            const acknowledgedBy = ann.acknowledgedBy || [];
            if (!acknowledgedBy.includes(currentUserId)) {
              return {
                ...ann,
                acknowledgedBy: [...acknowledgedBy, currentUserId],
              };
            }
          }
          return ann;
        })
      );
    }
  };

  // ── Toggle Reaction Action ──
  const handleReact = async (id: string, type: string) => {
    try {
      const res = await reactToAnnouncementApi(id, type);
      if (res && res.success && res.data) {
        setAnnouncements(prev =>
          prev.map(ann =>
            (ann._id || ann.id) === id
              ? { ...ann, reactions: res.data.reactions }
              : ann
          )
        );
      }
    } catch (err: any) {
      // Simulate local toggle on failure (offline/fallback)
      setAnnouncements(prev =>
        prev.map(ann => {
          if ((ann._id || ann.id) === id) {
            const currentUserId = user?._id || '60d0fe4f5311236168a109ca';
            const reactions = ann.reactions || [];
            const index = reactions.findIndex(
              (r: any) => r.user === currentUserId && r.type === type
            );

            let updatedReactions = [...reactions];
            if (index > -1) {
              // Toggle off
              updatedReactions.splice(index, 1);
            } else {
              // Add reaction
              updatedReactions.push({ user: currentUserId, type });
            }
            return {
              ...ann,
              reactions: updatedReactions,
            };
          }
          return ann;
        })
      );
    }
  };

  // ── Submit Announcement ──
  const handleCreateAnnouncement = async () => {
    if (!newTitle.trim() || !newDesc.trim()) {
      Alert.alert('Error', 'Please fill in Title and Description.');
      return;
    }

    setFormLoading(true);
    try {
      const formData = new FormData();
      formData.append('title', newTitle.trim());
      formData.append('description', newDesc.trim());
      formData.append('category', newCategory);
      formData.append('priority', newPriority);

      const audience = audienceType === 'All'
        ? { type: 'All' }
        : { type: 'Department', department: audienceDept.trim() || 'Software Engineering' };
      formData.append('targetAudience', JSON.stringify(audience));

      await createAnnouncement(formData);
      Alert.alert('Success', 'Announcement created successfully.');
      setShowAddModal(false);

      // Reset form
      setNewTitle('');
      setNewDesc('');
      setNewCategory('General');
      setNewPriority('Medium');
      setAudienceType('All');
      setAudienceDept('');

      loadAnnouncements(false);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create announcement.');
    } finally {
      setFormLoading(false);
    }
  };

  // ── Delete Announcement ──
  const handleDelete = (id: string) => {
    Alert.alert(
      'Delete Announcement',
      'Are you sure you want to delete this announcement?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAnnouncement(id);
              Alert.alert('Success', 'Announcement deleted successfully.');
              setAnnouncements(prev => prev.filter(a => (a._id || a.id) !== id));
            } catch (err: any) {
              // Local fallback deletion
              setAnnouncements(prev => prev.filter(a => (a._id || a.id) !== id));
              Alert.alert('Success', 'Announcement deleted successfully locally.');
            }
          }
        }
      ]
    );
  };

  // ── Filter announcements list ──
  const filtered = useMemo(() => {
    return announcements.filter(a => {
      const annContent = a.description || a.content || '';
      const annPriority = a.priority || 'Medium';
      const annCategory = a.category || 'General';
      const annAuthor = a.author || '';

      const matchFilter =
        activeFilter === 'All' ||
        annCategory === activeFilter ||
        annPriority === activeFilter;

      const matchSearch =
        search.trim() === '' ||
        a.title.toLowerCase().includes(search.toLowerCase()) ||
        annContent.toLowerCase().includes(search.toLowerCase()) ||
        annAuthor.toLowerCase().includes(search.toLowerCase());

      return matchFilter && matchSearch;
    });
  }, [search, activeFilter, announcements]);

  const highPriority = announcements.filter(a => a.priority === 'High' || a.priority === 'Urgent').length;
  const currentUserId = user?._id || '60d0fe4f5311236168a109ca';
  const readAnnouncementsCount = announcements.filter(a => a.acknowledgedBy?.includes(currentUserId)).length;

  const now = new Date();
  const thisMonthCount = announcements.filter(a => {
    const dateStr = a.createdAt || a.date || '';
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return !isNaN(d.getTime()) && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const statCards = [
    { icon: 'megaphone-outline' as const, iconBg: '#EFF6FF', iconColor: '#2563EB', label: 'TOTAL', value: announcements.length },
    { icon: 'checkmark-done-outline' as const, iconBg: '#ECFDF5', iconColor: '#10B981', label: 'READ ITEMS', value: readAnnouncementsCount },
    { icon: 'notifications-outline' as const, iconBg: '#FFE4EA', iconColor: '#EC003F', label: 'HIGH PRIORITY', value: highPriority },
    { icon: 'calendar-outline' as const, iconBg: '#FFFBEB', iconColor: '#F59E0B', label: 'THIS MONTH', value: thisMonthCount },
  ];

  return (
    <View style={st.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" translucent={false} />

      {/* Header */}
      <View style={st.header}>
        <TouchableOpacity style={st.backBtn} onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color="#111827" />
        </TouchableOpacity>
        <Text style={st.headerTitle}>Announcements</Text>
        {!isSuperAdmin && (
          <TouchableOpacity style={st.addHeaderBtn} onPress={() => setShowAddModal(true)} activeOpacity={0.7}>
            <Ionicons name="add" size={20} color="#111827" />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={st.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={st.loadingText}>Fetching announcements...</Text>
        </View>
      ) : (
        <ScrollView
          style={st.scroll}
          contentContainerStyle={[st.scrollContent, { paddingHorizontal: H_PAD }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Stats Grid */}
          <View style={[st.statsGrid, { gap: statGap }]}>
            {statCards.map((s, i) => (
              <StatCard key={i} {...s} cardWidth={statCardW} />
            ))}
          </View>

          {/* Search & Filters */}
          <View style={st.searchContainer}>
            <View style={st.searchBox}>
              <Ionicons name="search-outline" size={16} color="#6B7280" style={{ marginRight: 8 }} />
              <TextInput
                style={st.searchInput}
                placeholder="Search announcements..."
                placeholderTextColor="#A4A4AD"
                value={search}
                onChangeText={setSearch}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={16} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.filterRow}>
              {FILTERS.map(f => (
                <TouchableOpacity
                  key={f}
                  style={[st.filterChip, activeFilter === f && st.filterChipActive]}
                  onPress={() => setActiveFilter(f)}
                  activeOpacity={0.75}
                >
                  <Text style={[st.filterChipText, activeFilter === f && st.filterChipTextActive]}>{f}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Announcement Cards */}
          {filtered.length === 0 ? (
            <View style={st.emptyState}>
              <Ionicons name="megaphone-outline" size={52} color="#E5E7EB" />
              <Text style={st.emptyText}>No announcements found</Text>
            </View>
          ) : (
            <View style={[st.cardsGrid, { gap: annGap }]}>
              {filtered.map(item => (
                <AnnouncementCard
                  key={item._id || item.id}
                  item={item}
                  cardWidth={annCardW}
                  onDelete={handleDelete}
                  onAcknowledge={handleAcknowledge}
                  onReact={handleReact}
                  currentUserId={currentUserId}
                  userRole={user?.role}
                />
              ))}
            </View>
          )}

          <View style={{ height: 110 }} />
        </ScrollView>
      )}

      {/* Add Announcement Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent onRequestClose={() => setShowAddModal(false)}>
        <View style={st.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={st.modalCard}>
            <View style={st.modalHeader}>
              <View>
                <Text style={st.modalTitle}>Create Announcement</Text>
                <Text style={st.modalSub}>Publish an update to the system dashboard</Text>
              </View>
              <TouchableOpacity onPress={() => setShowAddModal(false)} style={st.modalClose}>
                <Ionicons name="close" size={20} color={Colors.gray600} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
              <Text style={st.fieldLabel}>Announcement Title *</Text>
              <TextInput style={st.textInput} value={newTitle} onChangeText={setNewTitle} placeholder="e.g. Leave Policy Modification" placeholderTextColor="#A4A4AD" />

              <Text style={st.fieldLabel}>Description / Message *</Text>
              <TextInput style={[st.textInput, { height: 100, paddingTop: 10 }]} multiline value={newDesc} onChangeText={setNewDesc} placeholder="Enter description content..." placeholderTextColor="#A4A4AD" />

              <Text style={st.fieldLabel}>Category</Text>
              <View style={st.pickerContainer}>
                {(['Policy', 'Event', 'Holiday', 'General', 'Urgent'] as const).map(c => (
                  <TouchableOpacity key={c} style={[st.pickerChip, newCategory === c && st.pickerChipActive]} onPress={() => setNewCategory(c)}>
                    <Text style={[st.pickerChipText, newCategory === c && st.pickerChipTextActive]}>{c.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={st.fieldLabel}>Priority Level</Text>
              <View style={st.pickerContainer}>
                {(['Low', 'Medium', 'High', 'Urgent'] as const).map(p => (
                  <TouchableOpacity key={p} style={[st.pickerChip, newPriority === p && st.pickerChipActive]} onPress={() => setNewPriority(p)}>
                    <Text style={[st.pickerChipText, newPriority === p && st.pickerChipTextActive]}>{p.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={st.fieldLabel}>Target Audience</Text>
              <View style={st.pickerContainer}>
                {(['All', 'Department'] as const).map(a => (
                  <TouchableOpacity key={a} style={[st.pickerChip, audienceType === a && st.pickerChipActive]} onPress={() => setAudienceType(a)}>
                    <Text style={[st.pickerChipText, audienceType === a && st.pickerChipTextActive]}>{a.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {audienceType === 'Department' && (
                <>
                  <Text style={st.fieldLabel}>Department Name</Text>
                  <TextInput style={st.textInput} value={audienceDept} onChangeText={setAudienceDept} placeholder="e.g. Software Engineering" placeholderTextColor="#A4A4AD" />
                </>
              )}

              <View style={st.modalActions}>
                <TouchableOpacity style={st.modalCancelBtn} onPress={() => setShowAddModal(false)}>
                  <Text style={st.modalCancelTxt}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={st.modalSubmitBtn} onPress={handleCreateAnnouncement} disabled={formLoading}>
                  {formLoading ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={st.modalSubmitTxt}>Publish</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 10 : 54, paddingBottom: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  addHeaderBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: '#111827', letterSpacing: -0.3 },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 18 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 },
  statCard: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', padding: 12, flexDirection: 'row', alignItems: 'center', ...(Platform.OS === 'web' ? { boxShadow: '0px 2px 8px rgba(0,0,0,0.06)' } : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }) },
  statIconCircle: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12, ...IconBox.shadow as any },
  statContent: { flex: 1 },
  statLabel: { fontSize: 10, fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', marginBottom: 2 },
  statValue: { fontSize: 24, fontWeight: '800', color: '#111827' },

  searchContainer: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB', padding: 12, marginBottom: 16, ...(Platform.OS === 'web' ? { boxShadow: '0px 2px 8px rgba(0,0,0,0.05)' } : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 1 }) },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 10, borderWidth: 1, borderColor: '#E4E4E7', paddingHorizontal: 12, height: 44, marginBottom: 10 },
  searchInput: { flex: 1, fontSize: 14, color: '#111827', padding: 0 },
  filterRow: { gap: 8, paddingBottom: 2 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff' },
  filterChipActive: { backgroundColor: '#111827', borderColor: '#111827' },
  filterChipText: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  filterChipTextActive: { color: '#fff' },

  cardsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  annCard: { backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB', borderTopWidth: 4, padding: 14 },
  annCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  annBadgeRow: { flexDirection: 'row', gap: 5, flexWrap: 'wrap', flex: 1 },
  badge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  deleteBtn: { width: 28, height: 28, borderRadius: 6, backgroundColor: '#FFF5F6', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FFE2E4', marginLeft: 8 },

  annTitle: { fontSize: 14, fontWeight: '700', color: '#2563EB', marginBottom: 5, lineHeight: 20 },
  annDesc: { fontSize: 12, color: '#6B7280', lineHeight: 18, marginBottom: 12 },
  annDivider: { height: 1, backgroundColor: '#F3F4F6', marginBottom: 10 },
  annFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  annMeta: { gap: 5, flex: 1 },
  annMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  annMetaText: { fontSize: 11, color: '#6B7280', fontWeight: '500' },

  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 8 },
  reactionsContainer: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', flex: 1, marginRight: 8 },
  reactionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: 'transparent' },
  reactionBtnActive: { backgroundColor: '#EFF6FF', borderColor: '#3B82F6' },
  reactionEmoji: { fontSize: 13 },
  reactionCount: { fontSize: 11, color: '#6B7280', marginLeft: 4, fontWeight: '600' },
  reactionCountActive: { color: '#2563EB' },

  acknowledgeBtn: { backgroundColor: '#2563EB', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  acknowledgeBtnText: { fontSize: 11, color: '#fff', fontWeight: '700' },
  acknowledgedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#E6F4EA' },
  acknowledgedText: { fontSize: 11, color: '#137333', fontWeight: '700' },

  emptyState: { alignItems: 'center', paddingVertical: 64, width: '100%' },
  emptyText: { fontSize: 14, color: '#9CA3AF', marginTop: 12, fontWeight: '500' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  loadingText: { fontSize: 13, color: '#6B7280', marginTop: 10, fontWeight: '500' },

  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%', paddingHorizontal: 20, paddingTop: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.gray900 },
  modalSub: { fontSize: 12, color: Colors.gray400, marginTop: 2 },
  modalClose: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.gray100, alignItems: 'center', justifyContent: 'center' },

  fieldLabel: { fontSize: 11, fontWeight: '700', color: Colors.gray600, marginTop: 12, marginBottom: 6, letterSpacing: 0.2, textTransform: 'uppercase' },
  textInput: { height: 46, backgroundColor: '#F9FAFB', borderRadius: 10, borderWidth: 1.5, borderColor: '#E4E4E7', paddingHorizontal: 14, fontSize: 13, color: Colors.gray900 },

  pickerContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 4 },
  pickerChip: { backgroundColor: '#F9FAFB', borderWidth: 1.5, borderColor: '#E4E4E7', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  pickerChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pickerChipText: { fontSize: 11, color: Colors.gray600, fontWeight: '700' },
  pickerChipTextActive: { color: Colors.white },

  modalActions: { flexDirection: 'row', gap: 10, marginTop: 20, marginBottom: 20 },
  modalCancelBtn: { flex: 1, height: 48, borderRadius: 12, borderWidth: 1.5, borderColor: '#E4E4E7', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.white },
  modalCancelTxt: { fontSize: 14, fontWeight: '700', color: Colors.gray600 },
  modalSubmitBtn: { flex: 2, height: 48, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  modalSubmitTxt: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
