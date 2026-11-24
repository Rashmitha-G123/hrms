import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Radius, Shadow } from '../../design-system/tokens';
import { useAuth } from '../../context/AuthContext';

interface ModuleItem {
  id: string;
  label: string;
  subtitle: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  route: string;
  module?: string;
  category: 'Core' | 'Work' | 'Finance' | 'People' | 'CRM' | 'Communication';
  origin: 'Footer' | 'Quick Action';
}

const ALL_MODULES: ModuleItem[] = [
  // ── Footer Modules ──
  {
    id: 'home',
    label: 'Home',
    subtitle: 'Dashboard overview, stats & shortcut feed',
    icon: 'home-outline',
    color: '#2563EB',
    route: '/(tabs)',
    category: 'Core',
    origin: 'Footer',
  },
  {
    id: 'attendance',
    label: 'Attendance',
    subtitle: 'Clock in/out, shift records & monthly logs',
    icon: 'time-outline',
    color: '#EF4444',
    route: '/(tabs)/attendance',
    module: 'attendance',
    category: 'Core',
    origin: 'Footer',
  },
  {
    id: 'leaves',
    label: 'Leaves',
    subtitle: 'Apply for leave, balance details & approvals',
    icon: 'calendar-outline',
    color: '#10B981',
    route: '/(tabs)/leaves',
    module: 'leaves',
    category: 'Core',
    origin: 'Footer',
  },
  {
    id: 'announcements',
    label: 'Announcements',
    subtitle: 'Company notices, circulars & office news',
    icon: 'megaphone-outline',
    color: '#F59E0B',
    route: '/(tabs)/announcements',
    module: 'announcements',
    category: 'Communication',
    origin: 'Footer',
  },
  {
    id: 'profile',
    label: 'Profile',
    subtitle: 'Personal profile, employment & bank records',
    icon: 'person-outline',
    color: '#6366F1',
    route: '/(tabs)/profile',
    category: 'People',
    origin: 'Footer',
  },

  // ── Quick Action Modules ──
  {
    id: 'tasks',
    label: 'Tasks',
    subtitle: 'Manage assigned tasks, deadlines & daily to-dos',
    icon: 'checkmark-circle-outline',
    color: '#3B82F6',
    route: '/(tabs)/tasks',
    module: 'tasks',
    category: 'Work',
    origin: 'Quick Action',
  },
  {
    id: 'leads',
    label: 'Leads',
    subtitle: 'CRM pipelines, inquiries, follow-ups & deals',
    icon: 'person-add-outline',
    color: '#34D399',
    route: '/(tabs)/leads',
    module: 'leads',
    category: 'CRM',
    origin: 'Quick Action',
  },
  {
    id: 'expenses',
    label: 'Expenses',
    subtitle: 'Submit expense claims, attach receipts & history',
    icon: 'wallet-outline',
    color: '#8B5CF6',
    route: '/(tabs)/expenses',
    module: 'expenses',
    category: 'Finance',
    origin: 'Quick Action',
  },
  {
    id: 'employees',
    label: 'Employees',
    subtitle: 'Staff directory, team contacts & department hierarchy',
    icon: 'people-outline',
    color: '#F59E0B',
    route: '/employees',
    module: 'employees',
    category: 'People',
    origin: 'Quick Action',
  },
  {
    id: 'projects',
    label: 'Projects',
    subtitle: 'Client project deliverables, stages & milestones',
    icon: 'briefcase-outline',
    color: '#0EA5E9',
    route: '/projects',
    module: 'projects',
    category: 'Work',
    origin: 'Quick Action',
  },
  {
    id: 'payroll',
    label: 'Payroll',
    subtitle: 'Salary payslips, breakdown, tax & deductions',
    icon: 'cash-outline',
    color: '#10B981',
    route: '/payroll',
    module: 'payroll',
    category: 'Finance',
    origin: 'Quick Action',
  },
  {
    id: 'chat',
    label: 'Chat',
    subtitle: 'Team channels, group discussions & direct messages',
    icon: 'chatbubbles-outline',
    color: '#6366F1',
    route: '/(tabs)/chat',
    module: 'chat',
    category: 'Communication',
    origin: 'Quick Action',
  },
];

export default function MoreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { canViewModule } = useAuth();
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const { width: windowWidth } = useWindowDimensions();

  // Exactly calculate card width so 4 cards ALWAYS fit on a single row without wrapping early
  const cardWidth = useMemo(() => {
    const containerWidth = windowWidth - 32; // 16px padding on left & right
    const totalGap = 8 * 3; // 3 gaps of 8px between 4 cards
    return Math.floor((containerWidth - totalGap) / 4);
  }, [windowWidth]);

  // Filter by permission
  const accessibleModules = useMemo(() => {
    return ALL_MODULES.filter((item) => !item.module || canViewModule(item.module));
  }, [canViewModule]);

  // Filter by search query
  const filteredModules = useMemo(() => {
    if (!search.trim()) return accessibleModules;
    const q = search.trim().toLowerCase();
    return accessibleModules.filter(
      (m) =>
        m.label.toLowerCase().includes(q) ||
        m.subtitle.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q)
    );
  }, [accessibleModules, search]);

  // Render 4-column Grid Card
  const renderCard = (item: ModuleItem) => (
    <TouchableOpacity
      key={item.id}
      style={[styles.smallCard, { width: cardWidth }]}
      onPress={() => router.push(item.route as any)}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.iconBox,
          { backgroundColor: `${item.color}15`, borderColor: `${item.color}30` },
        ]}
      >
        <Ionicons name={item.icon} size={20} color={item.color} />
      </View>
      <Text style={styles.cardLabel} numberOfLines={1}>
        {item.label}
      </Text>
    </TouchableOpacity>
  );

  // Render List Row Item
  const renderListItem = (item: ModuleItem) => (
    <TouchableOpacity
      key={item.id}
      style={styles.listItem}
      onPress={() => router.push(item.route as any)}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.listIconBox,
          { backgroundColor: `${item.color}15`, borderColor: `${item.color}30` },
        ]}
      >
        <Ionicons name={item.icon} size={22} color={item.color} />
      </View>
      <View style={styles.listTextCol}>
        <Text style={styles.listTitle}>{item.label}</Text>
        <Text style={styles.listSubtitle} numberOfLines={1}>
          {item.subtitle}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" translucent={false} />

      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop:
              Platform.OS === 'android'
                ? (StatusBar.currentHeight || 24) + 16
                : Math.max(insets.top, 20) + 16,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>All Modules</Text>
            <Text style={styles.headerSub}>
              {accessibleModules.length} features available
            </Text>
          </View>
          <View style={styles.headerIconCircle}>
            <Ionicons name="apps" size={20} color={Colors.primary} />
          </View>
        </View>

        {/* Search Bar & View Mode Toggle Row */}
        <View style={styles.searchToggleRow}>
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search module or action..."
              placeholderTextColor="#94A3B8"
              value={search}
              onChangeText={setSearch}
              clearButtonMode="while-editing"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={18} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          {/* View Mode Toggle: Grid vs List */}
          <View style={styles.viewModeToggle}>
            <TouchableOpacity
              style={[styles.viewModeBtn, viewMode === 'grid' && styles.viewModeBtnActive]}
              onPress={() => setViewMode('grid')}
              activeOpacity={0.7}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            >
              <Ionicons
                name="grid"
                size={16}
                color={viewMode === 'grid' ? Colors.primary : '#94A3B8'}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.viewModeBtn, viewMode === 'list' && styles.viewModeBtnActive]}
              onPress={() => setViewMode('list')}
              activeOpacity={0.7}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            >
              <Ionicons
                name="list"
                size={18}
                color={viewMode === 'list' ? Colors.primary : '#94A3B8'}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Content: Grid View or List View */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 110 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {filteredModules.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconBg}>
              <Ionicons name="search" size={28} color="#94A3B8" />
            </View>
            <Text style={styles.emptyTitle}>No modules found</Text>
            <Text style={styles.emptySubtitle}>Try searching with a different term</Text>
          </View>
        ) : viewMode === 'grid' ? (
          <View style={styles.gridContainer}>
            {filteredModules.map(renderCard)}
          </View>
        ) : (
          <View style={styles.listContainer}>
            {filteredModules.map(renderListItem)}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  headerSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  headerIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: `${Colors.primary}15`,
    borderWidth: 1,
    borderColor: `${Colors.primary}30`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    paddingVertical: 0,
  },
  viewModeToggle: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    height: 42,
    alignItems: 'center',
  },
  viewModeBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewModeBtnActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  // Grid of Small Cards (4 per row)
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  smallCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadow.sm,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },

  // List View Styles
  listContainer: {
    gap: 8,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadow.sm,
  },
  listIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  listTextCol: {
    flex: 1,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  listSubtitle: {
    fontSize: 12,
    color: '#64748B',
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyIconBg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#94A3B8',
  },
});
