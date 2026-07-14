import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Platform, StatusBar, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, Shadow } from '../../design-system/tokens';
import { ScreenHeader } from '../../design-system/components/Header';
import { fetchProfile } from '../../services/authService';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export default function EmploymentScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadProfileData = async () => {
      try {
        const data = await fetchProfile();
        if (data && data.user) {
          setProfile(data.user);
        }
      } catch (err: any) {
        console.warn('Failed to load profile from API:', err);
        setError('Failed to load profile data.');
      } finally {
        setLoading(false);
      }
    };
    loadProfileData();
  }, []);

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '-';
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading Employment Details...</Text>
      </View>
    );
  }

  const details = profile?.employmentDetails || {};
  
  // Format variables
  const employeeId = profile?.employeeId || details.employeeId || '-';
  
  const rawJoinDate = details.dateOfJoining || details.joiningDate || profile?.dateOfJoining || '';
  const dateOfJoining = formatDateDisplay(rawJoinDate);
  
  const department = details.department?.name || profile?.department || '-';
  const designation = details.designation?.name || profile?.designation || '-';
  const employmentType = details.employmentType || '-';
  const workLocation = details.workLocation || '-';
  
  const manager = details.reportingManager && typeof details.reportingManager === 'object'
    ? details.reportingManager.name
    : details.reportingManager || '-';
    
  const probationPeriod = details.probationPeriod || '-';
  
  const confirmationDate = formatDateDisplay(details.confirmationDate || '');
  
  const shift = details.shift && typeof details.shift === 'object'
    ? details.shift.name
    : details.shift || '-';
    
  const weekOff = Array.isArray(details.weekOff)
    ? details.weekOff.join(', ')
    : details.weekOff || '-';

  const rows: { icon: IoniconName; label: string; value: string }[] = [
    { icon: 'id-card-outline', label: 'Employee ID', value: employeeId },
    { icon: 'calendar-outline', label: 'Date of Joining', value: dateOfJoining },
    { icon: 'business-outline', label: 'Department', value: department },
    { icon: 'briefcase-outline', label: 'Designation', value: designation },
    { icon: 'time-outline', label: 'Employment Type', value: employmentType },
    { icon: 'location-outline', label: 'Work Location', value: workLocation },
    { icon: 'person-outline', label: 'Reporting Manager', value: manager },
    { icon: 'hourglass-outline', label: 'Probation Period', value: probationPeriod },
    { icon: 'checkmark-circle-outline', label: 'Confirmation Date', value: confirmationDate },
    { icon: 'alarm-outline', label: 'Shift Details', value: shift },
    { icon: 'today-outline', label: 'Week Off', value: weekOff },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.canGoBack() ? router.back() : router.replace('/profile')}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color={Colors.gray900} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Employment Details</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, Shadow.sm]}>
          {rows.map((row, index) => (
            <View key={row.label}>
              <View style={styles.row}>
                <View style={styles.iconContainer}>
                  <Ionicons name={row.icon} size={18} color={Colors.primary} />
                </View>
                <View style={styles.info}>
                  <Text style={styles.label}>{row.label}</Text>
                  <Text style={styles.value}>{row.value}</Text>
                </View>
              </View>
              {index < rows.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFBFD',
  },
  header: {
    backgroundColor: Colors.white,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 12 : 56,
    paddingHorizontal: Spacing[4],
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#E8EDF2',
    ...Shadow.sm,
  },
  backBtn: {
    marginRight: Spacing[3],
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.gray900,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: Spacing[4],
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFBFD',
  },
  loadingText: {
    marginTop: 12,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray500,
    fontWeight: '500',
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing[4],
    borderWidth: 1,
    borderColor: '#E8EDF2',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing[3],
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(66, 141, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing[3],
  },
  info: {
    flex: 1,
  },
  label: {
    fontSize: Typography.fontSize.xs,
    color: Colors.gray500,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  value: {
    fontSize: Typography.fontSize.sm,
    color: Colors.gray900,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#E8EDF2',
    marginLeft: Spacing[3] + 36,
  },
});
