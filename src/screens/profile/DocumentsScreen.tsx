import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Platform, StatusBar, TouchableOpacity, Linking, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, Shadow } from '../../design-system/tokens';
import { fetchProfile } from '../../services/authService';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export default function DocumentsScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dimensions, setDimensions] = useState({ width: 400 });

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

    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });
    setDimensions(Dimensions.get('window'));
    return () => subscription.remove();
  }, []);

  const handleOpenDocument = (url: string) => {
    if (!url || url === '-') return;
    try {
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
        <Text style={styles.loadingText}>Loading Documents...</Text>
      </View>
    );
  }

  const docs = profile?.documents || {};

  const docList = [
    {
      key: 'panCard',
      label: 'PAN CARD',
      icon: 'card-outline',
      url: docs.panCard || docs.pan || '',
    },
    {
      key: 'aadhaarCard',
      label: 'AADHAAR CARD',
      icon: 'person-outline',
      url: docs.aadhaarCard || docs.aadharCard || docs.aadhaar || docs.aadhar || '',
    },
    {
      key: 'passportPhoto',
      label: 'PASSPORT PHOTO',
      icon: 'image-outline',
      url: docs.passportPhoto || docs.photo || docs.passport || '',
    },
    {
      key: 'bankPassbook',
      label: 'BANK PASSBOOK',
      icon: 'card-outline',
      url: docs.bankPassbook || docs.passbook || '',
    },
    {
      key: 'educationCertificates',
      label: 'EDUCATION CERTIFICATES',
      icon: 'book-outline',
      url: docs.educationCertificates || docs.education || docs.certificates || '',
    },
    {
      key: 'experienceLetter',
      label: 'EXPERIENCE LETTER',
      icon: 'briefcase-outline',
      url: docs.experienceLetter || docs.experience || '',
    },
    {
      key: 'addressProof',
      label: 'PROOF OF ADDRESS',
      icon: 'location-outline',
      url: docs.addressProof || docs.proofOfAddress || docs.address || '',
    },
    {
      key: 'dobProof',
      label: 'PROOF OF DATE OF BIRTH',
      icon: 'calendar-outline',
      url: docs.dobProof || docs.proofOfDob || docs.proofOfDateOfBirth || docs.dateOfBirthProof || '',
    },
    {
      key: 'offerLetter',
      label: 'OFFER LETTER',
      icon: 'mail-outline',
      url: docs.offerLetter || '',
    },
  ];

  const isMobile = dimensions.width < 768;
  const itemWidth = isMobile ? '100%' : dimensions.width > 1024 ? '31%' : '48%';

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
        <Text style={styles.headerTitle}>Documents Vault</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.grid}>
          {docList.map((doc) => {
            const isUploaded = !!doc.url && doc.url !== '-' && doc.url !== '';
            return (
              <View key={doc.key} style={[styles.card, { width: itemWidth }, Shadow.sm]}>
                <View style={styles.cardHeader}>
                  <View style={[
                    styles.iconContainer,
                    { backgroundColor: isUploaded ? '#ECF3FF' : 'rgba(142, 142, 147, 0.08)' }
                  ]}>
                    <Ionicons name={doc.icon as any} size={18} color={isUploaded ? '#2B7EFF' : '#8E8E93'} />
                  </View>

                  <View style={styles.docInfo}>
                    <Text style={styles.docLabel}>{doc.label}</Text>
                    <View style={styles.statusRow}>
                      <View style={[styles.statusDot, { backgroundColor: isUploaded ? '#34C759' : '#8E8E93' }]} />
                      <Text style={[styles.statusText, { color: isUploaded ? '#34C759' : '#8E8E93' }]}>
                        {isUploaded ? 'Verified & Uploaded' : 'Not Uploaded'}
                      </Text>
                    </View>
                  </View>

                  {isUploaded && (
                    <TouchableOpacity
                      onPress={() => handleOpenDocument(doc.url)}
                      style={styles.openBtn}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="open-outline" size={16} color="#8E8E93" />
                    </TouchableOpacity>
                  )}
                </View>

                {!isUploaded && (
                  <View style={styles.helpTextRow}>
                    <Ionicons name="information-circle-outline" size={14} color="#8E8E93" style={styles.infoIcon} />
                    <Text style={styles.helpText}>Please contact HR to upload this document</Text>
                  </View>
                )}
              </View>
            );
          })}
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'flex-start',
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing[4],
    borderWidth: 1,
    borderColor: '#E8EDF2',
    justifyContent: 'center',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing[3],
  },
  docInfo: {
    flex: 1,
  },
  docLabel: {
    fontSize: Typography.fontSize.xs,
    color: Colors.gray900,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: Typography.fontSize.xs - 1,
    fontWeight: '600',
  },
  openBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    borderWidth: 1.2,
    borderColor: '#E4E4E7',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    marginLeft: 8,
  },
  helpTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F4F4F5',
  },
  infoIcon: {
    marginRight: 6,
  },
  helpText: {
    fontSize: Typography.fontSize.xs - 1,
    color: Colors.gray500,
    fontStyle: 'italic',
    fontWeight: '500',
  },
});
