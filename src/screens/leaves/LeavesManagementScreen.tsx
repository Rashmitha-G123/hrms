import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, StatusBar, TextInput, useWindowDimensions,
  ActivityIndicator, Alert, Modal, KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, Shadow, IconBox } from '../../design-system/tokens';
import { Badge } from '../../design-system/components/Badge';
import { mockLeaves, mockEmployees } from '../../data/mockData';
import {
  submitAndProcessLeave,
  approveOrRejectLeave,
  manualUpdateBalance,
  fetchAllLeaveRequests,
  fetchLeaveStatisticsCounts,
  fetchHolidays,
  updateLeaveRequestStatus,
} from '../../services/leaveService';
import { fetchEmployees, fetchEmployeeById } from '../../services/employeeService';
import { fetchProfile } from '../../services/authService';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];
type Tab = 'requests' | 'holidays';
type StatusFilter = 'all' | 'approved' | 'pending' | 'rejected';

// Leave IDs mapping
const LEAVE_IDS: Record<string, string> = {
  'Annual Leave': '60d0fe4f5311236168a109cc',
  'Sick Leave': '60d0fe4f5311236168a109cd',
  'Casual Leave': '60d0fe4f5311236168a109ce',
};

// Enhanced mock data for manager view
const initialLeaves = mockLeaves.map((leave, i) => ({
  ...leave,
  employee: mockEmployees[i % mockEmployees.length],
  manager: mockEmployees[0],
}));

const getLeaveIcon = (type: string): IoniconName => {
  if (type.includes('Sick')) return 'medical-outline';
  if (type.includes('Casual')) return 'cafe-outline';
  return 'sunny-outline';
};

const fmt = (d: string) => {
  try {
    return new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch (e) {
    return d;
  }
};

const employeeColors: Record<string, { bg: string; text: string }> = {
  RS: { bg: '#EAF2FF', text: '#2B7FFF' },
  AM: { bg: '#E5FAEE', text: '#00C950' },
  VM: { bg: '#FFF5E6', text: '#FE9A00' },
  PK: { bg: '#F4EEFF', text: '#8E51FF' },
  SK: { bg: '#FFECEC', text: '#FF6900' },
  NP: { bg: '#FCE7F3', text: '#DB2777' },
};

export default function LeavesManagementScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 600;

  const [activeTab, setActiveTab] = useState<Tab>('requests');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');

  // Requests List State
  const [leavesList, setLeavesList] = useState<any[]>([]);

  // Modals & Action States
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // 1. Direct Submit Modal State
  const [showDirectModal, setShowDirectModal] = useState(false);
  const [directEmpId, setDirectEmpId] = useState('EMP-001');
  const [directLeaveType, setDirectLeaveType] = useState('Annual Leave');
  const [directFrom, setDirectFrom] = useState(new Date().toISOString().split('T')[0]);
  const [directTo, setDirectTo] = useState(new Date().toISOString().split('T')[0]);
  const [directReason, setDirectReason] = useState('');
  const [directLoading, setDirectLoading] = useState(false);

  // 2. Balance Override Modal State
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideEmpId, setOverrideEmpId] = useState('EMP-001');
  const [overrideLeaveType, setOverrideLeaveType] = useState('Annual Leave');
  const [overrideCount, setOverrideCount] = useState('15');
  const [overrideCarry, setOverrideCarry] = useState('2');
  const [overrideLoading, setOverrideLoading] = useState(false);

  // API Integrated States
  const [loading, setLoading] = useState(false);
  const [statsCounts, setStatsCounts] = useState<any>(null);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [holidaysLoading, setHolidaysLoading] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [adminRemarks, setAdminRemarks] = useState('Approved by Admin');
  const [profile, setProfile] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>('employee');
  const isSuperAdmin = userRole === 'superadmin';
  const canApproveReject = userRole === 'superadmin' || userRole === 'admin' || userRole === 'hr' || userRole === 'manager';

  useEffect(() => {
    fetchProfile().then(p => {
      if (p && p.user) {
        setUserRole(p.user.role || 'employee');
        setProfile(p.user);
        if (p.user.role === 'employee') {
          const selfId = p.user.employeeId || p.user.id || p.user._id || 'EMP-001';
          setDirectEmpId(selfId);
          setOverrideEmpId(selfId);
        }
      }
    }).catch(() => { });
  }, []);

  const normalizeLeaveRequest = (l: any) => {
    try {
      const start = new Date(l.startDate || l.from || Date.now());
      const end = new Date(l.endDate || l.to || Date.now());
      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const days = isNaN(daysDiff) ? 1 : Math.max(1, daysDiff);

      const rawStatus = (l.status || 'pending').toLowerCase();
      const cleanStatus = rawStatus === 'approved' ? 'approved' : rawStatus === 'rejected' ? 'rejected' : 'pending';

      const name = l.employeeName || l.employee?.name || 'Unknown';
      const initials = name
        ? name
          .split(' ')
          .filter((n: string) => n.length > 0)
          .map((n: string) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2) || '??'
        : '??';

      return {
        id: l._id || l.id || String(Math.random()),
        employeeId: l.employeeId || '',
        name,
        type: l.leaveName || l.type || 'Annual Leave',
        from: l.fromDate || l.from || new Date().toISOString(),
        to: l.toDate || l.to || new Date().toISOString(),
        days: l.numberOfDays || days,
        status: cleanStatus,
        reason: l.reason || '',
        appliedOn: l.appliedOn || new Date().toLocaleDateString(),
        employee: {
          id: l.employeeId || '',
          name,
          initials,
          designation: l.employeeId || l.employee?.designation || 'Employee'
        },
        manager: {
          id: l.reportingManagerId || l.employee?.reportingManagerId || 'mgr_01',
          name: l.reportingManagerName || l.employee?.reportingManagerName || 'Manager',
          initials: l.initials || l.employee?.initials || 'MG',
        }
      };
    } catch (e) {
      console.warn('Error normalizing leave request:', e, l);
      return null;
    }
  };

  const loadLeaveData = React.useCallback(async () => {
    setLoading(true);
    try {
      const statsRes = await fetchLeaveStatisticsCounts().catch(() => null);
      if (statsRes && statsRes.success) {
        setStatsCounts(statsRes.data);
      }

      const reqRes: any = await fetchAllLeaveRequests(1, 100);
      let rawList: any[] = [];
      if (reqRes) {
        if (Array.isArray(reqRes.data)) {
          rawList = reqRes.data;
        } else if (Array.isArray(reqRes.leaveRequests)) {
          rawList = reqRes.leaveRequests;
        } else if (Array.isArray(reqRes.applications)) {
          rawList = reqRes.applications;
        } else if (Array.isArray(reqRes.requests)) {
          rawList = reqRes.requests;
        } else if (Array.isArray(reqRes)) {
          rawList = reqRes;
        } else if (reqRes.success && reqRes.data && Array.isArray((reqRes.data as any).items)) {
          rawList = (reqRes.data as any).items;
        }
      }

      const normalized = rawList
        .map((item: any) => normalizeLeaveRequest(item))
        .filter((item: any) => item !== null);
      setLeavesList(normalized);

      let empsRes: any = null;
      const prof = await fetchProfile().catch(() => null);
      const isAdminOrMgr = prof && prof.user && (
        prof.user.role === 'superadmin' ||
        prof.user.role === 'admin' ||
        prof.user.role === 'hr' ||
        prof.user.role === 'manager'
      );
      const isEmp = !isAdminOrMgr;
      const selfUserId = prof && (
        (prof.user && (prof.user._id || prof.user.id)) ||
        prof._id ||
        prof.id
      );

      if (isEmp && selfUserId) {
        const singleRes = await fetchEmployeeById(selfUserId).catch(() => null);
        if (singleRes && (singleRes.employee || (singleRes as any).data)) {
          const empObj = singleRes.employee || (singleRes as any).data;
          empsRes = [empObj];
        }
      } else {
        empsRes = await fetchEmployees().catch(() => null);
      }

      if (empsRes && Array.isArray(empsRes)) {
        setEmployees(empsRes);
      } else if (empsRes && typeof empsRes === 'object') {
        const arr = (empsRes as any).data || (empsRes as any).employees || (empsRes as any).users || [];
        setEmployees(arr);
      }
    } catch (err) {
      console.warn('Failed to load leaves data from API:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHolidaysData = React.useCallback(async () => {
    setHolidaysLoading(true);
    try {
      const res = await fetchHolidays();
      if (res && res.success && Array.isArray(res.data)) {
        setHolidays(res.data);
      }
    } catch (err) {
      console.warn('Failed to fetch holidays:', err);
    } finally {
      setHolidaysLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadLeaveData();
  }, [loadLeaveData]);

  React.useEffect(() => {
    if (activeTab === 'holidays') {
      loadHolidaysData();
    }
  }, [activeTab, loadHolidaysData]);
  const derivedEmployees = employees.length > 0 ? employees.map(e => ({
    id: e.employeeId || e._id || e.id || '',
    name: e.name || 'Unnamed Employee'
  })) : mockEmployees;

  const filtered = leavesList.filter(l => {
    const matchStatus = statusFilter === 'all' || l.status === statusFilter;
    const matchSearch = search === '' ||
      l.employee.name.toLowerCase().includes(search.toLowerCase()) ||
      l.type.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const totalPending = statsCounts ? (statsCounts.pending ?? statsCounts.totalPending) : leavesList.filter(l => l.status === 'pending').length;
  const totalApproved = statsCounts ? (statsCounts.approved ?? statsCounts.totalApproved) : leavesList.filter(l => l.status === 'approved').length;
  const totalRejected = statsCounts ? (statsCounts.rejected ?? statsCounts.totalRejected) : leavesList.filter(l => l.status === 'rejected').length;
  const todayOnLeave = statsCounts ? (statsCounts.todayOnLeave ?? 0) : 0;

  const stats = [
    { label: 'Total Leave Requests', value: statsCounts ? statsCounts.totalApplications : leavesList.length, icon: 'document-text-outline' as IoniconName, color: '#2B7FFF', bg: '#EAF2FF' },
    { label: 'Approved Leaves', value: totalApproved, icon: 'checkmark-circle-outline' as IoniconName, color: '#00C950', bg: '#E5FAEE' },
    { label: 'Rejected Leaves', value: totalRejected, icon: 'close-circle-outline' as IoniconName, color: '#8E51FF', bg: '#F4EEFF' },
    {
      label: 'Today On Leave',
      value: todayOnLeave,
      icon: 'walk-outline' as IoniconName,
      color: '#FE9A00',
      bg: '#FFF5E6'
    },
  ];

  // ── Handle Approve/Reject ──
  const handleProcessRequest = async (status: 'approved' | 'rejected') => {
    if (!selectedRequest) return;
    setActionLoading(true);
    try {
      const apiStatus = status === 'approved' ? 'APPROVED' : 'REJECTED';
      await updateLeaveRequestStatus(selectedRequest.id, apiStatus, adminRemarks);
      Alert.alert('Success', `Leave request ${status} successfully.`);
      // Update local state list
      setLeavesList(prev =>
        prev.map(l => l.id === selectedRequest.id ? { ...l, status } : l)
      );
      setSelectedRequest(null);
      loadLeaveData().catch(() => { });
    } catch (err: any) {
      Alert.alert('Error', err.message || `Failed to update leave request status.`);
    } finally {
      setActionLoading(false);
    }
  };

  // ── Quick Inline Approve/Reject ──
  const handleQuickAction = async (leaveId: string, status: 'approved' | 'rejected') => {
    try {
      const apiStatus = status === 'approved' ? 'APPROVED' : 'REJECTED';
      await updateLeaveRequestStatus(leaveId, apiStatus, 'Admin action');
      setLeavesList(prev =>
        prev.map(l => l.id === leaveId ? { ...l, status } : l)
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || `Failed to update leave request.`);
    }
  };

  // ── Handle Direct Submit and Auto-Approve ──
  const handleDirectProcessSubmit = async () => {
    if (!directReason.trim()) {
      Alert.alert('Error', 'Please enter a processing reason.');
      return;
    }
    setDirectLoading(true);
    try {
      await submitAndProcessLeave({
        empId: directEmpId,
        leaveId: LEAVE_IDS[directLeaveType] || '60d0fe4f5311236168a109cc',
        fromDate: new Date(directFrom).toISOString(),
        toDate: new Date(directTo).toISOString(),
        reason: directReason.trim(),
      });
      Alert.alert('Success', 'Leave application processed and approved.');
      setShowDirectModal(false);
      setDirectReason('');
      loadLeaveData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to process leave request.');
    } finally {
      setDirectLoading(false);
    }
  };

  // ── Handle Manual Balance Override ──
  const handleBalanceOverrideSubmit = async () => {
    const yCount = parseInt(overrideCount);
    const cForward = parseInt(overrideCarry);
    if (isNaN(yCount) || isNaN(cForward)) {
      Alert.alert('Error', 'Yearly Count and Carry Forward must be valid integers.');
      return;
    }
    setOverrideLoading(true);
    try {
      await manualUpdateBalance({
        empId: overrideEmpId,
        leaveId: LEAVE_IDS[overrideLeaveType] || '60d0fe4f5311236168a109cc',
        yearlyCount: yCount,
        carryForward: cForward,
      });
      Alert.alert('Success', 'Leave balance updated successfully.');
      setShowOverrideModal(false);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update leave balance.');
    } finally {
      setOverrideLoading(false);
    }
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={[s.header, { paddingHorizontal: isMobile ? 16 : 24 }]}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} style={s.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color="#111827" />
        </TouchableOpacity>
        <Text style={s.pageTitle}>Leave Management</Text>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={[s.scrollContent, { paddingHorizontal: isMobile ? 16 : 24 }]} showsVerticalScrollIndicator={false}>

        {/* Summary Cards */}
        <View style={[s.statsGrid, isMobile && { gap: 10 }]}>
          {stats.map((item, i) => (
            <View key={i} style={[s.statCard, Shadow.sm]}>
              <View style={[s.statIconBox, { backgroundColor: item.bg }]}>
                <Ionicons name={item.icon} size={20} color={item.color} />
              </View>
              <View style={s.statContent}>
                <Text style={s.statLabel}>{item.label.toUpperCase()}</Text>
                <Text style={s.statValue}>{item.value}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Navigation Tabs */}
        <View style={s.tabsRow}>
          <TouchableOpacity
            style={[s.tab, activeTab === 'requests' && s.tabActive]}
            onPress={() => setActiveTab('requests')}
          >
            <Text style={[s.tabText, activeTab === 'requests' && s.tabTextActive]}>Requests & Approvals</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.tab, activeTab === 'holidays' && s.tabActive]}
            onPress={() => setActiveTab('holidays')}
          >
            <Text style={[s.tabText, activeTab === 'holidays' && s.tabTextActive]}>Holidays Calendar</Text>
          </TouchableOpacity>
        </View>

        {/* Content Card */}
        {activeTab === 'requests' && (
          <View style={isMobile ? s.contentCardMobile : [s.contentCard, Shadow.sm]}>
            {/* Section Header */}
            <View style={s.contentHeader}>
              <View>
                <Text style={s.contentTitle}>Employees Leave Requests</Text>
                <Text style={s.contentSubtitle}>Review applications and adjust leave configurations</Text>
              </View>
            </View>

            {/* Toolbar */}
            <View style={[s.toolbar, isMobile && s.toolbarMobile]}>
              <View style={[s.searchBox, isMobile && s.searchBoxFull]}>
                <Ionicons name="search-outline" size={18} color={'#A4A4AD'} />
                <TextInput
                  style={s.searchInput}
                  placeholder="Search employees..."
                  placeholderTextColor={'#A4A4AD'}
                  value={search}
                  onChangeText={setSearch}
                />
              </View>
              <View style={[s.toolbarRow, isMobile && s.toolbarRowFull]}>
                {!isSuperAdmin && (
                  <TouchableOpacity
                    style={[s.toolBtn, { backgroundColor: Colors.accent }]}
                    onPress={() => setShowDirectModal(true)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="flash-outline" size={15} color="#fff" />
                    <Text style={s.toolBtnText}>Apply Leave</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Filter Pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterPills}>
              {(['all', 'approved', 'pending', 'rejected'] as StatusFilter[]).map(f => (
                <TouchableOpacity
                  key={f}
                  style={[s.filterPill, statusFilter === f && s.filterPillActive]}
                  onPress={() => setStatusFilter(f)}
                >
                  <Text style={[s.filterPillText, statusFilter === f && s.filterPillTextActive]}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Table / Cards */}
            {filtered.length > 0 ? (
              isMobile ? (
                <View style={s.cardList}>
                  {filtered.map(leave => {
                    const statusColor =
                      leave.status === 'approved'
                        ? Colors.success
                        : leave.status === 'rejected'
                          ? Colors.danger
                          : Colors.warning;

                    const employeeAvatar =
                      employeeColors[leave.employee.initials] ?? {
                        bg: '#F3F4F6',
                        text: '#6B7280',
                      };
                    return (
                      <View key={leave.id} style={[s.leaveCard, { borderLeftColor: statusColor }]}>
                        <View style={s.leaveCardTop}>
                          <View style={s.leaveCardLeft}>
                            <View style={[s.initialBox, { backgroundColor: employeeAvatar.bg }]}>
                              <Text style={[s.initialText, { color: employeeAvatar.text }]}>
                                {leave.employee.initials}
                              </Text>
                            </View>
                            <View style={s.empInfo}>
                              <Text style={s.empName}>{leave.employee.name}</Text>
                              <Text style={s.empRole}>{leave.employee.designation}</Text>
                            </View>
                          </View>
                          <Badge
                            label={leave.status}
                            variant={leave.status === 'approved' ? 'success' : leave.status === 'rejected' ? 'danger' : 'warning'}
                            dot
                          />
                        </View>
                        <View style={s.leaveCardMid}>
                          <View style={s.typeRow}>
                            <View style={[s.typeIcon, { backgroundColor: statusColor + '15' }]}>
                              <Ionicons name={getLeaveIcon(leave.type)} size={13} color={statusColor} />
                            </View>
                            <Text style={s.typeText}>{leave.type}</Text>
                          </View>
                          <Text style={s.reasonText} numberOfLines={1}>{leave.reason}</Text>
                        </View>
                        <View style={s.leaveCardBottom}>
                          <View style={s.dateRow}>
                            <Ionicons name="calendar-outline" size={12} color={Colors.primary} />
                            <Text style={s.dateText}>{fmt(leave.from)} → {fmt(leave.to)}</Text>
                          </View>
                          <View style={[s.daysBadge, { backgroundColor: statusColor + '12' }]}>
                            <Text style={[s.daysText, { color: statusColor }]}>{leave.days}d</Text>
                          </View>
                          <View style={s.cardActions}>
                            <TouchableOpacity style={[s.actionBtn, s.viewBtn]} onPress={() => setSelectedRequest(leave)}>
                              <Ionicons name="eye-outline" size={15} color='#3E8AFF' />
                            </TouchableOpacity>
                            {canApproveReject && leave.status === 'pending' && (
                              <>
                                <TouchableOpacity
                                  style={s.approveIconBtn}
                                  onPress={() => handleQuickAction(leave.id, 'approved')}
                                  activeOpacity={0.75}
                                >
                                  <Ionicons name="checkmark" size={16} color="#10B981" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={s.rejectIconBtn}
                                  onPress={() => handleQuickAction(leave.id, 'rejected')}
                                  activeOpacity={0.75}
                                >
                                  <Ionicons name="close" size={16} color="#FF6900" />
                                </TouchableOpacity>
                              </>
                            )}
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={s.table}>
                  {/* Table Header */}
                  <View style={s.tableHeader}>
                    <Text style={[s.th, s.thEmployee]}>EMPLOYEE</Text>
                    <Text style={[s.th, s.thType]}>TYPE & REASON</Text>
                    <Text style={[s.th, s.thTimeline]}>TIMELINE</Text>
                    <Text style={[s.th, s.thManager]}>MANAGER</Text>
                    <Text style={[s.th, s.thStatus]}>STATUS</Text>
                    <Text style={[s.th, s.thActions]}>ACTIONS</Text>
                  </View>

                  {/* Table Rows */}
                  {filtered.map(leave => {
                    const statusColor = leave.status === 'approved' ? Colors.success :
                      leave.status === 'rejected' ? Colors.danger : Colors.warning;
                    const employeeAvatar =
                      employeeColors[leave.employee.initials] ?? {
                        bg: '#F3F4F6',
                        text: '#6B7280',
                      };

                    const managerAvatar =
                      employeeColors[leave.manager.initials] ?? {
                        bg: '#F3F4F6',
                        text: '#6B7280',
                      };
                    return (
                      <View key={leave.id} style={s.tableRow}>
                        {/* Employee */}
                        <View style={s.tdEmployee}>
                          <View style={[s.initialBox, { backgroundColor: employeeAvatar.bg }]}>
                            <Text style={[s.initialText, { color: employeeAvatar.text }]}>
                              {leave.employee.initials}
                            </Text>
                          </View>
                          <View style={s.empInfo}>
                            <Text style={s.empName}>{leave.employee.name}</Text>
                            <Text style={s.empRole}>{leave.employee.designation}</Text>
                          </View>
                        </View>

                        {/* Type & Reason */}
                        <View style={s.tdType}>
                          <View style={s.typeRow}>
                            <View style={[s.typeIcon, { backgroundColor: statusColor + '15' }]}>
                              <Ionicons name={getLeaveIcon(leave.type)} size={14} color={statusColor} />
                            </View>
                            <Text style={s.typeText}>{leave.type}</Text>
                          </View>
                          <Text style={s.reasonText} numberOfLines={1}>{leave.reason}</Text>
                        </View>

                        {/* Timeline */}
                        <View style={s.tdTimeline}>
                          <View style={s.dateRow}>
                            <Ionicons name="calendar-outline" size={13} color={Colors.primary} />
                            <Text style={s.dateText}>{fmt(leave.from)}</Text>
                          </View>
                          <View style={s.dateRow}>
                            <Ionicons name="arrow-forward-outline" size={13} color={Colors.gray400} />
                            <Text style={s.dateText}>{fmt(leave.to)}</Text>
                          </View>
                          <View style={[s.daysBadge, { backgroundColor: statusColor + '12' }]}>
                            <Text style={[s.daysText, { color: statusColor }]}>{leave.days}d</Text>
                          </View>
                        </View>

                        {/* Manager */}
                        <View style={s.tdManager}>
                          {/* <View style={[s.initialBoxSmall, { backgroundColor: managerAvatar.bg }]}>
                            <Text style={[s.initialTextSmall, { color: managerAvatar.text }]}>
                              {leave.manager.initials}
                            </Text>
                          </View> */}
                          <Text style={s.managerName} numberOfLines={1}>{leave.manager.name.split(' ')[0]}</Text>
                        </View>

                        {/* Status */}
                        <View style={s.tdStatus}>
                          <Badge
                            label={leave.status}
                            variant={leave.status === 'approved' ? 'success' : leave.status === 'rejected' ? 'danger' : 'warning'}
                            dot
                          />
                        </View>

                        {/* Actions */}
                        <View style={s.tdActions}>
                          <TouchableOpacity style={[s.actionBtn, s.viewBtn]} onPress={() => setSelectedRequest(leave)}>
                            <Ionicons name="eye-outline" size={16} color='#3E8AFF' />
                          </TouchableOpacity>
                          {canApproveReject && leave.status === 'pending' && (
                            <>
                              <TouchableOpacity
                                style={s.approveIconBtn}
                                onPress={() => handleQuickAction(leave.id, 'approved')}
                                activeOpacity={0.75}
                              >
                                <Ionicons name="checkmark" size={16} color="#10B981" />
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={s.rejectIconBtn}
                                onPress={() => handleQuickAction(leave.id, 'rejected')}
                                activeOpacity={0.75}
                              >
                                <Ionicons name="close" size={16} color="#FF6900" />
                              </TouchableOpacity>
                            </>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )
            ) : (
              <View style={[s.emptyState, isMobile && { backgroundColor: Colors.white, borderRadius: 16, paddingVertical: 40 }]}>
                <View style={s.emptyIconBox}>
                  <Ionicons name="document-text-outline" size={48} color={Colors.gray300} />
                </View>
                <Text style={s.emptyTitle}>No Leave Requests Found</Text>
                <Text style={s.emptySub}>Start by adjusting filters or configurations</Text>
              </View>
            )}
          </View>
        )}

        {activeTab === 'holidays' && (
          <View style={isMobile ? s.contentCardMobile : [s.contentCard, Shadow.sm]}>
            {holidaysLoading ? (
              <View style={s.emptyState}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={{ fontSize: 12, color: Colors.gray500, marginTop: 8 }}>Fetching holidays...</Text>
              </View>
            ) : holidays.length > 0 ? (
              <View style={s.table}>
                {/* Table Header */}
                <View style={s.tableHeader}>
                  <Text style={[s.th, { flex: 2 }]}>Holiday Name</Text>
                  <Text style={[s.th, { flex: 1.5 }]}>Date</Text>
                  <Text style={[s.th, { flex: 1.5 }]}>Type</Text>
                </View>
                {/* Table Rows */}
                {holidays.map((h, i) => (
                  <View key={h._id || i} style={s.tableRow}>
                    <Text style={[s.empName, { flex: 2 }]} numberOfLines={1}>{h.name}</Text>
                    <View style={[{ flex: 1.5, flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                      <Ionicons name="calendar-outline" size={13} color={Colors.primary} />
                      <Text style={s.dateText}>{fmt(h.date)}</Text>
                    </View>
                    <View style={[s.tdStatus, { flex: 1.5, alignItems: 'flex-start' }]}>
                      <Badge label={h.type || 'Public Holiday'} variant="success" />
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={[s.emptyState, isMobile && { backgroundColor: Colors.white, borderRadius: 16, paddingVertical: 40 }]}>
                <View style={s.emptyIconBox}>
                  <Ionicons name="calendar-outline" size={48} color={Colors.gray300} />
                </View>
                <Text style={s.emptyTitle}>Holidays Calendar</Text>
                <Text style={s.emptySub}>No holidays configured</Text>
              </View>
            )}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Modal 1: Request Details and Action Modal ── */}
      {selectedRequest && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setSelectedRequest(null)}>
          <View style={s.modalOverlay}>
            <View style={s.modalCard}>
              <View style={s.modalHeader}>
                <View>
                  <Text style={s.modalTitle}>Leave Request Details</Text>
                  <Text style={s.modalSub}>Status override and approvals workflow</Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedRequest(null)} style={s.modalClose}>
                  <Ionicons name="close" size={20} color={Colors.gray600} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
                <Text style={s.fieldLabel}>Applicant Employee</Text>
                <Text style={s.fieldValue}>{selectedRequest.employee.name} ({selectedRequest.employee.id || 'EMP-001'})</Text>

                <Text style={s.fieldLabel}>Leave Category</Text>
                <Text style={s.fieldValue}>{selectedRequest.type}</Text>

                <Text style={s.fieldLabel}>Requested Dates</Text>
                <Text style={s.fieldValue}>{fmt(selectedRequest.from)} – {fmt(selectedRequest.to)} ({selectedRequest.days} days)</Text>

                <Text style={s.fieldLabel}>Reason for application</Text>
                <Text style={s.fieldValue}>{selectedRequest.reason || 'No reason provided.'}</Text>

                <Text style={s.fieldLabel}>Current Status</Text>
                <View style={{ alignSelf: 'flex-start', marginVertical: 4 }}>
                  <Badge
                    label={selectedRequest.status}
                    variant={selectedRequest.status === 'approved' ? 'success' : selectedRequest.status === 'rejected' ? 'danger' : 'warning'}
                    dot
                  />
                </View>

                {selectedRequest.status === 'pending' && (
                  <>
                    <Text style={s.fieldLabel}>Admin Remarks</Text>
                    <TextInput
                      style={s.textInput}
                      value={adminRemarks}
                      onChangeText={setAdminRemarks}
                      placeholder="Enter remarks..."
                      placeholderTextColor="#A4A4AD"
                    />
                  </>
                )}

                {selectedRequest.status === 'pending' && canApproveReject ? (
                  <View style={s.modalActions}>
                    <TouchableOpacity
                      style={[s.modalActionBtn, { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5', borderWidth: 1 }]}
                      onPress={() => handleProcessRequest('rejected')}
                      disabled={actionLoading}
                    >
                      <Ionicons name="close-circle-outline" size={16} color={Colors.danger} />
                      <Text style={[s.modalActionBtnTxt, { color: Colors.danger }]}> Reject Request</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[s.modalActionBtn, { backgroundColor: '#D1FAE5', borderColor: '#6EE7B7', borderWidth: 1 }]}
                      onPress={() => handleProcessRequest('approved')}
                      disabled={actionLoading}
                    >
                      <Ionicons name="checkmark-circle-outline" size={16} color={Colors.success} />
                      <Text style={[s.modalActionBtnTxt, { color: Colors.success }]}> Approve Request</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={s.modalCancelBtn} onPress={() => setSelectedRequest(null)}>
                    <Text style={s.modalCancelTxt}>Close Details</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* ── Modal 2: Direct auto-approval submit Modal ── */}
      <Modal visible={showDirectModal} animationType="slide" transparent onRequestClose={() => setShowDirectModal(false)}>
        <View style={s.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalCard}>
            <View style={s.modalHeader}>
              <View>
                <Text style={s.modalTitle}>Submit & Process Leave</Text>
                <Text style={s.modalSub}>Auto-approves immediate leave bypass applications</Text>
              </View>
              <TouchableOpacity onPress={() => setShowDirectModal(false)} style={s.modalClose}>
                <Ionicons name="close" size={20} color={Colors.gray600} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
              {userRole !== 'employee' && (
                <>
                  <Text style={s.fieldLabel}>Employee ID *</Text>
                  <View style={s.pickerContainer}>
                    {derivedEmployees.map(e => (
                      <TouchableOpacity key={e.id} style={[s.pickerChip, directEmpId === e.id && s.pickerChipActive]} onPress={() => setDirectEmpId(e.id)}>
                        <Text style={[s.pickerChipText, directEmpId === e.id && s.pickerChipTextActive]}>{e.name} ({e.id})</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              <Text style={s.fieldLabel}>Leave Category *</Text>
              <View style={s.pickerContainer}>
                {['Annual Leave', 'Sick Leave', 'Casual Leave'].map(t => (
                  <TouchableOpacity key={t} style={[s.pickerChip, directLeaveType === t && s.pickerChipActive]} onPress={() => setDirectLeaveType(t)}>
                    <Text style={[s.pickerChipText, directLeaveType === t && s.pickerChipTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.fieldLabel}>From Date (YYYY-MM-DD) *</Text>
              <TextInput style={s.textInput} value={directFrom} onChangeText={setDirectFrom} placeholder="YYYY-MM-DD" placeholderTextColor="#A4A4AD" />

              <Text style={s.fieldLabel}>To Date (YYYY-MM-DD) *</Text>
              <TextInput style={s.textInput} value={directTo} onChangeText={setDirectTo} placeholder="YYYY-MM-DD" placeholderTextColor="#A4A4AD" />

              <Text style={s.fieldLabel}>Bypass Reason *</Text>
              <TextInput style={[s.textInput, { height: 70, paddingTop: 10 }]} multiline value={directReason} onChangeText={setDirectReason} placeholder="e.g. Direct management directive approval" placeholderTextColor="#A4A4AD" />

              <View style={s.modalActionsRow}>
                <TouchableOpacity style={s.modalCancelBtn} onPress={() => setShowDirectModal(false)}>
                  <Text style={s.modalCancelTxt}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.modalSubmitBtn} onPress={handleDirectProcessSubmit} disabled={directLoading}>
                  {directLoading ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={s.modalSubmitTxt}>Apply Leave</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ── Modal 3: Manual Balance Override Modal ── */}
      <Modal visible={showOverrideModal} animationType="slide" transparent onRequestClose={() => setShowOverrideModal(false)}>
        <View style={s.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalCard}>
            <View style={s.modalHeader}>
              <View>
                <Text style={s.modalTitle}>Manual Balance Override</Text>
                <Text style={s.modalSub}>Adjust employee balances directly</Text>
              </View>
              <TouchableOpacity onPress={() => setShowOverrideModal(false)} style={s.modalClose}>
                <Ionicons name="close" size={20} color={Colors.gray600} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
              <Text style={s.fieldLabel}>Select Employee ID *</Text>
              <View style={s.pickerContainer}>
                {derivedEmployees.map(e => (
                  <TouchableOpacity key={e.id} style={[s.pickerChip, overrideEmpId === e.id && s.pickerChipActive]} onPress={() => setOverrideEmpId(e.id)}>
                    <Text style={[s.pickerChipText, overrideEmpId === e.id && s.pickerChipTextActive]}>{e.name} ({e.id})</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.fieldLabel}>Leave Category *</Text>
              <View style={s.pickerContainer}>
                {['Annual Leave', 'Sick Leave', 'Casual Leave'].map(t => (
                  <TouchableOpacity key={t} style={[s.pickerChip, overrideLeaveType === t && s.pickerChipActive]} onPress={() => setOverrideLeaveType(t)}>
                    <Text style={[s.pickerChipText, overrideLeaveType === t && s.pickerChipTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.fieldLabel}>Yearly Limit Count *</Text>
              <TextInput style={s.textInput} value={overrideCount} onChangeText={setOverrideCount} keyboardType="numeric" placeholder="e.g. 15" placeholderTextColor="#A4A4AD" />

              <Text style={s.fieldLabel}>Carry Forward Days *</Text>
              <TextInput style={s.textInput} value={overrideCarry} onChangeText={setOverrideCarry} keyboardType="numeric" placeholder="e.g. 2" placeholderTextColor="#A4A4AD" />

              <View style={s.modalActionsRow}>
                <TouchableOpacity style={s.modalCancelBtn} onPress={() => setShowOverrideModal(false)}>
                  <Text style={s.modalCancelTxt}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.modalSubmitBtn} onPress={handleBalanceOverrideSubmit} disabled={overrideLoading}>
                  {overrideLoading ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={s.modalSubmitTxt}>Save Adjustments</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { backgroundColor: Colors.white, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 16 : 56, paddingHorizontal: 24, paddingBottom: 20, flexDirection: 'row', alignItems: 'center', ...Shadow.sm },
  backBtn: { marginRight: 16, width: 36, height: 36, borderRadius: 10, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  pageTitle: { fontSize: 20, fontWeight: '800', color: Colors.gray900, letterSpacing: -0.5 },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 24 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 24 },
  statCard: { flex: 1, minWidth: '45%', backgroundColor: Colors.white, borderRadius: 16, padding: 10, flexDirection: 'row', alignItems: 'center' },
  statIconBox: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 8, ...IconBox.shadow as any },
  statContent: { flex: 1 },
  statLabel: { fontSize: 9, fontWeight: '600', color: '#45556C', marginBottom: 2 },
  statValue: { fontSize: 24, fontWeight: '600', color: Colors.gray900 },

  tabsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: Colors.white, borderWidth: 1.5, borderColor: '#E4E4E7', alignItems: 'center' },
  tabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { fontSize: 12, fontWeight: '700', color: Colors.gray600 },
  tabTextActive: { color: Colors.white },

  contentCard: { backgroundColor: Colors.white, borderRadius: 16, padding: 20, marginBottom: 24 },
  contentCardMobile: { paddingHorizontal: 0, paddingVertical: 8, marginBottom: 24 },
  contentHeader: { marginBottom: 20 },
  contentTitle: { fontSize: 18, fontWeight: '800', color: Colors.gray900, marginBottom: 4 },
  contentSubtitle: { fontSize: 13, color: Colors.gray500 },

  toolbar: { flexDirection: 'row', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' },
  toolbarMobile: { flexDirection: 'column' },
  toolbarRow: { flexDirection: 'row', gap: 10, flex: 1 },
  toolbarRowFull: { width: '100%' },
  searchBox: { flex: 1, minWidth: 180, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4, gap: 8, borderWidth: 1, borderColor: '#E4E4E7', height: 42 },
  searchBoxFull: { width: '100%', minWidth: 0 },
  searchInput: { flex: 1, fontSize: 13, color: Colors.gray900, height: 40 },
  toolBtn: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingHorizontal: 14, height: 42, gap: 6, ...Shadow.sm },
  toolBtnText: { fontSize: 12, fontWeight: '700', color: Colors.white },

  filterPills: { marginBottom: 20, flexGrow: 0 },
  filterPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: '#F9FAFB', marginRight: 8, borderWidth: 1, borderColor: '#E4E4E7' },
  filterPillActive: { backgroundColor: Colors.overlayLight, borderColor: Colors.primary },
  filterPillText: { fontSize: 12, fontWeight: '600', color: '#A4A4AD' },
  filterPillTextActive: { color: Colors.primary },

  table: { borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: Colors.gray200 },
  tableHeader: { flexDirection: 'row', backgroundColor: Colors.gray50, paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: Colors.gray200 },
  th: { fontSize: 10, fontWeight: '800', color: Colors.gray600, letterSpacing: 0.5 },
  thEmployee: { flex: 2 },
  thType: { flex: 2 },
  thTimeline: { flex: 2 },
  thManager: { flex: 1.2 },
  thStatus: { flex: 1.2 },
  thActions: { flex: 1.5 },
  tableRow: { flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: Colors.gray100, alignItems: 'center' },
  tdEmployee: { flex: 2, flexDirection: 'row', alignItems: 'center', gap: 10 },
  empInfo: { flex: 1 },
  empName: { fontSize: 13, fontWeight: '700', color: Colors.gray900 },
  empRole: { fontSize: 11, color: Colors.gray500, marginTop: 2 },
  tdType: { flex: 2, gap: 4 },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  typeIcon: { width: 24, height: 24, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  typeText: { fontSize: 12, fontWeight: '700', color: Colors.gray900 },
  reasonText: { fontSize: 11, color: Colors.gray500 },
  tdTimeline: { flex: 2, gap: 3 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dateText: { fontSize: 11, color: Colors.gray700, fontWeight: '500' },
  daysBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 2 },
  daysText: { fontSize: 11, fontWeight: '600' },
  tdManager: { flex: 1.2, flexDirection: 'row', alignItems: 'center', gap: 6 },
  managerName: { fontSize: 11, fontWeight: '600', color: Colors.gray700 },
  tdStatus: { flex: 1.2 },
  tdActions: { flex: 1.5, flexDirection: 'row', gap: 6 },
  actionBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  viewBtn: { backgroundColor: '#E6EFFC' },
  editBtn: { backgroundColor: '#E3F7EB' },
  deleteBtn: { backgroundColor: '#FCF2E3' },
  approveIconBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: '#F0FDF8',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#D1FAE5',
    ...Shadow.sm,
  },
  rejectIconBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: '#FFF5F0',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#FFE0D0',
    ...Shadow.sm,
  },

  cardList: { gap: 10 },
  leaveCard: { backgroundColor: Colors.white, borderRadius: 12, padding: 14, borderLeftWidth: 4, borderWidth: 1, borderColor: Colors.gray100, gap: 10 },
  leaveCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  leaveCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  leaveCardMid: { gap: 3 },
  leaveCardBottom: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  cardActions: { flexDirection: 'row', gap: 6, marginLeft: 'auto' },
  emptyState: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 24 },
  emptyIconBox: { marginBottom: 16, opacity: 0.6 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.gray700, marginBottom: 8 },
  emptySub: { fontSize: 14, color: Colors.gray500, textAlign: 'center', marginBottom: 24, lineHeight: 20 },

  initialBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  initialText: { fontSize: 13, fontWeight: '700' },
  initialBoxSmall: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  initialTextSmall: { fontSize: 10, fontWeight: '700' },

  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%', paddingHorizontal: 20, paddingTop: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.gray900 },
  modalSub: { fontSize: 12, color: Colors.gray400, marginTop: 2 },
  modalClose: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.gray100, alignItems: 'center', justifyContent: 'center' },

  fieldLabel: { fontSize: 11, fontWeight: '700', color: Colors.gray600, marginTop: 12, marginBottom: 6, letterSpacing: 0.2, textTransform: 'uppercase' },
  fieldValue: { fontSize: 14, color: Colors.gray900, fontWeight: '600', marginBottom: 4 },
  textInput: { height: 46, backgroundColor: '#F9FAFB', borderRadius: 10, borderWidth: 1.5, borderColor: '#E4E4E7', paddingHorizontal: 14, fontSize: 13, color: Colors.gray900, marginBottom: 4 },

  pickerContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 4 },
  pickerChip: { backgroundColor: '#F9FAFB', borderWidth: 1.5, borderColor: '#E4E4E7', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  pickerChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pickerChipText: { fontSize: 11, color: Colors.gray600, fontWeight: '700' },
  pickerChipTextActive: { color: Colors.white },

  modalActions: { flexDirection: 'row', gap: 10, marginTop: 24, marginBottom: 20 },
  modalActionsRow: { flexDirection: 'row', gap: 10, marginTop: 20, marginBottom: 20 },
  modalActionBtn: { flex: 1, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 },
  modalActionBtnTxt: { fontSize: 13, fontWeight: '700' },
  modalCancelBtn: { flex: 1, height: 48, borderRadius: 12, borderWidth: 1.5, borderColor: '#E4E4E7', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.white },
  modalCancelTxt: { fontSize: 14, fontWeight: '700', color: Colors.gray600 },
  modalSubmitBtn: { flex: 2, height: 48, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  modalSubmitTxt: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
