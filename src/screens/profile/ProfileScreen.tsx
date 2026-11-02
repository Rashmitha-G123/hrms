import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, StatusBar, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, Shadow, IconBox } from '../../design-system/tokens';
import { Card, Divider } from '../../design-system/components/Card';
import { Avatar } from '../../design-system/components/Avatar';
import { Badge } from '../../design-system/components/Badge';
import { fetchProfile, logoutApi } from '../../services/authService';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const MENU_ITEMS: { iconName: IoniconName; label: string; route: string; color: string }[] = [
  { iconName: 'person-outline', label: 'Personal Information', route: '/profile/personal', color: Colors.primary },
  { iconName: 'briefcase-outline', label: 'Employment Details', route: '/profile/employment', color: Colors.accent },
  { iconName: 'card-outline', label: 'Bank Details', route: '/profile/bank', color: Colors.success },
  { iconName: 'shield-checkmark-outline', label: 'Statutory Compliance', route: '/profile/statutory', color: Colors.success },
  { iconName: 'document-text-outline', label: 'Documents', route: '/profile/documents', color: Colors.warning },
  // { iconName: 'lock-closed-outline', label: 'Security & Password', route: '/settings/security', color: Colors.danger },
  // { iconName: 'notifications-outline', label: 'Notification Preferences', route: '/settings/notifications', color: Colors.info },
  // { iconName: 'settings-outline', label: 'App Settings', route: '/settings', color: Colors.gray600 },
];

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  const loadProfile = React.useCallback(async () => {
    try {
      const data = await fetchProfile();
      if (data && data.user) {
        setProfile(data.user);
      }
    } catch (err) {
      console.warn('Failed to fetch profile from API:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  const handleLogout = async () => {
    try {
      await logoutApi();
    } catch (err) {
      console.warn('Failed to logout via API:', err);
    }
    router.replace('/auth/welcome');
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <StatusBar barStyle="dark-content" />
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={{ marginTop: 10, color: Colors.gray500, fontSize: 13 }}>Loading Profile...</Text>
      </View>
    );
  }

  const isSuperAdmin = profile?.role === 'superadmin';

  const name = profile?.name || 'User Profile';
  const initials = name ? name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : 'UP';
  const designation = profile?.employmentDetails?.designation?.name || profile?.designation || 'Employee';
  const department = profile?.employmentDetails?.department?.name || profile?.department || 'Department';
  const employeeId = profile?.employeeId || '';
  const reportingManager = profile?.employmentDetails?.reportingManager && typeof profile.employmentDetails.reportingManager === 'object'
    ? profile.employmentDetails.reportingManager.name
    : profile?.employmentDetails?.reportingManager || '';

  const rawJoinDate = profile?.employmentDetails?.dateOfJoining || profile?.dateOfJoining || '';

  const formatJoinedDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        const day = String(d.getDate()).padStart(2, '0');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthName = months[d.getMonth()];
        const year = d.getFullYear();
        return `${day} ${monthName} ${year}`;
      }
    } catch (e) {
      // fallback
    }
    return dateStr;
  };

  const joinedDate = formatJoinedDate(rawJoinDate);

  const allInfoRows: { iconName: IoniconName; label: string; value: string }[] = [
    { iconName: 'id-card-outline', label: 'Employee ID', value: employeeId },
    { iconName: 'briefcase-outline', label: 'Designation', value: designation },
    { iconName: 'business-outline', label: 'Department', value: department },
    { iconName: 'calendar-outline', label: 'Joined', value: joinedDate },
    { iconName: 'person-outline', label: 'Reports to', value: reportingManager },
    { iconName: 'location-outline', label: 'Location', value: profile?.employmentDetails?.workLocation || profile?.location || '' },
    { iconName: 'mail-outline', label: 'Email', value: profile?.email || profile?.employeePersonal?.emailAddress || '' },
    { iconName: 'call-outline', label: 'Phone', value: profile?.employeePersonal?.contactNumber || profile?.phone || '' },
  ];

  const SUPERADMIN_HIDDEN_LABELS = ['Designation', 'Department', 'Reports to'];
  const infoRows = isSuperAdmin
    ? allInfoRows.filter(r => !SUPERADMIN_HIDDEN_LABELS.includes(r.label))
    : allInfoRows;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroBg} />
          <View style={styles.heroCircle1} />
          <View style={styles.heroCircle2} />
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={Colors.white} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.editBtn} onPress={() => router.push('/profile/personal')}>
            <Ionicons name="create-outline" size={20} color={Colors.white} />
            {/* <Text style={styles.editText}> Edit</Text> */}
          </TouchableOpacity>
          <View style={styles.avatarWrap}>
            <Avatar name={name} initials={initials} size={90} />
            <TouchableOpacity style={styles.cameraBtn}>
              <Ionicons name="camera-outline" size={14} color={Colors.primary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.heroName}>{name}</Text>
          {!isSuperAdmin && <Text style={styles.heroDesignation}>{designation}</Text>}
          <View style={styles.heroBadges}>
            {!isSuperAdmin && <Badge label={department} variant="danger" />}
            <Badge label="Active" variant="success" dot />
          </View>
          <Text style={styles.heroId}>ID: {employeeId}</Text>
        </View>

        {/* <View style={styles.statsRow}>
          {[
            { label: 'Tasks', value: '6', iconName: 'list-outline' as IoniconName, color: '#428DFF' },
            { label: 'Leave Days', value: `${profile?.leaveBalance?.remaining?.annual || 0}`, iconName: 'calendar-outline' as IoniconName, color: '#10C185' },
            { label: 'Attendance', value: '96%', iconName: 'checkmark-circle-outline' as IoniconName, color: '#FF2056', },
          ].map(stat => (
            <View key={stat.label} style={[styles.statBox, Shadow.sm]}>
              <Ionicons name={stat.iconName} size={18} color={stat.color} />
              <View style={styles.statTexts}>
                <Text style={styles.statLabel} numberOfLines={1}>{stat.label}</Text>
                <Text style={styles.statValue}>{stat.value}</Text>
              </View>
            </View>
          ))}
        </View> */}

        <Card style={styles.infoCard}>
          <Text style={styles.sectionLabel}>Employee Information</Text>
          {infoRows.map((row, i) => (
            <View key={row.label}>
              <View style={styles.infoRow}>
                <View style={styles.infoIconBox}>
                  <Ionicons name={row.iconName} size={16} color={Colors.primary} />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>{row.label}</Text>
                  <Text style={styles.infoValue}>{row.value || 'N/A'}</Text>
                </View>
              </View>
              {i < infoRows.length - 1 && <Divider />}
            </View>
          ))}
        </Card>

        {!isSuperAdmin && (
          <Card style={styles.menuCard}>
            <Text style={styles.sectionLabel}>Profile Settings</Text>
            {MENU_ITEMS.map((item, i) => (
              <TouchableOpacity key={item.label} style={styles.menuItem} onPress={() => router.push(item.route as any)} activeOpacity={0.7}>
                <View style={styles.menuIconBox}>
                  <Ionicons name={item.iconName} size={18} color={item.color} />
                </View>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={18} color={Colors.gray400} />
              </TouchableOpacity>
            ))}
          </Card>
        )}

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>MetroMindz HRMS v2.0.1</Text>
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa', },
  scroll: { flex: 1 },
  hero: { backgroundColor: Colors.primary, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 12 : 56, paddingHorizontal: Spacing[4], paddingBottom: 40, alignItems: 'center', overflow: 'hidden' },
  heroBg: { ...StyleSheet.absoluteFill, backgroundColor: Colors.primary },
  heroCircle1: { position: 'absolute', width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(255,255,255,0.10)', top: -100, right: -80 },
  heroCircle2: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.07)', bottom: -60, left: -40 },
  backBtn: { position: 'absolute', top: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 16 : 60, left: Spacing[4] },
  editBtn: { position: 'absolute', top: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 16 : 60, right: Spacing[4], width: 40, height: 40, alignItems: 'center', borderRadius: 20, justifyContent: 'center', ...Shadow.sm, },
  editText: { fontSize: Typography.fontSize.xs, color: Colors.white, fontWeight: '600' },
  avatarWrap: { position: 'relative', marginBottom: 16 },
  cameraBtn: { position: 'absolute', bottom: 0, right: 0, backgroundColor: Colors.white, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.primary },
  heroName: { fontSize: Typography.fontSize['2xl'], fontWeight: '800', color: Colors.white, marginBottom: 4 },
  heroDesignation: { fontSize: Typography.fontSize.sm, color: 'rgba(255,255,255,0.8)', marginBottom: 12 },
  heroBadges: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  heroId: { fontSize: Typography.fontSize.xs, color: 'rgba(255,255,255,0.5)' },
  statsRow: { flexDirection: 'row', paddingHorizontal: Spacing[4], marginTop: -20, gap: 8, marginBottom: Spacing[4] },
  statBox: { flex: 1, backgroundColor: Colors.white, borderRadius: Radius.md, paddingVertical: 8, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  statTexts: { flex: 1 },
  statValue: { fontSize: 16, fontWeight: '800', color: Colors.gray900, marginTop: 1 },
  statLabel: { fontSize: 10, color: '#45556C', fontWeight: '600' },
  infoCard: { marginHorizontal: Spacing[4], marginBottom: Spacing[3] },
  menuCard: { marginHorizontal: Spacing[4], marginBottom: Spacing[3] },
  sectionLabel: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.gray500, marginBottom: 16, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  infoIconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: IconBox.bg, alignItems: 'center', justifyContent: 'center', marginRight: 12, ...IconBox.shadow as any },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: Typography.fontSize.xs, color: Colors.gray400, marginBottom: 1 },
  infoValue: { fontSize: Typography.fontSize.sm, color: Colors.gray800, fontWeight: '600' },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  menuIconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: IconBox.bg, alignItems: 'center', justifyContent: 'center', marginRight: 12, ...IconBox.shadow as any },
  menuLabel: { flex: 1, fontSize: Typography.fontSize.base, color: Colors.gray800, fontWeight: '500' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: 200, alignSelf: 'center', marginHorizontal: Spacing[4], marginBottom: Spacing[3], backgroundColor: Colors.dangerLight, borderRadius: Radius.lg, paddingVertical: 14, gap: 8 },
  logoutText: { fontSize: Typography.fontSize.base, fontWeight: '700', color: Colors.danger },
  version: { textAlign: 'center', fontSize: Typography.fontSize.xs, color: Colors.gray400, marginBottom: Spacing[3] },
});
