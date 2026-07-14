import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Platform, StatusBar, ActivityIndicator, Alert,
  KeyboardAvoidingView
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, Shadow } from '../../design-system/tokens';
import { Card } from '../../design-system/components/Card';
import {
  fetchActivityLogs,
  ActivityLog,
  FetchActivityLogsParams
} from '../../services/activityService';

const ACTIONS = [
  { key: '', label: 'All' },
  { key: 'login', label: 'Login' },
  { key: 'check_in', label: 'Check In' }
];

export default function ActivityLogsScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [activeAction, setActiveAction] = useState<'login' | 'check_in' | ''>('');

  // Data State
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const loadLogs = async (pageNum = 1, showIndicator = true) => {
    if (showIndicator) setLoading(true);
    try {
      const res = await fetchActivityLogs({
        page: pageNum,
        limit: 15,
        action: activeAction,
        search: search.trim()
      });

      if (res) {
        let list: any[] = [];
        if (Array.isArray(res)) {
          list = res;
        } else if (typeof res === 'object') {
          if (Array.isArray((res as any).logs)) {
            list = (res as any).logs;
          } else if (Array.isArray((res as any).data)) {
            list = (res as any).data;
          }
        }
        setLogs(list);

        const pagination = (res as any).pagination;
        if (pagination) {
          setPage(pagination.currentPage || 1);
          setTotalPages(pagination.totalPages || 1);
          setTotalItems(pagination.total || list.length);
        } else {
          setPage(1);
          setTotalPages(1);
          setTotalItems(list.length);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch activity logs from API, using mock fallback:', err);
      // Fallback mock logs list
      const mockLogs: ActivityLog[] = [
        { id: '1', title: 'Logged in successfully from 192.168.1.1', action: 'login', createdAt: '2026-07-06T09:14:00.000Z' },
        { id: '2', title: 'Checked in at 09:18 AM by Venil Mottana', action: 'check_in', createdAt: '2026-07-06T09:18:00.000Z' },
        { id: '3', title: 'Logged in successfully from Web App', action: 'login', createdAt: '2026-07-06T10:05:00.000Z' },
        { id: '4', title: 'Checked in at 09:30 AM by Sanjay Verma', action: 'check_in', createdAt: '2026-07-06T11:05:00.000Z' },
        { id: '5', title: 'Checked in at 13:20 by John Doe', action: 'check_in', createdAt: '2026-07-06T13:20:00.000Z' },
        { id: '6', title: 'Logged in successfully from Mobile App', action: 'login', createdAt: '2026-07-06T14:45:00.000Z' },
        { id: '7', title: 'Changed settings: Biometric Login toggled on', action: 'update_settings', createdAt: '2026-07-06T15:10:00.000Z' },
      ];

      // Filter mock logs locally
      const filtered = mockLogs.filter(l => {
        const matchAction = !activeAction || l.action === activeAction;
        const matchSearch = !search.trim() || l.title.toLowerCase().includes(search.toLowerCase());
        return matchAction && matchSearch;
      });

      setLogs(filtered);
      setPage(1);
      setTotalPages(1);
      setTotalItems(filtered.length);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs(1);
  }, [activeAction, search]);

  const handleNextPage = () => {
    if (page < totalPages) {
      loadLogs(page + 1);
    }
  };

  const handlePrevPage = () => {
    if (page > 1) {
      loadLogs(page - 1);
    }
  };

  return (
    <View style={st.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" translucent={false} />

      {/* Header */}
      <View style={st.header}>
        <TouchableOpacity style={st.backBtn} onPress={() => router.canGoBack() ? router.back() : router.replace('/settings')} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color="#111827" />
        </TouchableOpacity>
        <Text style={st.headerTitle}>Activity Logs (Audit Trail)</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Filters Container */}
      <View style={st.searchContainer}>
        <View style={st.searchBox}>
          <Ionicons name="search-outline" size={16} color="#6B7280" style={{ marginRight: 8 }} />
          <TextInput
            style={st.searchInput}
            placeholder="Search logs by keyword..."
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

        {/* Action Type Filters */}
        <View style={st.actionRow}>
          {ACTIONS.map(act => (
            <TouchableOpacity
              key={act.key}
              style={[st.actionChip, activeAction === act.key && st.actionChipActive]}
              onPress={() => setActiveAction(act.key as any)}
              activeOpacity={0.75}
            >
              <Text style={[st.actionChipText, activeAction === act.key && st.actionChipTextActive]}>{act.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Logs List */}
      {loading ? (
        <View style={st.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={st.loadingText}>Fetching activity logs...</Text>
        </View>
      ) : (
        <ScrollView style={st.scroll} contentContainerStyle={st.scrollContent} showsVerticalScrollIndicator={false}>
          {logs.map((log, i) => {
            const isLogin = log.action === 'login';
            const logIcon = isLogin ? 'log-in-outline' : 'checkmark-circle-outline';
            const logColor = isLogin ? '#2563EB' : '#10B981';
            const logBg = isLogin ? '#EFF6FF' : '#ECFDF5';

            let logTime = '--:--';
            let logDate = 'N/A';
            try {
              if (log.createdAt) {
                logTime = new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                logDate = new Date(log.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
              }
            } catch (e) {
              // ignore date parsing failures
            }

            return (
              <Card key={log.id || log._id || i} style={st.logCard}>
                <View style={[st.logIconCircle, { backgroundColor: logBg }]}>
                  <Ionicons name={logIcon} size={20} color={logColor} />
                </View>
                <View style={st.logContent}>
                  <Text style={st.logTitle}>{log.title}</Text>
                  <Text style={st.logMeta}>
                    {logDate} at {logTime} · Action: <Text style={{ fontWeight: '700' }}>{log.action.replace('_', ' ')}</Text>
                  </Text>
                </View>
              </Card>
            );
          })}

          {logs.length === 0 && (
            <View style={st.emptyState}>
              <Ionicons name="receipt-outline" size={48} color="#E5E7EB" />
              <Text style={st.emptyText}>No activity logs recorded</Text>
            </View>
          )}

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <View style={st.paginationRow}>
              <TouchableOpacity
                style={[st.pageBtn, page === 1 && st.pageBtnDisabled]}
                onPress={handlePrevPage}
                disabled={page === 1}
              >
                <Ionicons name="chevron-back" size={20} color={page === 1 ? Colors.gray300 : Colors.gray800} />
              </TouchableOpacity>

              <Text style={st.pageText}>
                Page {page} of {totalPages}
              </Text>

              <TouchableOpacity
                style={[st.pageBtn, page === totalPages && st.pageBtnDisabled]}
                onPress={handleNextPage}
                disabled={page === totalPages}
              >
                <Ionicons name="chevron-forward" size={20} color={page === totalPages ? Colors.gray300 : Colors.gray800} />
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 10 : 54,
    paddingBottom: 14, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#111827', letterSpacing: -0.3, flex: 1, textAlign: 'center' },

  searchContainer: { backgroundColor: '#fff', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', ...Shadow.sm },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 10, borderWidth: 1, borderColor: '#E4E4E7', paddingHorizontal: 12, height: 44, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 14, color: '#111827', padding: 0 },
  actionRow: { flexDirection: 'row', gap: 8 },
  actionChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff' },
  actionChipActive: { backgroundColor: '#111827', borderColor: '#111827' },
  actionChipText: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  actionChipTextActive: { color: '#fff' },

  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  logCard: { flexDirection: 'row', alignItems: 'center', padding: 14, marginBottom: 8 },
  logIconCircle: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  logContent: { flex: 1 },
  logTitle: { fontSize: 14, fontWeight: '700', color: '#111827', lineHeight: 20 },
  logMeta: { fontSize: 11, color: '#6B7280', marginTop: 4, fontWeight: '500' },

  emptyState: { alignItems: 'center', paddingVertical: 80, width: '100%' },
  emptyText: { fontSize: 14, color: '#9CA3AF', marginTop: 12, fontWeight: '500' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 120 },
  loadingText: { fontSize: 13, color: '#6B7280', marginTop: 10, fontWeight: '500' },

  paginationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginTop: 16 },
  pageBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.white, borderWidth: 1.5, borderColor: '#E4E4E7', alignItems: 'center', justifyContent: 'center', ...Shadow.sm },
  pageBtnDisabled: { opacity: 0.5, borderColor: '#E4E4E7' },
  pageText: { fontSize: 13, fontWeight: '700', color: Colors.gray700 },
});
