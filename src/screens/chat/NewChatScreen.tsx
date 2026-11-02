import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, Platform, StatusBar, ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius } from '../../design-system/tokens';
import { Avatar } from '../../design-system/components/Avatar';
import { mockEmployees, mockChats } from '../../data/mockData';
import { getOrCreateDirectChat } from '../../services/chatService';
import { fetchEmployeesSelectionApi } from '../../services/employeeService';

export default function NewChatScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);

  const loadEmployees = async () => {
    try {
      const res = await fetchEmployeesSelectionApi(1, 100);
      const list = res && Array.isArray(res.employees) ? res.employees : [];
      const mapped = list.map((emp: any) => ({
        id: emp._id,
        name: emp.name || (emp.employeePersonal && emp.employeePersonal.fullName) || 'Unknown Employee',
        employeeId: emp.employeeId || '',
        designation: (emp.employmentDetails && emp.employmentDetails.designation && emp.employmentDetails.designation.name) || emp.role || 'Employee',
        initials: (emp.name || '')
          .split(' ')
          .map((n: string) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2) || '??',
      }));
      setEmployees(mapped);
    } catch (err) {
      console.warn('Failed to fetch employee directory:', err);
      // Fallback to mockEmployees
      const mappedMocks = mockEmployees.map(emp => ({
        id: emp.id,
        name: emp.name,
        employeeId: emp.id,
        designation: emp.designation,
        initials: emp.initials,
      }));
      setEmployees(mappedMocks);
    } finally {
      setLoadingEmployees(false);
    }
  };

  React.useEffect(() => {
    loadEmployees();
  }, []);

  const handleSelect = async (emp: any) => {
    setLoading(true);
    try {
      const res = await getOrCreateDirectChat(emp.id);
      let id = '';
      if (res && res.success && res.conversation) {
        id = res.conversation._id || res.conversation.id;
      } else if (res && (res._id || res.id)) {
        id = res._id || res.id;
      }

      if (id) {
        router.replace(`/chat/${id}` as any);
      } else {
        router.back();
      }
    } catch (err: any) {
      // Local fallback simulation lookup
      const existing = mockChats.find(c => !c.isGroup && (c as any).initials === emp.initials);
      if (existing) {
        router.replace(`/chat/${existing.id}` as any);
      } else {
        router.back();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)/chat');
            }
          }} 
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Message</Text>
      </View>

      {loading || loadingEmployees ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>
            {loading ? 'Initializing chat...' : 'Loading directory...'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={employees}
          keyExtractor={e => e.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.row} activeOpacity={0.75} onPress={() => handleSelect(item)}>
              <Avatar name={item.name} initials={item.initials} size={48} />
              <View style={styles.info}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.role}>{item.designation}</Text>
              </View>
              <Ionicons name="chatbubble-outline" size={18} color={Colors.primary} />
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FAFAFA' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.primary,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 12 : 56,
    paddingHorizontal: Spacing[4], paddingBottom: Spacing[3],
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: Typography.fontSize.xl, fontWeight: '700', color: Colors.white },
  list: { padding: Spacing[4] },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  info: { flex: 1 },
  name: { fontSize: Typography.fontSize.base, fontWeight: '600', color: Colors.gray900 },
  role: { fontSize: Typography.fontSize.sm, color: Colors.gray500, marginTop: 2 },
  separator: { height: 1, backgroundColor: Colors.gray100 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 10, fontSize: 13, color: Colors.gray500 },
});
