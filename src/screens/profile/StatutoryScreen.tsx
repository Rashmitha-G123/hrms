import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Platform, StatusBar, TouchableOpacity, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, Shadow } from '../../design-system/tokens';
import { fetchProfile } from '../../services/authService';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export default function StatutoryScreen() {
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

  const handleOpenDocument = (url: string) => {
    if (!url || url === '-') return;
    try {
      // Ensure the URL is valid
      const targetUrl = url.startsWith('http') ? url : `https://${url}`;
      Linking.openURL(targetUrl);
    } catch (e) {
      console.warn('Failed to open document URL:', url, e);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading Statutory Compliance...</Text>
      </View>
    );
  }

  console.log('[DEBUG] PROFILE USER KEYS:', Object.keys(profile || {}));
  console.log('[DEBUG] EMPLOYEE PERSONAL KEYS:', Object.keys(profile?.employeePersonal || {}));
  console.log('[DEBUG] EMPLOYMENT DETAILS KEYS:', Object.keys(profile?.employmentDetails || {}));

  const statutory = profile?.statutoryCompliance || profile?.statutoryDetails || profile?.employeeStatutory || profile?.statutory || profile?.compliance || profile?.employeePersonal || {};

  const pfNumber = statutory.pfNumber || statutory.pf || profile?.pfNumber || '-';
  const esiNumber = statutory.esiNumber || statutory.esi || statutory.esicNumber || statutory.esic || profile?.esiNumber || profile?.esicNumber || '-';
  const panNumber = statutory.panNumber || statutory.pan || profile?.panNumber || '-';
  const aadhaarNumber = statutory.aadhaarNumber || statutory.aadhaar || statutory.aadhaarNumber || statutory.aadharNumber || statutory.aadhar || profile?.aadhaarNumber || profile?.aadharNumber || '-';
  const previousEmployment = statutory.previousEmployment || statutory.prevEmployment || profile?.previousEmployment || '-';
  const incomeTaxDeclaration = statutory.incomeTaxDeclaration || statutory.itDeclaration || statutory.taxDeclaration || profile?.incomeTaxDeclaration || '';

  const rows: { icon: IoniconName; label: string; value: string }[] = [
    { icon: 'shield-outline', label: 'PF Number', value: pfNumber },
    { icon: 'shield-checkmark-outline', label: 'ESI Number', value: esiNumber },
    { icon: 'card-outline', label: 'PAN Number', value: panNumber },
    { icon: 'finger-print-outline', label: 'Aadhar Number', value: aadhaarNumber },
    { icon: 'document-text-outline', label: 'Previous Employment', value: previousEmployment },
    { icon: 'document-attach-outline', label: 'Income Tax Declaration', value: incomeTaxDeclaration },
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
        <Text style={styles.headerTitle}>Statutory Compliance</Text>
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
                  {row.label === 'Income Tax Declaration' ? (
                    row.value && row.value !== '-' && row.value !== '' ? (
                      <TouchableOpacity
                        onPress={() => handleOpenDocument(row.value)}
                        style={styles.linkBtn}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.linkText}>View Document</Text>
                        <Ionicons name="open-outline" size={14} color="#3E8AFF" style={styles.linkIcon} />
                      </TouchableOpacity>
                    ) : (
                      <Text style={styles.value}>-</Text>
                    )
                  ) : (
                    <Text style={styles.value}>{row.value}</Text>
                  )}
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
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  linkText: {
    fontSize: Typography.fontSize.sm,
    color: '#3E8AFF',
    fontWeight: '600',
  },
  linkIcon: {
    marginLeft: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#E8EDF2',
    marginLeft: Spacing[3] + 40,
  },
});
