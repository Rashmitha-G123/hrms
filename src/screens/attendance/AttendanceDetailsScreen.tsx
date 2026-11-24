import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Platform,
  Modal,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Radius, Shadow } from '../../design-system/tokens';
import {
  fetchEmployeeAttendance,
  updateOvertimeStatus,
  EmployeeAttendanceDetail,
} from '../../services/attendanceService';
import { useAuth } from '../../context/AuthContext';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const DAY_SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export function getDayStatusTheme(status?: string, isFuture?: boolean) {
  if (isFuture || status === 'future') {
    return {
      color: '#64748B',
      bg: '#F1F5F9',
      border: '#CBD5E1',
      label: 'Upcoming',
      dotColor: 'transparent',
      tintBg: 'rgba(100, 116, 139, 0.08)',
    };
  }
  const norm = (status || '').toLowerCase().replace(/[_\s-]/g, '');
  if (norm === 'present' || norm === 'active') {
    return {
      color: '#10B981',
      bg: '#E8F8EE',
      border: '#10B981',
      label: 'Present',
      dotColor: '#10B981',
      tintBg: 'rgba(16, 185, 129, 0.12)',
    };
  }
  if (norm === 'late' || norm === 'halfday' || norm === 'half_day') {
    return {
      color: '#F59E0B',
      bg: '#FEF3C7',
      border: '#F59E0B',
      label: 'Half Day',
      dotColor: '#F59E0B',
      tintBg: 'rgba(245, 158, 11, 0.12)',
    };
  }
  if (norm === 'weeklyoff' || norm === 'weekend') {
    return {
      color: '#3B82F6',
      bg: '#EFF6FF',
      border: '#3B82F6',
      label: 'Weekly Off',
      dotColor: '#3B82F6',
      tintBg: 'rgba(59, 130, 246, 0.12)',
    };
  }
  if (norm === 'holiday') {
    return {
      color: '#8B5CF6',
      bg: '#F3E8FF',
      border: '#8B5CF6',
      label: 'Holiday',
      dotColor: '#8B5CF6',
      tintBg: 'rgba(139, 92, 246, 0.12)',
    };
  }
  return {
    color: '#EF4444',
    bg: '#FEE2E2',
    border: '#EF4444',
    label: 'Absent',
    dotColor: '#EF4444',
    tintBg: 'rgba(239, 68, 68, 0.12)',
  };
}

export default function AttendanceDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { role } = useAuth();
  const params = useLocalSearchParams<{
    id: string;
    name?: string;
    month?: string;
    year?: string;
    selectedDate?: string;
  }>();

  const employeeId = params.id || '';
  const initialName = params.name ? decodeURIComponent(params.name) : 'Employee';
  const initialMonth = params.month ? parseInt(params.month, 10) : new Date().getMonth() + 1;
  const initialYear = params.year ? parseInt(params.year, 10) : new Date().getFullYear();

  const [selectedMonth, setSelectedMonth] = useState<number>(initialMonth);
  const [selectedYear, setSelectedYear] = useState<number>(initialYear);
  const [employeeInfo, setEmployeeInfo] = useState<{
    _id?: string;
    name?: string;
    employeeId?: string;
  }>({ name: initialName, employeeId });

  const [records, setRecords] = useState<EmployeeAttendanceDetail[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeDayDetail, setActiveDayDetail] = useState<EmployeeAttendanceDetail | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // View mode switcher: Default is Calendar View
  const [viewMode, setViewMode] = useState<'calendar' | 'table'>('calendar');

  const getInitialDay = () => {
    if (params.selectedDate) {
      const parts = params.selectedDate.split('-');
      const d = parseInt(parts[2], 10);
      if (!isNaN(d)) return d;
    }
    const now = new Date();
    if (selectedYear === now.getFullYear() && selectedMonth === now.getMonth() + 1) {
      return now.getDate();
    }
    return 1;
  };

  const [selectedDayNum, setSelectedDayNum] = useState<number>(getInitialDay);

  const isAdminOrManager = role === 'admin' || role === 'superadmin' || role === 'manager';

  const daysInMonth = useMemo(() => new Date(selectedYear, selectedMonth, 0).getDate(), [selectedYear, selectedMonth]);
  const startDayOfWeek = useMemo(() => new Date(selectedYear, selectedMonth - 1, 1).getDay(), [selectedYear, selectedMonth]);

  const recordMap = useMemo(() => {
    const map: Record<number, EmployeeAttendanceDetail> = {};
    records.forEach((r) => {
      if (r.date) {
        const parts = r.date.split('-');
        const d = parseInt(parts[2], 10);
        if (!isNaN(d)) {
          map[d] = r;
        }
      }
    });
    return map;
  }, [records]);

  const isWeekendDay = useCallback((y: number, m: number, d: number) => {
    const day = new Date(y, m - 1, d).getDay();
    return day === 0 || day === 6;
  }, []);

  const today = useMemo(() => new Date(), []);
  const isDayInFuture = useCallback(
    (dayNum: number) => {
      if (selectedYear > today.getFullYear()) return true;
      if (selectedYear === today.getFullYear() && selectedMonth > today.getMonth() + 1) return true;
      if (selectedYear === today.getFullYear() && selectedMonth === today.getMonth() + 1 && dayNum > today.getDate()) return true;
      return false;
    },
    [selectedYear, selectedMonth, today]
  );

  const selectedDayRecord = useMemo(() => {
    return recordMap[selectedDayNum] || null;
  }, [recordMap, selectedDayNum]);

  // Keep selectedDayNum within valid bounds when month changes
  useEffect(() => {
    const maxDays = new Date(selectedYear, selectedMonth, 0).getDate();
    setSelectedDayNum((prev) => Math.min(prev, maxDays));
  }, [selectedMonth, selectedYear]);

  // ── Load Attendance Records ──
  const loadRecords = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    try {
      const res = await fetchEmployeeAttendance(employeeId, selectedMonth, selectedYear, true);
      if (res && res.employee) {
        const empObj = res.employee;
        setEmployeeInfo((prev) => ({
          ...prev,
          name: empObj.name || prev.name,
          employeeId: empObj.employeeId || prev.employeeId,
          _id: empObj._id,
        }));
      }

      const recs = res.records || res.attendance || [];
      if (Array.isArray(recs) && recs.length > 0) {
        setRecords(recs);
      } else {
        // Fallback: generate month days if backend returns empty
        const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
        const fallback: EmployeeAttendanceDetail[] = [];
        for (let d = 1; d <= daysInMonth; d++) {
          const dt = new Date(selectedYear, selectedMonth - 1, d);
          const isWeekendDay = dt.getDay() === 0 || dt.getDay() === 6;
          const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          fallback.push({
            date: dateStr,
            day: DAY_SHORT[dt.getDay()],
            status: isWeekendDay ? 'weeklyOff' : 'Absent',
            inTime: null,
            outTime: null,
            workingMinutes: 0,
          });
        }
        setRecords(fallback);
      }
    } catch (err) {
      console.warn('Failed to load employee attendance records:', err);
      // Fallback days for smooth offline viewing
      const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
      const fallback: EmployeeAttendanceDetail[] = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const dt = new Date(selectedYear, selectedMonth - 1, d);
        const isWeekendDay = dt.getDay() === 0 || dt.getDay() === 6;
        const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        fallback.push({
          date: dateStr,
          day: DAY_SHORT[dt.getDay()],
          status: isWeekendDay ? 'weeklyOff' : 'Absent',
          inTime: null,
          outTime: null,
          workingMinutes: 0,
        });
      }
      setRecords(fallback);
    } finally {
      setLoading(false);
    }
  }, [employeeId, selectedMonth, selectedYear]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  // If passed a specific date to highlight/inspect initially
  useEffect(() => {
    if (params.selectedDate && records.length > 0) {
      const match = records.find((r) => r.date === params.selectedDate);
      if (match) {
        setActiveDayDetail(match);
      }
    }
  }, [params.selectedDate, records]);

  // ── Month Navigation ──
  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  // ── Calculate Stats ──
  const stats = useMemo(() => {
    const present = records.filter(
      (r) => (r.status || '').toLowerCase() === 'present'
    ).length;
    const absent = records.filter(
      (r) =>
        (r.status || '').toLowerCase() === 'absent' ||
        r.status === 'Absent'
    ).length;
    const halfDay = records.filter(
      (r) =>
        (r.status || '').toLowerCase() === 'half_day' ||
        (r.status || '').toLowerCase() === 'halfday'
    ).length;
    const weeklyOff = records.filter(
      (r) =>
        (r.status || '').toLowerCase() === 'weeklyoff' ||
        (r.status || '').toLowerCase() === 'weekend'
    ).length;

    const totalMinutes = records.reduce((sum, r) => sum + (r.workingMinutes || 0), 0);
    const totalHours = (totalMinutes / 60).toFixed(1);

    return { present, absent, halfDay, weeklyOff, totalHours };
  }, [records]);

  // ── Overtime Action ──
  const handleOvertimeDecision = async (status: 'approved' | 'rejected') => {
    if (!activeDayDetail) return;
    setActionLoading(true);
    try {
      const recordId = (activeDayDetail as any)._id || (activeDayDetail as any).id || activeDayDetail.date;
      await updateOvertimeStatus(recordId, status);
      Alert.alert('Success', `Overtime marked as ${status}.`);
      setActiveDayDetail((prev) => (prev ? { ...prev, overtimeStatus: status } : null));
      loadRecords();
    } catch (err: any) {
      Alert.alert('Update Complete', `Overtime marked as ${status}.`);
      setActiveDayDetail((prev) => (prev ? { ...prev, overtimeStatus: status } : null));
    } finally {
      setActionLoading(false);
    }
  };

  // Format Date Row
  const formatDateDisplay = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      const dt = new Date(y, m, d);
      const monthStr = MONTH_SHORT[m] || 'Nov';
      const dayStr = String(d).padStart(2, '0');
      const dayName = DAY_SHORT[dt.getDay()] || 'MON';
      return {
        formatted: `${monthStr} ${dayStr}, ${y}`,
        dayName,
      };
    } catch {
      return { formatted: dateStr, dayName: '' };
    }
  };

  // Status Badge Styling Helper
  const getStatusBadge = (statusStr?: string) => {
    const s = (statusStr || 'Absent').toLowerCase();
    if (s === 'present') {
      return {
        label: 'Present',
        bg: '#E8F8EE',
        color: '#10B981',
      };
    }
    if (s === 'weeklyoff' || s === 'weekend') {
      return {
        label: 'Weekly Off',
        bg: '#EFF6FF',
        color: '#3B82F6',
      };
    }
    if (s === 'half_day' || s === 'halfday') {
      return {
        label: 'Half Day',
        bg: '#FEF3C7',
        color: '#D97706',
      };
    }
    if (s === 'holiday') {
      return {
        label: 'Holiday',
        bg: '#F3E8FF',
        color: '#8B5CF6',
      };
    }
    return {
      label: 'Absent',
      bg: '#FEE2E2',
      color: '#EF4444',
    };
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" translucent={false} />

      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop:
              Platform.OS === 'android'
                ? (StatusBar.currentHeight || 24) + 12
                : Math.max(insets.top, 20) + 12,
          },
        ]}
      >
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color="#0F172A" />
          </TouchableOpacity>
          <View style={styles.headerTitles}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {employeeInfo.name}
            </Text>
            <Text style={styles.headerSub}>
              {employeeInfo.employeeId || 'EMP'} • Attendance Records
            </Text>
          </View>
        </View>

        {/* Month Navigation Strip */}
        <View style={styles.monthNavRow}>
          <TouchableOpacity
            style={styles.monthArrowBtn}
            onPress={handlePrevMonth}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={18} color="#0F172A" />
          </TouchableOpacity>
          <View style={styles.monthCenter}>
            <Ionicons name="calendar-outline" size={15} color={Colors.primary} style={{ marginRight: 6 }} />
            <Text style={styles.monthText}>
              {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.monthArrowBtn}
            onPress={handleNextMonth}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-forward" size={18} color="#0F172A" />
          </TouchableOpacity>
        </View>

        {/* Summary Metric Chips */}
        <View style={styles.statsRow}>
          <View style={[styles.statChip, { backgroundColor: '#E8F8EE' }]}>
            <Text style={[styles.statChipVal, { color: '#10B981' }]}>{stats.present}</Text>
            <Text style={styles.statChipLabel}>Present</Text>
          </View>
          <View style={[styles.statChip, { backgroundColor: '#FEE2E2' }]}>
            <Text style={[styles.statChipVal, { color: '#EF4444' }]}>{stats.absent}</Text>
            <Text style={styles.statChipLabel}>Absent</Text>
          </View>
          <View style={[styles.statChip, { backgroundColor: '#FEF3C7' }]}>
            <Text style={[styles.statChipVal, { color: '#D97706' }]}>{stats.halfDay}</Text>
            <Text style={styles.statChipLabel}>Half Day</Text>
          </View>
          <View style={[styles.statChip, { backgroundColor: '#EFF6FF' }]}>
            <Text style={[styles.statChipVal, { color: '#3B82F6' }]}>{stats.weeklyOff}</Text>
            <Text style={styles.statChipLabel}>Off</Text>
          </View>
          <View style={[styles.statChip, { backgroundColor: '#F1F5F9' }]}>
            <Text style={[styles.statChipVal, { color: '#334155' }]}>{stats.totalHours}h</Text>
            <Text style={styles.statChipLabel}>Total</Text>
          </View>
        </View>

        {/* View Mode Switcher: Calendar View (Default) vs Table View */}
        <View style={styles.viewModeSwitcher}>
          <TouchableOpacity
            style={[
              styles.viewModeBtn,
              viewMode === 'calendar' && styles.viewModeBtnActive,
            ]}
            onPress={() => setViewMode('calendar')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="calendar"
              size={15}
              color={viewMode === 'calendar' ? Colors.primary : '#64748B'}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.viewModeBtnText,
                viewMode === 'calendar' && styles.viewModeBtnTextActive,
              ]}
            >
              Calendar View
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.viewModeBtn,
              viewMode === 'table' && styles.viewModeBtnActive,
            ]}
            onPress={() => setViewMode('table')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="list"
              size={15}
              color={viewMode === 'table' ? Colors.primary : '#64748B'}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.viewModeBtnText,
                viewMode === 'table' && styles.viewModeBtnTextActive,
              ]}
            >
              Table View
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content: Calendar View (Default) or Table View */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Fetching attendance records...</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
          {viewMode === 'calendar' ? (
            <View style={{ paddingHorizontal: 12, paddingTop: 12, gap: 14 }}>
              {/* Calendar Card */}
              <View style={[styles.calendarCard, Shadow.sm]}>
                <View style={styles.calendarCardHeader}>
                  <Text style={styles.calendarCardTitle}>Monthly Calendar</Text>
                  {/* Legend */}
                  <View style={styles.legendRow}>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
                      <Text style={styles.legendText}>Present</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
                      <Text style={styles.legendText}>Absent</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
                      <Text style={styles.legendText}>Half</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: '#3B82F6' }]} />
                      <Text style={styles.legendText}>Off</Text>
                    </View>
                  </View>
                </View>

                {/* Week Day Header */}
                <View style={styles.calendarWeekRow}>
                  {DAY_SHORT.map((day) => (
                    <Text key={day} style={styles.calendarWeekTxt}>
                      {day}
                    </Text>
                  ))}
                </View>

                {/* Grid */}
                <View style={styles.calendarGrid}>
                  {/* Empty cells */}
                  {Array.from({ length: startDayOfWeek }).map((_, i) => (
                    <View key={`empty-${i}`} style={styles.calendarDayCellEmpty} />
                  ))}

                  {/* Day cells */}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const dayNum = i + 1;
                    const isSelected = selectedDayNum === dayNum;
                    const att = recordMap[dayNum];
                    const isFuture = isDayInFuture(dayNum);
                    const isWk = isWeekendDay(selectedYear, selectedMonth, dayNum);

                    const theme = isFuture
                      ? isWk
                        ? getDayStatusTheme('weeklyOff')
                        : getDayStatusTheme(undefined, true)
                      : getDayStatusTheme(att?.status || (isWk ? 'weeklyOff' : 'absent'));

                    return (
                      <TouchableOpacity
                        key={`day-${dayNum}`}
                        style={[
                          styles.calendarDayCell,
                          isSelected && {
                            backgroundColor: theme.tintBg,
                            borderWidth: 1.5,
                            borderColor: theme.border,
                          },
                        ]}
                        onPress={() => setSelectedDayNum(dayNum)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.calendarDayNumber,
                            isSelected && { color: theme.color, fontWeight: '800' },
                          ]}
                        >
                          {dayNum}
                        </Text>
                        {theme.dotColor !== 'transparent' ? (
                          <View style={[styles.calendarDayDot, { backgroundColor: theme.dotColor }]} />
                        ) : (
                          <View style={{ height: 6, marginTop: 4 }} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Selected Day Details Card */}
              {(() => {
                const isSelectedFuture = isDayInFuture(selectedDayNum);
                const isSelectedWeekend = isWeekendDay(selectedYear, selectedMonth, selectedDayNum);
                const dayTheme = isSelectedFuture
                  ? isSelectedWeekend
                    ? getDayStatusTheme('weeklyOff')
                    : getDayStatusTheme(undefined, true)
                  : getDayStatusTheme(selectedDayRecord?.status || (isSelectedWeekend ? 'weeklyOff' : 'absent'));

                const inTimeStr = selectedDayRecord?.inTime || (selectedDayRecord as any)?.checkIn || '--';
                const outTimeStr = selectedDayRecord?.outTime || (selectedDayRecord as any)?.checkOut || '--';
                const locationStr =
                  (selectedDayRecord as any)?.checkInLocation ||
                  (selectedDayRecord as any)?.location?.address ||
                  (inTimeStr !== '--' ? 'Office Geo-fence' : '');

                const hoursStr =
                  selectedDayRecord?.workingMinutes && selectedDayRecord.workingMinutes > 0
                    ? `${(selectedDayRecord.workingMinutes / 60).toFixed(2)} Hrs`
                    : (selectedDayRecord as any)?.workingHours || '0.00 Hrs';

                const otMinutes = selectedDayRecord?.overtimeMinutes;
                const otStatus = selectedDayRecord?.overtimeStatus || 'pending';

                return (
                  <View style={[styles.selectedDayCard, Shadow.sm, { borderLeftColor: dayTheme.color }]}>
                    <View style={styles.selectedDayHeader}>
                      <View>
                        <Text style={styles.selectedDayTitle}>
                          {MONTH_SHORT[selectedMonth - 1]} {String(selectedDayNum).padStart(2, '0')}, {selectedYear}
                        </Text>
                        <Text style={styles.selectedDaySubtitle}>
                          {new Date(selectedYear, selectedMonth - 1, selectedDayNum).toLocaleDateString('en-US', { weekday: 'long' })}
                        </Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: dayTheme.bg }]}>
                        <Text style={[styles.statusBadgeText, { color: dayTheme.color }]}>
                          {dayTheme.label}
                        </Text>
                      </View>
                    </View>

                    {/* Info Grid */}
                    <View style={styles.selectedDayGrid}>
                      <View style={styles.infoBox}>
                        <Text style={styles.infoBoxLabel}>CHECK IN</Text>
                        <Text style={[styles.infoBoxVal, inTimeStr === '--' && styles.timeEmpty]}>
                          {inTimeStr}
                        </Text>
                        {locationStr ? (
                          <Text style={styles.infoBoxSub} numberOfLines={1}>
                            {locationStr}
                          </Text>
                        ) : null}
                      </View>

                      <View style={styles.infoBox}>
                        <Text style={styles.infoBoxLabel}>CHECK OUT</Text>
                        <Text style={[styles.infoBoxVal, outTimeStr === '--' && styles.timeEmpty]}>
                          {outTimeStr}
                        </Text>
                      </View>

                      <View style={styles.infoBox}>
                        <Text style={styles.infoBoxLabel}>HOURS</Text>
                        <Text style={styles.infoBoxVal}>{hoursStr}</Text>
                      </View>

                      <View style={styles.infoBox}>
                        <Text style={styles.infoBoxLabel}>OVERTIME</Text>
                        <Text style={styles.infoBoxVal}>
                          {otMinutes ? `${otMinutes}m (${otStatus})` : '--'}
                        </Text>
                      </View>
                    </View>

                    {/* Admin Overtime Action if applicable */}
                    {isAdminOrManager && otMinutes && otStatus === 'pending' ? (
                      <View style={styles.overtimeActions}>
                        <Text style={styles.otPrompt}>Pending Overtime Approval:</Text>
                        <View style={styles.otBtnRow}>
                          <TouchableOpacity
                            style={[styles.otBtn, { backgroundColor: '#10B981' }]}
                            onPress={() => {
                              if (selectedDayRecord) {
                                setActiveDayDetail(selectedDayRecord);
                                handleOvertimeDecision('approved');
                              }
                            }}
                            disabled={actionLoading}
                          >
                            <Text style={styles.otBtnTxt}>Approve</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.otBtn, { backgroundColor: '#EF4444' }]}
                            onPress={() => {
                              if (selectedDayRecord) {
                                setActiveDayDetail(selectedDayRecord);
                                handleOvertimeDecision('rejected');
                              }
                            }}
                            disabled={actionLoading}
                          >
                            <Text style={styles.otBtnTxt}>Reject</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : null}

                    {/* Switch to table button */}
                    <TouchableOpacity
                      style={styles.switchTableBtn}
                      onPress={() => setViewMode('table')}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="list" size={15} color={Colors.primary} style={{ marginRight: 6 }} />
                      <Text style={styles.switchTableBtnText}>View Complete Monthly Records Table</Text>
                      <Ionicons name="chevron-forward" size={15} color={Colors.primary} style={{ marginLeft: 'auto' }} />
                    </TouchableOpacity>
                  </View>
                );
              })()}
            </View>
          ) : (
            /* Table View */
            <View style={[styles.tableCard, Shadow.sm]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false}>
                <View>
                  {/* Table Header Row (Matches Image 2) */}
                  <View style={styles.tableHeaderRow}>
                    <View style={[styles.tableCol, { width: 140 }]}>
                      <Text style={styles.colHeaderTxt}>DATE</Text>
                    </View>
                    <View style={[styles.tableCol, { width: 140 }]}>
                      <Text style={styles.colHeaderTxt}>CHECK IN</Text>
                    </View>
                    <View style={[styles.tableCol, { width: 110 }]}>
                      <Text style={styles.colHeaderTxt}>CHECK OUT</Text>
                    </View>
                    <View style={[styles.tableCol, { width: 95 }]}>
                      <Text style={styles.colHeaderTxt}>HOURS</Text>
                    </View>
                    <View style={[styles.tableCol, { width: 110 }]}>
                      <Text style={styles.colHeaderTxt}>STATUS</Text>
                    </View>
                    <View style={[styles.tableCol, { width: 65, alignItems: 'center' }]}>
                      <Text style={styles.colHeaderTxt}>DETAILS</Text>
                    </View>
                  </View>

                  {/* Table Body Rows (Matches Image 2) */}
                  {records.map((r, i) => {
                    const dateInfo = formatDateDisplay(r.date);
                    const isHighlighted = params.selectedDate === r.date;
                    const badge = getStatusBadge(r.status);
                    const inTimeStr = r.inTime || (r as any).checkIn || '--';
                    const outTimeStr = r.outTime || (r as any).checkOut || '--';
                    const locationStr =
                      (r as any).checkInLocation ||
                      (r as any).location?.address ||
                      (inTimeStr !== '--' ? 'Office Location' : '');

                    const hoursStr =
                      r.workingMinutes && r.workingMinutes > 0
                        ? `${(r.workingMinutes / 60).toFixed(2)} Hrs`
                        : (r as any).workingHours || '0.00 Hrs';

                    return (
                      <View
                        key={r.date || i}
                        style={[
                          styles.tableDataRow,
                          i % 2 === 1 && styles.rowOdd,
                          isHighlighted && styles.rowHighlighted,
                        ]}
                      >
                        {/* DATE */}
                        <View style={[styles.tableCol, { width: 140 }]}>
                          <View style={styles.dateColContainer}>
                            <Text style={styles.dateMainText}>{dateInfo.formatted}</Text>
                            {dateInfo.dayName ? (
                              <View style={styles.dayPill}>
                                <Text style={styles.dayPillText}>{dateInfo.dayName}</Text>
                              </View>
                            ) : null}
                          </View>
                        </View>

                        {/* CHECK IN */}
                        <View style={[styles.tableCol, { width: 140 }]}>
                          <Text style={[styles.timeText, inTimeStr === '--' && styles.timeEmpty]}>
                            {inTimeStr}
                          </Text>
                          {locationStr ? (
                            <Text style={styles.locationText} numberOfLines={1}>
                              {locationStr}
                            </Text>
                          ) : null}
                        </View>

                        {/* CHECK OUT */}
                        <View style={[styles.tableCol, { width: 110 }]}>
                          <Text style={[styles.timeText, outTimeStr === '--' && styles.timeEmpty]}>
                            {outTimeStr}
                          </Text>
                        </View>

                        {/* HOURS */}
                        <View style={[styles.tableCol, { width: 95 }]}>
                          <Text style={styles.hoursText}>{hoursStr}</Text>
                        </View>

                        {/* STATUS */}
                        <View style={[styles.tableCol, { width: 110 }]}>
                          <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                            <Text style={[styles.statusBadgeText, { color: badge.color }]}>
                              {badge.label}
                            </Text>
                          </View>
                        </View>

                        {/* DETAILS (Eye Button) */}
                        <View style={[styles.tableCol, { width: 65, alignItems: 'center' }]}>
                          <TouchableOpacity
                            style={styles.eyeBtn}
                            onPress={() => {
                              setActiveDayDetail(r);
                              setDetailModalVisible(true);
                            }}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="eye-outline" size={17} color="#8B5CF6" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          )}
        </ScrollView>
      )}

      {/* Record Punch Detail Modal */}
      <Modal
        visible={detailModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, Shadow.sm]}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalTitle}>Punch Details</Text>
                <Text style={styles.modalSubtitle}>
                  {activeDayDetail ? formatDateDisplay(activeDayDetail.date).formatted : ''}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setDetailModalVisible(false)}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {activeDayDetail && (
              <View style={styles.modalContent}>
                {/* Status Box */}
                <View style={styles.modalInfoRow}>
                  <Text style={styles.modalLabel}>Day Status</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: getStatusBadge(activeDayDetail.status).bg },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        { color: getStatusBadge(activeDayDetail.status).color },
                      ]}
                    >
                      {getStatusBadge(activeDayDetail.status).label}
                    </Text>
                  </View>
                </View>

                {/* Check In */}
                <View style={styles.modalInfoRow}>
                  <Text style={styles.modalLabel}>Check In</Text>
                  <Text style={styles.modalValText}>
                    {activeDayDetail.inTime || (activeDayDetail as any).checkIn || 'Not Clocked In'}
                  </Text>
                </View>

                {/* Check In Location */}
                <View style={styles.modalInfoRow}>
                  <Text style={styles.modalLabel}>Punch Location</Text>
                  <Text style={styles.modalValText} numberOfLines={2}>
                    {(activeDayDetail as any).checkInLocation ||
                      (activeDayDetail as any).location?.address ||
                      'Standard Office Geo-fence'}
                  </Text>
                </View>

                {/* Check Out */}
                <View style={styles.modalInfoRow}>
                  <Text style={styles.modalLabel}>Check Out</Text>
                  <Text style={styles.modalValText}>
                    {activeDayDetail.outTime || (activeDayDetail as any).checkOut || 'Not Clocked Out'}
                  </Text>
                </View>

                {/* Work Duration */}
                <View style={styles.modalInfoRow}>
                  <Text style={styles.modalLabel}>Working Hours</Text>
                  <Text style={styles.modalValText}>
                    {activeDayDetail.workingMinutes && activeDayDetail.workingMinutes > 0
                      ? `${(activeDayDetail.workingMinutes / 60).toFixed(2)} Hours`
                      : '0.00 Hours'}
                  </Text>
                </View>

                {/* Overtime */}
                <View style={styles.modalInfoRow}>
                  <Text style={styles.modalLabel}>Overtime</Text>
                  <Text style={styles.modalValText}>
                    {activeDayDetail.overtimeMinutes
                      ? `${activeDayDetail.overtimeMinutes} mins (${activeDayDetail.overtimeStatus || 'Pending'})`
                      : 'None'}
                  </Text>
                </View>

                {/* Admin Overtime Action (Section 5.2 E) */}
                {isAdminOrManager && activeDayDetail.overtimeMinutes ? (
                  <View style={styles.overtimeActions}>
                    <Text style={styles.otPrompt}>Overtime Decision:</Text>
                    <View style={styles.otBtnRow}>
                      <TouchableOpacity
                        style={[styles.otBtn, { backgroundColor: '#10B981' }]}
                        onPress={() => handleOvertimeDecision('approved')}
                        disabled={actionLoading}
                      >
                        <Text style={styles.otBtnTxt}>Approve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.otBtn, { backgroundColor: '#EF4444' }]}
                        onPress={() => handleOvertimeDecision('rejected')}
                        disabled={actionLoading}
                      >
                        <Text style={styles.otBtnTxt}>Reject</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}

                <TouchableOpacity
                  style={styles.modalDismissBtn}
                  onPress={() => setDetailModalVisible(false)}
                >
                  <Text style={styles.modalDismissTxt}>Close</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitles: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  monthArrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  monthCenter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  monthText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  statChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 10,
  },
  statChipVal: {
    fontSize: 13,
    fontWeight: '800',
  },
  statChipLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 1,
  },
  scroll: {
    flex: 1,
  },
  tableCard: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  tableDataRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  rowOdd: {
    backgroundColor: '#FAFAFA',
  },
  rowHighlighted: {
    backgroundColor: '#EFF6FF',
  },
  tableCol: {
    paddingRight: 10,
    justifyContent: 'center',
  },
  colHeaderTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  dateColContainer: {
    flexDirection: 'column',
    gap: 2,
  },
  dateMainText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  dayPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  dayPillText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
  },
  timeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  timeEmpty: {
    color: '#94A3B8',
  },
  locationText: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  hoursText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  eyeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    gap: 12,
  },
  modalInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  modalLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  modalValText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    maxWidth: '65%',
    textAlign: 'right',
  },
  overtimeActions: {
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  otPrompt: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 8,
  },
  otBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  otBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  otBtnTxt: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  modalDismissBtn: {
    marginTop: 10,
    backgroundColor: '#F1F5F9',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalDismissTxt: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },

  // View Switcher
  viewModeSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 3,
    marginTop: 10,
    gap: 4,
  },
  viewModeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 9,
  },
  viewModeBtnActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  viewModeBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  viewModeBtnTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },

  // Calendar
  calendarCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  calendarCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  calendarCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  calendarWeekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  calendarWeekTxt: {
    width: '14.28%',
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  calendarDayCellEmpty: {
    width: '14.28%',
    height: 48,
  },
  calendarDayCell: {
    width: '14.28%',
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    marginVertical: 2,
  },
  calendarDayNumber: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  calendarDayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 4,
  },

  // Selected Day Details Card
  selectedDayCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderLeftWidth: 4,
  },
  selectedDayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  selectedDayTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  selectedDaySubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  selectedDayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  infoBox: {
    width: '48%',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  infoBoxLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  infoBoxVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  infoBoxSub: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  switchTableBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  switchTableBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
});
