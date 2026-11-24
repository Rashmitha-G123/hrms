import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Platform, StatusBar, KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, Shadow } from '../../design-system/tokens';
import { Button } from '../../design-system/components/Button';
import { Input } from '../../design-system/components/Input';
import { ScreenHeader } from '../../design-system/components/Header';
import { fetchProfile, updateProfileApi } from '../../services/authService';

const MARITAL_STATUS_OPTIONS = ['Single', 'Married', 'Divorced', 'Widowed'];

const formatDateDisplay = (dateStr: string) => {
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

const parseDateToIso = (dateStr: string) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  } catch (e) {
    // fallback
  }
  return dateStr;
};

export default function PersonalScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form States
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('Male');
  const [maritalStatus, setMaritalStatus] = useState('Single');
  const [fatherOrSpouseName, setFatherSpouseName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [currentAddress, setCurrentAddress] = useState('');
  const [permanentAddress, setPermanentAddress] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactNumber, setEmergencyContactNumber] = useState('');

  useEffect(() => {
    const loadProfileData = async () => {
      try {
        const data = await fetchProfile();
        if (data && data.user) {
          setProfile(data.user);
          const personal = data.user.employeePersonal || {};
          setFullName(personal.fullName || data.user.name || '');
          setDateOfBirth(formatDateDisplay(personal.dateOfBirth || ''));
          setGender(personal.gender || 'Male');
          setMaritalStatus(personal.maritalStatus || 'Single');
          setFatherSpouseName(personal.fatherSpouseName || personal.fatherOrSpouseName || '');
          setContactNumber(personal.contactNumber || data.user.phone || '');
          setEmailAddress(personal.emailAddress || data.user.email || '');
          setCurrentAddress(personal.currentAddress || '');
          setPermanentAddress(personal.permanentAddress || '');

          // Robust key mappings for Emergency Details
          const emergencyName = personal.emergencyContactName ||
            personal.emergencyContact?.name ||
            personal.emergencyName ||
            '';
          const emergencyPhone = personal.emergencyContactNumber ||
            personal.emergencyContactNo ||
            personal.emergencyContactPhone ||
            personal.emergencyContact?.number ||
            personal.emergencyContact?.phone ||
            personal.emergencyPhone ||
            '';
          setEmergencyContactName(emergencyName);
          setEmergencyContactNumber(emergencyPhone);
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
    setSaving(true);

    try {
      const payload = {
        employeePersonal: {
          fullName: fullName.trim(),
          dateOfBirth: parseDateToIso(dateOfBirth.trim()),
          gender,
          maritalStatus,
          fatherSpouseName: fatherOrSpouseName.trim(),
          fatherOrSpouseName: fatherOrSpouseName.trim(),
          contactNumber: contactNumber.trim(),
          emailAddress: emailAddress.trim(),
          currentAddress: currentAddress.trim(),
          permanentAddress: permanentAddress.trim(),
          emergencyContactName: emergencyContactName.trim(),
          emergencyContactNumber: emergencyContactNumber.trim(),
          emergencyContactNo: emergencyContactNumber.trim(),
          emergencyContactPhone: emergencyContactNumber.trim(),
          emergencyContact: {
            name: emergencyContactName.trim(),
            number: emergencyContactNumber.trim(),
            phone: emergencyContactNumber.trim(),
          }
        },
      };

      const response = await updateProfileApi(payload);
      if (response.success) {
        setSuccess(response.message || 'Profile updated successfully');
        setTimeout(() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/profile');
          }
        }, 1500);
      } else {
        setError('Failed to update profile');
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
        <Text style={styles.loadingText}>Loading Personal Details...</Text>
      </View>
    );
  }

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
        <Text style={styles.headerTitle}>Personal Information</Text>
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

        {/* Identity Details Card */}
        <View style={[styles.card, Shadow.sm]}>
          <Text style={styles.sectionTitle}>Identity Details</Text>

          <Input
            label="Full Name"
            value={fullName}
            onChangeText={setFullName}
            placeholder="Enter full name"
          />

          <Input
            label="Date of Birth"
            value={dateOfBirth}
            onChangeText={setDateOfBirth}
            placeholder="YYYY-MM-DD"
          />

          <Input
            label="Gender"
            value={gender}
            onChangeText={setGender}
            placeholder="Enter gender"
          />

          <Input
            label="Father/Spouse Name"
            value={fatherOrSpouseName}
            onChangeText={setFatherSpouseName}
            placeholder="Enter father or spouse name"
          />
        </View>

        {/* Marital Status Card */}
        <View style={[styles.card, Shadow.sm]}>
          <Text style={styles.sectionTitle}>Marital Status</Text>
          <Text style={styles.sectionSub}>Select your current marital status</Text>

          <View style={styles.optionsGrid}>
            {MARITAL_STATUS_OPTIONS.map((status) => {
              const isSelected = maritalStatus === status;
              return (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.optionBtn,
                    isSelected && styles.optionBtnActive,
                  ]}
                  onPress={() => setMaritalStatus(status)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                    size={16}
                    color={isSelected ? Colors.primary : Colors.gray500}
                    style={styles.optionIcon}
                  />
                  <Text style={[styles.optionText, isSelected && styles.optionTextActive]}>
                    {status}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Contact Information Card */}
        <View style={[styles.card, Shadow.sm]}>
          <Text style={styles.sectionTitle}>Contact Information</Text>

          <Input
            label="Contact Number"
            value={contactNumber}
            onChangeText={setContactNumber}
            placeholder="Enter contact number"
            keyboardType="phone-pad"
          />

          <Input
            label="Email Address"
            value={emailAddress}
            onChangeText={setEmailAddress}
            placeholder="Enter email address"
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        {/* Address Details Card */}
        <View style={[styles.card, Shadow.sm]}>
          <Text style={styles.sectionTitle}>Address Details</Text>

          <Input
            label="Current Address"
            value={currentAddress}
            onChangeText={setCurrentAddress}
            placeholder="Enter current address"
            multiline
            numberOfLines={3}
          />

          <Input
            label="Permanent Address"
            value={permanentAddress}
            onChangeText={setPermanentAddress}
            placeholder="Enter permanent address"
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Emergency Contact Card */}
        <View style={[styles.card, Shadow.sm]}>
          <Text style={styles.sectionTitle}>Emergency Contact Information</Text>

          <Input
            label="Emergency Contact Name"
            value={emergencyContactName}
            onChangeText={setEmergencyContactName}
            placeholder="Enter emergency contact name"
          />

          <Input
            label="Emergency Contact Number"
            value={emergencyContactNumber}
            onChangeText={setEmergencyContactNumber}
            placeholder="Enter emergency contact number"
            keyboardType="phone-pad"
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
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F3F5',
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48%',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: '#E4E4E7',
    backgroundColor: '#F9FAFB',
  },
  optionBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(77, 168, 218, 0.08)',
  },
  optionIcon: {
    marginRight: 8,
  },
  optionText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '600',
    color: Colors.gray700,
  },
  optionTextActive: {
    color: Colors.primary,
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
