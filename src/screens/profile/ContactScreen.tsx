import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  ActivityIndicator, Platform, StatusBar, KeyboardAvoidingView, TouchableOpacity
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, Shadow } from '../../design-system/tokens';
import { Button } from '../../design-system/components/Button';
import { Input } from '../../design-system/components/Input';
import { ScreenHeader } from '../../design-system/components/Header';
import { fetchProfile, updateProfileApi } from '../../services/authService';
import { currentUser } from '../../data/mockData';

export default function ContactScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form State
  const [contactNumber, setContactNumber] = useState('');
  const [currentAddress, setCurrentAddress] = useState('');

  useEffect(() => {
    const loadProfileData = async () => {
      try {
        const data = await fetchProfile();
        if (data && data.user) {
          setProfile(data.user);
          setContactNumber(data.user.employeePersonal?.contactNumber || '');
          setCurrentAddress(data.user.employeePersonal?.currentAddress || '');
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

  const handleSave = async () => {
    setError('');
    setSuccess('');

    if (!contactNumber.trim()) {
      setError('Contact number is required.');
      return;
    }

    setSaving(true);

    try {
      const payload = {
        employeePersonal: {
          contactNumber: contactNumber.trim(),
          currentAddress: currentAddress.trim(),
        },
      };

      const response = await updateProfileApi(payload);
      if (response.success) {
        setSuccess(response.message || 'Contact details updated successfully');
        setTimeout(() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/profile');
          }
        }, 1500);
      } else {
        setError('Failed to update contact details');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred while saving.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading Contact Details...</Text>
      </View>
    );
  }

  const personal = profile?.employeePersonal || {};
  const emailAddress = personal.emailAddress || profile?.email || currentUser.email;
  const permanentAddress = personal.permanentAddress || 'N/A';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.canGoBack() ? router.back() : router.replace('/profile')}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color={Colors.gray900} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Contact Information</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {!!error && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={18} color={Colors.dangerDark} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {!!success && (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle-outline" size={18} color={Colors.successDark} />
            <Text style={styles.successText}>{success}</Text>
          </View>
        )}

        {/* Read-Only Info Block */}
        <View style={[styles.card, Shadow.sm]}>
          <Text style={styles.sectionTitle}>Official Contact Info</Text>

          <View style={styles.readOnlyRow}>
            <Text style={styles.readOnlyLabel}>Email Address</Text>
            <Text style={styles.readOnlyValue}>{emailAddress}</Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.readOnlyRow}>
            <Text style={styles.readOnlyLabel}>Permanent Address</Text>
            <Text style={styles.readOnlyValue} numberOfLines={2}>{permanentAddress}</Text>
          </View>
        </View>

        {/* Editable Form */}
        <View style={[styles.card, Shadow.sm]}>
          <Text style={styles.sectionTitle}>Update Information</Text>
          <Text style={styles.sectionSub}>Edit your active contact number and current residential address</Text>

          <Input
            label="Contact Number"
            value={contactNumber}
            onChangeText={setContactNumber}
            placeholder="e.g. +1234567890"
            keyboardType="phone-pad"
            leftIcon={<Ionicons name="call-outline" size={18} color={'#A4A4AD'} />}
          />

          <Input
            label="Current Address"
            value={currentAddress}
            onChangeText={setCurrentAddress}
            placeholder="e.g. 789 New Apt, New York"
            multiline
            numberOfLines={3}
            leftIcon={<Ionicons name="location-outline" size={18} color={'#A4A4AD'} />}
          />
        </View>

        {/* Save Button */}
        <Button
          title={saving ? 'Saving changes...' : 'Save Changes'}
          onPress={handleSave}
          loading={saving}
          disabled={saving}
          size="lg"
          fullWidth
          style={styles.saveBtn}
        />
      </ScrollView>
    </KeyboardAvoidingView>
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
    marginBottom: Spacing[4],
    borderWidth: 1,
    borderColor: '#E8EDF2',
  },
  sectionTitle: {
    fontSize: Typography.fontSize.base,
    fontWeight: '700',
    color: Colors.gray900,
    marginBottom: Spacing[3],
  },
  sectionSub: {
    fontSize: Typography.fontSize.xs,
    color: Colors.gray500,
    marginBottom: Spacing[4],
    marginTop: -4,
  },
  readOnlyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing[3],
  },
  readOnlyLabel: {
    fontSize: Typography.fontSize.sm,
    color: Colors.gray500,
    fontWeight: '500',
  },
  readOnlyValue: {
    fontSize: Typography.fontSize.sm,
    color: Colors.gray900,
    fontWeight: '600',
    maxWidth: '70%',
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F3F5',
  },
  saveBtn: {
    marginTop: Spacing[2],
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.dangerLight,
    borderRadius: Radius.md,
    padding: Spacing[3],
    marginBottom: Spacing[4],
    borderWidth: 1,
    borderColor: Colors.danger,
  },
  errorText: {
    flex: 1,
    fontSize: Typography.fontSize.xs,
    color: Colors.dangerDark,
    lineHeight: 18,
    fontWeight: '500',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.successLight,
    borderRadius: Radius.md,
    padding: Spacing[3],
    marginBottom: Spacing[4],
    borderWidth: 1,
    borderColor: Colors.success,
  },
  successText: {
    flex: 1,
    fontSize: Typography.fontSize.xs,
    color: Colors.successDark,
    lineHeight: 18,
    fontWeight: '500',
  },
});
