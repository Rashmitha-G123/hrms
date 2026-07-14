import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Platform, StatusBar, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, Shadow } from '../../design-system/tokens';
import { fetchProfile } from '../../services/authService';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export default function BankDetailsScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAccountNo, setShowAccountNo] = useState(false);

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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading Bank Details...</Text>
      </View>
    );
  }

  console.log('[DEBUG] PROFILE USER KEYS:', Object.keys(profile || {}));
  console.log('[DEBUG] EMPLOYEE PERSONAL KEYS:', Object.keys(profile?.employeePersonal || {}));
  console.log('[DEBUG] EMPLOYMENT DETAILS KEYS:', Object.keys(profile?.employmentDetails || {}));

  const bank = profile?.bankDetails || profile?.salaryDetails || profile?.employeeBank || profile?.bankAccount || profile?.employeePersonal || {};

  const bankName = bank.bankName || bank.bank || profile?.bankName || '-';
  const accountHolderName = bank.accountHolderName || bank.holderName || bank.name || profile?.accountHolderName || profile?.name || '-';
  const rawAccountNumber = bank.accountNumber || bank.accountNo || profile?.accountNumber || '';
  const ifscCode = bank.ifscCode || bank.ifsc || profile?.ifscCode || '-';
  const branchName = bank.branchName || bank.branch || profile?.branchName || '-';

  const getMaskedAccountNo = (accNo: string) => {
    if (!accNo) return '-';
    if (showAccountNo) return accNo;
    if (accNo.length <= 4) return accNo;
    return 'X'.repeat(accNo.length - 4) + accNo.slice(-4);
  };

  const rows: { icon: IoniconName; label: string; value: string }[] = [
    { icon: 'business-outline', label: 'Bank Name', value: bankName },
    { icon: 'person-outline', label: 'Account Holder Name', value: accountHolderName },
    { icon: 'card-outline', label: 'Account Number', value: getMaskedAccountNo(rawAccountNumber) },
    { icon: 'keypad-outline', label: 'IFSC Code', value: ifscCode },
    { icon: 'location-outline', label: 'Branch Name', value: branchName },
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
        <Text style={styles.headerTitle}>Bank Details</Text>
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
                  <View style={styles.valueRow}>
                    <Text style={styles.value}>{row.value}</Text>
                    {row.label === 'Account Number' && rawAccountNumber !== '' && (
                      <TouchableOpacity
                        onPress={() => setShowAccountNo(!showAccountNo)}
                        style={styles.toggleBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons
                          name={showAccountNo ? 'eye-off-outline' : 'eye-outline'}
                          size={18}
                          color={Colors.gray500}
                        />
                      </TouchableOpacity>
                    )}
                  </View>
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
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  value: {
    fontSize: Typography.fontSize.sm,
    color: Colors.gray900,
    fontWeight: '600',
  },
  toggleBtn: {
    paddingLeft: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#E8EDF2',
    marginLeft: Spacing[3] + 40,
  },
});
