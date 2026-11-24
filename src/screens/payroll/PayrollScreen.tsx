import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, StatusBar, ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, IconBox } from '../../design-system/tokens';
import { Card, SectionHeader, Divider } from '../../design-system/components/Card';
import { Badge } from '../../design-system/components/Badge';
import { fetchProfile } from '../../services/authService';

export default function PayrollScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSalary = async () => {
      try {
        const data = await fetchProfile();
        if (data && data.user) {
          setProfile(data.user);
        }
      } catch (err) {
        console.warn('Failed to load salary details:', err);
      } finally {
        setLoading(false);
      }
    };
    loadSalary();
  }, []);

  const salaryDetails = profile?.salaryDetails || {};
  const ctc = parseFloat(salaryDetails.ctc || '0');
  const monthlyGross = ctc > 0 ? Math.round(ctc / 12) : 0;
  const paymentMode = salaryDetails.paymentMode || 'Bank Transfer';
  const effectiveFrom = salaryDetails.effectiveFrom
    ? new Date(salaryDetails.effectiveFrom).toLocaleDateString()
    : 'N/A';

  const basicSalary = monthlyGross > 0 ? Math.round(monthlyGross * 0.5) : 0;
  const hra = monthlyGross > 0 ? Math.round(monthlyGross * 0.2) : 0;
  const specialAllowance = monthlyGross > 0 ? Math.max(0, monthlyGross - (basicSalary + hra)) : 0;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <View style={styles.header}>
        <View style={styles.headerCircle} />
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payroll & Compensation</Text>
        <Text style={styles.headerSub}>Salary structure & payslip records</Text>

        {/* Current Month / Annual CTC Card */}
        <View style={styles.salaryCard}>
          <View style={styles.salaryRow}>
            <View>
              <Text style={styles.salaryLabel}>Annual CTC</Text>
              <Text style={styles.salaryAmount}>
                {ctc > 0 ? `₹${ctc.toLocaleString()}` : 'Not Specified'}
              </Text>
            </View>
            <Badge label={profile?.status || 'Active'} variant="success" />
          </View>
          <View style={styles.salaryMeta}>
            <View style={styles.salaryMetaItem}>
              <Text style={styles.salaryMetaLabel}>Est. Monthly</Text>
              <Text style={styles.salaryMetaValue}>₹{monthlyGross.toLocaleString()}</Text>
            </View>
            <View style={styles.salaryMetaDivider} />
            <View style={styles.salaryMetaItem}>
              <Text style={styles.salaryMetaLabel}>Payment Mode</Text>
              <Text style={styles.salaryMetaValue}>{paymentMode}</Text>
            </View>
            <View style={styles.salaryMetaDivider} />
            <View style={styles.salaryMetaItem}>
              <Text style={styles.salaryMetaLabel}>Effective From</Text>
              <Text style={styles.salaryMetaValue}>{effectiveFrom}</Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={{ marginTop: 8, fontSize: Typography.fontSize.sm, color: Colors.gray500 }}>
              Loading salary details...
            </Text>
          </View>
        ) : (
          <>
            {/* Breakdown */}
            <SectionHeader title="Estimated Monthly Breakdown" />
            <Card>
              <View style={styles.breakdownHeader}>
                <Text style={styles.breakdownCol}>Component</Text>
                <Text style={styles.breakdownCol}>Estimated Amount</Text>
              </View>
              <Divider />
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Basic Salary (50%)</Text>
                <Text style={[styles.breakdownAmount, { color: Colors.success }]}>
                  ₹{basicSalary.toLocaleString()}
                </Text>
              </View>
              <Divider />
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>House Rent Allowance (HRA 20%)</Text>
                <Text style={[styles.breakdownAmount, { color: Colors.success }]}>
                  ₹{hra.toLocaleString()}
                </Text>
              </View>
              <Divider />
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Special Allowance</Text>
                <Text style={[styles.breakdownAmount, { color: Colors.success }]}>
                  ₹{specialAllowance.toLocaleString()}
                </Text>
              </View>
              <View style={styles.breakdownTotal}>
                <Text style={styles.breakdownTotalLabel}>Monthly Gross</Text>
                <Text style={styles.breakdownTotalAmount}>₹{monthlyGross.toLocaleString()}</Text>
              </View>
            </Card>

            {/* Payslip History */}
            <SectionHeader title="Payslip History" />
            <View style={styles.emptyContainer}>
              <Ionicons name="document-text-outline" size={44} color={Colors.gray300} />
              <Text style={styles.emptyTitle}>No Payslips Available</Text>
              <Text style={styles.emptySub}>
                Payslips will appear here once generated and published by HR for each payroll cycle.
              </Text>
            </View>
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  header: {
    backgroundColor: Colors.primary,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 12 : 56,
    paddingHorizontal: Spacing[4], paddingBottom: Spacing[5], overflow: 'hidden',
  },
  headerCircle: {
    position: 'absolute', width: 280, height: 280, borderRadius: 140,
    backgroundColor: 'rgba(96,165,250,0.15)', top: -80, right: -60,
  },
  backBtn: { marginBottom: 8 },
  headerTitle: { fontSize: Typography.fontSize.xl, fontWeight: '800', color: Colors.white, marginBottom: 4 },
  headerSub: { fontSize: Typography.fontSize.sm, color: 'rgba(255,255,255,0.7)', marginBottom: Spacing[4] },

  salaryCard: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: Radius.xl, padding: Spacing[4],
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  salaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  salaryLabel: { fontSize: Typography.fontSize.xs, color: 'rgba(255,255,255,0.7)', marginBottom: 4 },
  salaryAmount: { fontSize: Typography.fontSize['3xl'], fontWeight: '800', color: Colors.white },
  salaryMeta: { flexDirection: 'row' },
  salaryMetaItem: { flex: 1, alignItems: 'center' },
  salaryMetaLabel: { fontSize: Typography.fontSize.xs, color: 'rgba(255,255,255,0.6)', marginBottom: 2 },
  salaryMetaValue: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.white },
  salaryMetaDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },

  scroll: { flex: 1 },
  scrollContent: { padding: Spacing[4] },

  breakdownHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  breakdownCol: { fontSize: Typography.fontSize.xs, fontWeight: '700', color: Colors.gray500, textTransform: 'uppercase', letterSpacing: 0.5 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  breakdownLabel: { fontSize: Typography.fontSize.sm, color: Colors.gray700 },
  breakdownAmount: { fontSize: Typography.fontSize.sm, fontWeight: '700' },
  breakdownTotal: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginTop: 12, paddingTop: 12,
    borderTopWidth: 2, borderTopColor: Colors.primary + '30',
  },
  breakdownTotalLabel: { fontSize: Typography.fontSize.base, fontWeight: '700', color: Colors.gray900 },
  breakdownTotalAmount: { fontSize: Typography.fontSize.base, fontWeight: '800', color: Colors.primary },

  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
    backgroundColor: Colors.gray50,
    borderRadius: Radius.lg,
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.gray100,
  },
  emptyTitle: {
    fontSize: Typography.fontSize.base,
    fontWeight: '700',
    color: Colors.gray700,
    marginTop: 12,
    marginBottom: 4,
  },
  emptySub: {
    fontSize: Typography.fontSize.xs,
    color: Colors.gray500,
    textAlign: 'center',
    lineHeight: 18,
  },
});
