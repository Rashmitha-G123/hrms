import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, StatusBar, RefreshControl, TextInput, Modal,
  ActivityIndicator, Alert, Linking, KeyboardAvoidingView,
  Dimensions,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography, Spacing, Radius, Shadow, IconBox } from '../../design-system/tokens';
import { useAuth } from '../../context/AuthContext';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = (SCREEN_W - 16 * 2 - 10) / 2;
import {
  fetchLeads,
  fetchLeadDetails,
  deleteLeadApi,
  bulkAssignLeads,
  addLeadFollowUp,
  recordLeadPayment,
  fetchCommonSettings,
  fetchLeadStatisticsCounts,
  CommonSettingItem,
  LeadItem,
  getBadgeColor,
  LeadReceipt,
} from '../../services/leadService';
import { fetchEmployeesSelectionApi } from '../../services/employeeService';

export default function LeadsScreen() {
  const router = useRouter();
  const { user, hasPermission } = useAuth();
  const currentUserId = user?._id || user?.id;

  // ── Determine Tenant Business Type ───────────────────────────────────────────
  const businessType: 'real_estate' | 'corporate' =
    (user?.company?.businessType || user?.companyDetails?.businessType || 'corporate').toLowerCase() === 'real_estate'
      ? 'real_estate'
      : 'corporate';

  // ── State: Data & Loaders ────────────────────────────────────────────────────
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<any>(null);

  // ── Master Settings ──────────────────────────────────────────────────────────
  const [statusesList, setStatusesList] = useState<CommonSettingItem[]>([]);
  const [stagesList, setStagesList] = useState<CommonSettingItem[]>([]);
  const [employeesList, setEmployeesList] = useState<any[]>([]);

  // ── Filter States ────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('All');
  const [typeFilter, setTypeFilter] = useState<'All' | 'company' | 'individual'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchBox, setShowSearchBox] = useState(false);

  // ── Bulk Selection States ────────────────────────────────────────────────────
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);

  // ── Detail Modal States ──────────────────────────────────────────────────────
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadItem | null>(null);
  const [detailTab, setDetailTab] = useState<'details' | 'followups' | 'payments'>('details');

  // ── Follow-Up Modal States ───────────────────────────────────────────────────
  const [followUpModalVisible, setFollowUpModalVisible] = useState(false);
  const [targetLead, setTargetLead] = useState<LeadItem | null>(null);
  const [fuStatus, setFuStatus] = useState('Contacted');
  const [fuStage, setFuStage] = useState('');
  const [fuNextDate, setFuNextDate] = useState('');
  const [fuNotes, setFuNotes] = useState('');
  const [fuLoading, setFuLoading] = useState(false);

  // ── Record Payment Modal States ──────────────────────────────────────────────
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [payTotalAgreed, setPayTotalAgreed] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState('Bank Transfer');
  const [payReference, setPayReference] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [payLoading, setPayLoading] = useState(false);

  // ── 1. Fetch Dynamic Master Settings ─────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [stRes, stgRes, empRes] = await Promise.all([
          fetchCommonSettings('lead_status').catch(() => []),
          fetchCommonSettings('lead_stage').catch(() => []),
          fetchEmployeesSelectionApi(1, 100).catch(() => ({ employees: [] })),
        ]);
        if (stRes.length > 0) setStatusesList(stRes);
        if (stgRes.length > 0) setStagesList(stgRes);
        if (empRes?.employees?.length > 0) setEmployeesList(empRes.employees);
      } catch (err) {
        console.warn('Failed to load settings in LeadsScreen:', err);
      }
    })();
  }, []);

  // ── 2. Load Leads & Stats ────────────────────────────────────────────────────
  const loadLeadsData = useCallback(async (isPull = false) => {
    if (!isPull) setLoading(true);
    try {
      // For macro categories ('All', 'Active', 'Unattended', 'Won', 'Booked'), don't send restricted status to backend
      const isMacroFilter =
        activeTab === 'All' ||
        activeTab.toLowerCase() === 'active' ||
        activeTab.toLowerCase() === 'unattended' ||
        activeTab.toLowerCase().includes('won') ||
        activeTab.toLowerCase().includes('book');

      const apiStatus = !isMacroFilter ? activeTab.toLowerCase() : undefined;

      const res = await fetchLeads({
        page: 1,
        limit: 100,
        status: apiStatus,
        leadType: typeFilter !== 'All' ? typeFilter : undefined,
        search: searchQuery.trim() || undefined,
      });

      if (res && (res.success || Array.isArray(res))) {
        const list = Array.isArray(res)
          ? res
          : (res.items || (Array.isArray(res.data) ? res.data : res.data?.items) || (res as any).leads || []);
        setLeads(list);
        if (res.stats) {
          setStats(res.stats);
        }
      } else {
        setLeads([]);
      }

      // Also refresh stats count
      fetchLeadStatisticsCounts()
        .then((sRes) => {
          if (sRes?.success && sRes.data) {
            setStats((prev: any) => ({ ...prev, ...sRes.data }));
          }
        })
        .catch(() => { });
    } catch (err) {
      console.warn('Failed to load leads:', err);
      setLeads([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, typeFilter, searchQuery]);

  useFocusEffect(
    useCallback(() => {
      loadLeadsData(true);
    }, [loadLeadsData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadLeadsData(true);
  };

  // ── Unattended Red Flag Evaluation (Spec Rule 2.3 & Rule 5) ──────────────────
  const isLeadUnattended = useCallback(
    (lead: LeadItem): boolean => {
      const assignedId = lead.assignedTo?._id || lead.assignedTo?.id || lead.assignedTo;
      const isAssignedToMe = Boolean(
        currentUserId && assignedId && assignedId.toString() === currentUserId.toString()
      );
      const isStatusUnattended = (lead.status || '').toLowerCase() === 'unattended';
      const isStageUnattended = (lead.stage || '').toLowerCase() === 'unattended';
      const paid = lead.paymentDetails?.paidAmount ?? 0;
      const isNotHandled = lead.isUnattended !== false;

      return Boolean(isAssignedToMe && isStatusUnattended && isStageUnattended && paid === 0 && isNotHandled);
    },
    [currentUserId]
  );

  // ── Helper to check if a lead is Won / Booked / Converted ──────────────────
  const isLeadWon = useCallback((lead: LeadItem): boolean => {
    const st = (lead.status || '').toLowerCase();
    const stg = (lead.stage || '').toLowerCase();
    return (
      st === 'won' ||
      stg === 'won' ||
      st.includes('won') ||
      stg.includes('won') ||
      st.includes('book') ||
      stg.includes('book') ||
      st.includes('convert') ||
      stg.includes('convert') ||
      Boolean(lead.convertedProject) ||
      Boolean(lead.convertedCompany) ||
      Boolean(lead.convertedAt)
    );
  }, []);

  // ── Filter Leads based on activeTab, typeFilter, searchQuery ─────────────────
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      // 1. Unattended filter (from Stats card or Tab)
      if (activeTab.toLowerCase() === 'unattended') {
        return isLeadUnattended(lead);
      }

      // 2. Active Pipeline filter (from Stats card or Tab)
      if (activeTab.toLowerCase() === 'active') {
        const st = (lead.status || '').toLowerCase();
        const stg = (lead.stage || '').toLowerCase();
        return (
          !isLeadWon(lead) &&
          !['lost', 'rejected', 'cancelled', 'dropped'].includes(st) &&
          !['lost', 'rejected', 'cancelled', 'dropped'].includes(stg)
        );
      }

      // 3. Won / Booked filter (from Stats card or Tab)
      if (
        activeTab.toLowerCase() === 'won' ||
        activeTab.toLowerCase() === 'booked' ||
        activeTab.toLowerCase().includes('won')
      ) {
        return isLeadWon(lead);
      }

      // 4. Specific Status Tabs (e.g. New, Contacted, Qualified, Proposal, Negotiation, Lost)
      if (activeTab.toLowerCase() !== 'all') {
        const st = (lead.status || '').toLowerCase();
        const stg = (lead.stage || '').toLowerCase();
        const target = activeTab.toLowerCase();
        if (st !== target && stg !== target) {
          return false;
        }
      }

      // 5. Corporate vs Individual record type filter
      if (typeFilter !== 'All') {
        if (lead.leadType !== typeFilter) {
          return false;
        }
      }

      // 6. Search query client-side filtering safety check
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const name = (lead.name || '').toLowerCase();
        const company = (lead.companyName || '').toLowerCase();
        const mobile = (lead.mobile || '').toLowerCase();
        const email = (lead.email || '').toLowerCase();
        const leadId = (lead.leadId || '').toLowerCase();
        if (
          !name.includes(q) &&
          !company.includes(q) &&
          !mobile.includes(q) &&
          !email.includes(q) &&
          !leadId.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [leads, activeTab, typeFilter, searchQuery, isLeadUnattended, isLeadWon]);

  // ── Prioritize Flagged Leads in Sorting ──────────────────────────────────────
  const sortedLeads = useMemo(() => {
    return [...filteredLeads].sort((a, b) => {
      const aFlag = isLeadUnattended(a) ? 1 : 0;
      const bFlag = isLeadUnattended(b) ? 1 : 0;
      if (aFlag !== bFlag) return bFlag - aFlag; // Flagged first
      const aDate = new Date(a.createdAt || 0).getTime();
      const bDate = new Date(b.createdAt || 0).getTime();
      return bDate - aDate;
    });
  }, [filteredLeads, isLeadUnattended]);

  // ── Dynamic Color Badges Lookup (Section 4.3) ────────────────────────────────
  const getStatusColorConfig = (stName?: string) => {
    if (!stName) return getBadgeColor('Grey');
    const matched = statusesList.find((s) => s.name.toLowerCase() === stName.trim().toLowerCase());
    return getBadgeColor(matched?.data?.color);
  };

  const getStageColorConfig = (stgName?: string) => {
    if (!stgName) return getBadgeColor('Grey');
    const matched = stagesList.find((s) => s.name.toLowerCase() === stgName.trim().toLowerCase());
    return getBadgeColor(matched?.data?.color);
  };

  // ── Follow-Up Cascade Logic ──────────────────────────────────────────────────
  const fuAllowedStages = useMemo(() => {
    if (!fuStatus || stagesList.length === 0) return stagesList;
    const filtered = stagesList.filter((sItem) => {
      const allowed = sItem.data?.statuses;
      if (!Array.isArray(allowed) || allowed.length === 0) return true;
      return allowed.some((st) => st.trim().toLowerCase() === fuStatus.trim().toLowerCase());
    });
    return filtered.length > 0 ? filtered : stagesList;
  }, [fuStatus, stagesList]);

  useEffect(() => {
    if (fuAllowedStages.length > 0) {
      const isValid = fuAllowedStages.some(
        (st) => st.name.toLowerCase() === fuStage.toLowerCase()
      );
      if (!isValid) {
        setFuStage(fuAllowedStages[0].name);
      }
    }
  }, [fuAllowedStages, fuStage]);

  // ── Actions: Follow-Up, Payment, Delete, Dial ────────────────────────────────
  const handleOpenFollowUp = (lead: LeadItem) => {
    setTargetLead(lead);
    setFuStatus(lead.status || 'Contacted');
    setFuStage(lead.stage || 'Discovery');
    setFuNextDate('');
    setFuNotes('');
    setFollowUpModalVisible(true);
  };

  const handleSubmitFollowUp = async () => {
    if (!targetLead?._id) return;
    setFuLoading(true);
    try {
      await addLeadFollowUp(targetLead._id, {
        status: fuStatus,
        stage: fuStage,
        nextFollowUpDate: fuNextDate || undefined,
        notes: fuNotes || undefined,
      });
      setFollowUpModalVisible(false);
      Alert.alert('Follow-up Logged', 'Follow-up timeline and lead status updated.');
      loadLeadsData(true);
      if (selectedLead?._id === targetLead._id) {
        fetchLeadDetails(targetLead._id).then((res) => {
          if (res?.success) setSelectedLead(res.data);
        });
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add follow-up.');
    } finally {
      setFuLoading(false);
    }
  };

  const handleOpenPaymentModal = (lead: LeadItem) => {
    setTargetLead(lead);
    setPayTotalAgreed(String(lead.paymentDetails?.totalAgreedAmount || lead.estimatedPrice || ''));
    setPayAmount('');
    setPayMode('Bank Transfer');
    setPayReference('');
    setPayNotes('');
    setPaymentModalVisible(true);
  };

  const handleSubmitPayment = async () => {
    if (!targetLead?._id) return;
    const amountNum = parseFloat(payAmount);
    if (!amountNum || amountNum <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid payment amount.');
      return;
    }

    setPayLoading(true);
    try {
      const totalAgreedNum = payTotalAgreed ? parseFloat(payTotalAgreed) : undefined;
      await recordLeadPayment(targetLead._id, {
        totalAgreedAmount: totalAgreedNum,
        amount: amountNum,
        paymentMode: payMode,
        referenceNo: payReference.trim() || undefined,
        notes: payNotes.trim() || undefined,
      });

      setPaymentModalVisible(false);
      Alert.alert('Payment Recorded', 'Payment receipt created and lead financials updated.');
      loadLeadsData(true);
      if (selectedLead?._id === targetLead._id) {
        fetchLeadDetails(targetLead._id).then((res) => {
          if (res?.success) setSelectedLead(res.data);
        });
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to record payment.');
    } finally {
      setPayLoading(false);
    }
  };

  const handleDeleteLead = (lead: LeadItem) => {
    Alert.alert('Delete Lead', `Are you sure you want to delete "${lead.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteLeadApi(lead._id);
            Alert.alert('Deleted', 'Lead removed successfully.');
            loadLeadsData(true);
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to delete lead.');
          }
        },
      },
    ]);
  };

  const handleCall = (phoneNumber?: string) => {
    if (!phoneNumber) return;
    Linking.openURL(`tel:${phoneNumber}`).catch(() => {
      Alert.alert('Error', 'Unable to open dialer on this device.');
    });
  };

  // ── Bulk Assignment Actions ──────────────────────────────────────────────────
  const toggleSelectLead = (id: string) => {
    setSelectedLeadIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleBulkAssign = async () => {
    if (!selectedAssigneeId) {
      Alert.alert('Select Executive', 'Please choose a sales executive to assign.');
      return;
    }
    setAssignLoading(true);
    try {
      await bulkAssignLeads({
        leadIds: selectedLeadIds,
        assignedTo: selectedAssigneeId,
      });
      setShowAssignModal(false);
      setSelectionMode(false);
      setSelectedLeadIds([]);
      Alert.alert('Success', `Assigned ${selectedLeadIds.length} leads successfully.`);
      loadLeadsData(true);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to bulk assign leads.');
    } finally {
      setAssignLoading(false);
    }
  };

  // ── Stats Calculations for 2x2 Grid (Matching Dashboard/Expenses) ─────────
  const unattendedCount = leads.filter(isLeadUnattended).length;
  const wonCount = leads.filter(isLeadWon).length || (stats?.categoryBookedCount ?? stats?.converted ?? 0);
  const activePipelineCount = leads.filter((l) => {
    const st = (l.status || '').toLowerCase();
    const stg = (l.stage || '').toLowerCase();
    return !isLeadWon(l) && !['lost', 'rejected', 'cancelled', 'dropped'].includes(st) && !['lost', 'rejected', 'cancelled'].includes(stg);
  }).length || (stats?.categoryActiveCount ?? 0);

  const totalCount = leads.length || (stats?.total ?? 0);

  const statsCardsData = [
    {
      label: 'Total Leads',
      value: totalCount,
      icon: 'people-outline',
      color: '#428DFF',
      bgColor: '#EAF2FF',
      filter: 'All',
    },
    {
      label: 'Active Pipeline',
      value: activePipelineCount,
      icon: 'trending-up-outline',
      color: '#FFA05D',
      bgColor: '#FFF5E6',
      filter: 'Active',
    },
    {
      label: 'Won / Booked',
      value: wonCount,
      icon: 'checkmark-circle-outline',
      color: '#10B981',
      bgColor: '#E6FAEE',
      filter: 'Won',
    },
    {
      label: 'Unattended',
      value: unattendedCount,
      icon: 'flag-outline',
      color: '#EF4444',
      bgColor: '#FEE2E2',
      filter: 'Unattended',
    },
  ];

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} translucent />

      {/* Modern HRMS Header */}
      <View style={s.header}>
        <View style={s.headerCircle} />
        <View style={s.headerRow}>
          <TouchableOpacity
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
            style={s.backBtn}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={22} color={Colors.white} />
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {hasPermission('lead.assign') && (
              <TouchableOpacity
                style={[s.headerBtn, selectionMode && s.headerBtnActive]}
                onPress={() => {
                  setSelectionMode((v) => !v);
                  setSelectedLeadIds([]);
                }}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={selectionMode ? 'close' : 'checkbox-outline'}
                  size={15}
                  color={selectionMode ? Colors.primary : Colors.white}
                />
                <Text style={[s.headerBtnTxt, selectionMode && { color: Colors.primary }]}>
                  {selectionMode ? 'Cancel' : 'Select'}
                </Text>
              </TouchableOpacity>
            )}

            {hasPermission('lead.create') && (
              <TouchableOpacity
                style={s.headerBtn}
                onPress={() => router.push({ pathname: '/(tabs)/leads-form', params: { id: '', leadId: '', leadData: '' } } as any)}
                activeOpacity={0.85}
              >
                <Ionicons name="add" size={16} color={Colors.white} />
                <Text style={s.headerBtnTxt}>Add</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <Text style={s.headerTitle}>Lead Management</Text>
        <Text style={s.headerSub}>
          {leads.length} total leads • {businessType === 'real_estate' ? 'Real Estate Mode' : 'Corporate Mode'}
        </Text>
      </View>

      {/* Main Scrollable Body */}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* ── Stats 2x2 Grid (Exact same layout as Dashboard, Expenses & Attendance) ── */}
        <View style={s.statsGrid}>
          {statsCardsData.map((item, i) => {
            const isSelected = activeTab.toLowerCase() === item.filter.toLowerCase();
            return (
              <TouchableOpacity
                key={i}
                style={[
                  s.statCard,
                  { width: CARD_W },
                  Shadow.sm,
                  isSelected && s.statCardSelected,
                ]}
                onPress={() => {
                  setActiveTab(isSelected && item.filter !== 'All' ? 'All' : item.filter);
                }}
                activeOpacity={0.82}
              >
                <View style={[s.statIconBox, { backgroundColor: item.bgColor }]}>
                  <Ionicons name={item.icon as any} size={20} color={item.color} />
                </View>
                <View style={s.statContent}>
                  <Text style={s.statLabel} numberOfLines={1}>{item.label}</Text>
                  <Text style={s.statValue} numberOfLines={1}>{item.value}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Search Input (Matching Expenses & Tasks Search Box) ── */}
        <View style={[s.searchBox, Shadow.sm]}>
          <Ionicons name="search-outline" size={18} color="#94A3B8" />
          <TextInput
            style={s.searchInput}
            placeholder="Search leads by name, company, phone..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            onSubmitEditing={() => loadLeadsData()}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Status Filter Chips (Pill Carousel matching Expenses) ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.categoryScroll} contentContainerStyle={s.categoryScrollContent}>
          {['All', 'Active', 'Unattended', 'New', 'Contacted', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'].map(
            (tab) => {
              const isActive = activeTab.toLowerCase() === tab.toLowerCase();
              return (
                <TouchableOpacity
                  key={tab}
                  style={[s.catChip, isActive && s.catChipActive]}
                  onPress={() => setActiveTab(tab)}
                  activeOpacity={0.8}
                >
                  <Text style={[s.catChipText, isActive && s.catChipTextActive]}>{tab}</Text>
                </TouchableOpacity>
              );
            }
          )}
        </ScrollView>

        {/* Corporate Mode: Lead Type Sub-Filters */}
        {businessType === 'corporate' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[s.categoryScroll, { marginTop: -4 }]} contentContainerStyle={s.categoryScrollContent}>
            <TouchableOpacity
              style={[s.catChip, typeFilter === 'All' && s.catChipActive]}
              onPress={() => setTypeFilter('All')}
              activeOpacity={0.8}
            >
              <Text style={[s.catChipText, typeFilter === 'All' && s.catChipTextActive]}>All Types</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.catChip, typeFilter === 'company' && s.catChipActive]}
              onPress={() => setTypeFilter('company')}
              activeOpacity={0.8}
            >
              <Text style={[s.catChipText, typeFilter === 'company' && s.catChipTextActive]}>🏢 Corporate</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.catChip, typeFilter === 'individual' && s.catChipActive]}
              onPress={() => setTypeFilter('individual')}
              activeOpacity={0.8}
            >
              <Text style={[s.catChipText, typeFilter === 'individual' && s.catChipTextActive]}>👤 Individual</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* ── List Header Row ── */}
        <View style={s.listHeaderRow}>
          <Text style={s.listSectionTitle}>
            {activeTab.toLowerCase().includes('won')
              ? 'Won / Booked Leads'
              : activeTab !== 'All'
                ? `${activeTab} Leads`
                : 'All Pipeline Leads'}
          </Text>
          <Text style={s.listCountText}>{sortedLeads.length} leads</Text>
        </View>
        {loading ? (
          <View style={s.centered}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={s.loadingTxt}>Loading lead pipeline...</Text>
          </View>
        ) : sortedLeads.length === 0 ? (
          <View style={s.emptyBox}>
            <Ionicons name="people-outline" size={54} color={Colors.gray300} />
            <Text style={s.emptyTitle}>No Leads Found</Text>
            <Text style={s.emptySub}>
              {searchQuery ? 'No leads matched your search query.' : 'No leads currently in this stage or category.'}
            </Text>
            {hasPermission('lead.create') && (
              <TouchableOpacity
                style={s.emptyBtn}
                onPress={() => router.push({ pathname: '/(tabs)/leads-form', params: { id: '', leadId: '', leadData: '' } } as any)}
                activeOpacity={0.85}
              >
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={s.emptyBtnTxt}>Create First Lead</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          sortedLeads.map((lead) => {
            const isSelected = selectedLeadIds.includes(lead._id);
            const isFlagged = isLeadUnattended(lead);
            const stColor = getStatusColorConfig(lead.status);
            const stgColor = getStageColorConfig(lead.stage);
            const isWon = isLeadWon(lead);
            const isCorporate = lead.leadType === 'company';
            const initials = (lead.companyName || lead.name || 'L')
              .split(' ')
              .map((w) => w[0])
              .join('')
              .slice(0, 2)
              .toUpperCase();

            const paidAmount = lead.paymentDetails?.paidAmount || 0;
            const totalAgreed = lead.paymentDetails?.totalAgreedAmount || lead.estimatedPrice || 0;
            const balanceDue = totalAgreed - paidAmount;

            return (
              <TouchableOpacity
                key={lead._id}
                style={[s.leadCard, isSelected && s.leadCardSelected, isFlagged && s.leadCardFlagged]}
                activeOpacity={selectionMode ? 0.8 : 0.95}
                onPress={() => {
                  if (selectionMode) {
                    toggleSelectLead(lead._id);
                  } else {
                    setSelectedLead(lead);
                    setDetailTab('details');
                    setDetailModalVisible(true);
                  }
                }}
              >
                {/* Card Top: Checkbox/Avatar + Title + Flag & Badges */}
                <View style={s.cardTopRow}>
                  {selectionMode ? (
                    <TouchableOpacity onPress={() => toggleSelectLead(lead._id)} style={s.selectCheckbox}>
                      <Ionicons
                        name={isSelected ? 'checkbox' : 'square-outline'}
                        size={22}
                        color={isSelected ? Colors.primary : Colors.gray400}
                      />
                    </TouchableOpacity>
                  ) : (
                    <View style={[s.avatar, isCorporate && { backgroundColor: '#E0E7FF' }]}>
                      <Text style={[s.avatarTxt, isCorporate && { color: '#4338ca' }]}>{initials}</Text>
                    </View>
                  )}

                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {lead.leadId && <Text style={s.leadIdBadge}>{lead.leadId}</Text>}
                      {isFlagged && (
                        <View style={s.flagBadge}>
                          <Text style={s.flagText}>🚩 Unattended</Text>
                        </View>
                      )}
                    </View>

                    <Text style={s.cardName} numberOfLines={1}>
                      {isCorporate ? lead.companyName || lead.name : lead.name}
                    </Text>

                    {isCorporate && lead.name && lead.name !== lead.companyName && (
                      <Text style={s.cardContactPerson} numberOfLines={1}>
                        Contact: {lead.name}
                      </Text>
                    )}

                    <View style={s.cardPhoneRow}>
                      <Ionicons name="call-outline" size={11} color={Colors.gray500} />
                      <Text style={s.cardPhoneTxt}>{lead.mobile}</Text>
                      {lead.location ? <Text style={s.cardLocationTxt}>• {lead.location}</Text> : null}
                    </View>
                  </View>

                  {/* Badges: Status First, then Stage (Spec Rule 1 & Rule 2) */}
                  <View style={s.badgeColumn}>
                    <View style={[s.badgeBox, { backgroundColor: stColor.bg, borderColor: stColor.border || stColor.bg }]}>
                      <Text style={[s.badgeTxt, { color: stColor.text }]}>{lead.status}</Text>
                    </View>
                    <View style={[s.badgeBox, { backgroundColor: stgColor.bg, borderColor: stgColor.border || stgColor.bg }]}>
                      <Text style={[s.badgeTxt, { color: stgColor.text }]}>{lead.stage}</Text>
                    </View>
                  </View>
                </View>

                {/* Chips Row: Lead Type, Assigned Executive, Date */}
                <View style={s.cardChipsRow}>
                  <View style={s.cardChip}>
                    <Ionicons
                      name={isCorporate ? 'business-outline' : 'person-outline'}
                      size={11}
                      color={isCorporate ? '#4338ca' : Colors.gray600}
                    />
                    <Text style={s.cardChipTxt}>{isCorporate ? 'Corporate' : 'Individual'}</Text>
                  </View>

                  <View style={s.cardChip}>
                    <Ionicons name="person-circle-outline" size={11} color={Colors.gray500} />
                    <Text style={s.cardChipTxt} numberOfLines={1}>
                      {lead.assignedTo?.name || lead.assignedExecutiveName || 'Unassigned'}
                    </Text>
                  </View>

                  {totalAgreed > 0 && (
                    <View style={[s.cardChip, { backgroundColor: '#F0FDF4' }]}>
                      <Ionicons name="cash-outline" size={11} color="#15803d" />
                      <Text style={[s.cardChipTxt, { color: '#15803d', fontWeight: '700' }]}>
                        ₹{totalAgreed.toLocaleString()}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Corporate Converted Banner (Won) */}
                {isCorporate && (isWon || lead.convertedProject) && (
                  <View style={s.convertedBanner}>
                    <Ionicons name="checkmark-done-circle" size={14} color="#059669" />
                    <Text style={s.convertedBannerTxt}>
                      Converted to Client Company & Project
                    </Text>
                  </View>
                )}

                {/* Individual Payment Progress (Rule 6) */}
                {!isCorporate && totalAgreed > 0 && (
                  <View style={s.paymentProgressBox}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={s.paymentProgressLbl}>Paid: ₹{paidAmount.toLocaleString()}</Text>
                      <Text style={[s.paymentProgressLbl, balanceDue <= 0 && { color: '#059669', fontWeight: '700' }]}>
                        {balanceDue <= 0 ? '✓ 100% Settled' : `Due: ₹${balanceDue.toLocaleString()}`}
                      </Text>
                    </View>
                    <View style={s.progressBarBg}>
                      <View
                        style={[
                          s.progressBarFill,
                          {
                            width: `${Math.min(100, Math.round((paidAmount / totalAgreed) * 100))}%`,
                            backgroundColor: balanceDue <= 0 ? '#10B981' : Colors.primary,
                          },
                        ]}
                      />
                    </View>
                  </View>
                )}

                {/* Card Action Buttons Footer */}
                {!selectionMode && (
                  <View style={s.cardActionsRow}>
                    <TouchableOpacity
                      style={[s.cardActionBtn, { backgroundColor: '#E3F7EB' }]}
                      onPress={() => handleCall(lead.mobile)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="call" size={13} color="#04CA52" />
                      <Text style={[s.cardActionTxt, { color: '#04CA52' }]} numberOfLines={1}>Call</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[s.cardActionBtn, { backgroundColor: '#E6EFFC' }]}
                      onPress={() => handleOpenFollowUp(lead)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="time-outline" size={13} color={Colors.primary} />
                      <Text style={[s.cardActionTxt, { color: Colors.primary }]} numberOfLines={1}>Follow-up</Text>
                    </TouchableOpacity>

                    {!isCorporate && (
                      <TouchableOpacity
                        style={[s.cardActionBtn, { backgroundColor: '#FFF5E6' }]}
                        onPress={() => handleOpenPaymentModal(lead)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="wallet-outline" size={13} color="#FE9A00" />
                        <Text style={[s.cardActionTxt, { color: '#FE9A00' }]} numberOfLines={1}>Payment</Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={[s.cardActionBtn, { backgroundColor: '#F1F5F9' }]}
                      onPress={() => {
                        setSelectedLead(lead);
                        setDetailTab('details');
                        setDetailModalVisible(true);
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="eye-outline" size={13} color={Colors.gray700} />
                      <Text style={[s.cardActionTxt, { color: Colors.gray700 }]} numberOfLines={1}>Details</Text>
                    </TouchableOpacity>

                    {/* Edit Lead Button */}
                    <TouchableOpacity
                      style={[s.cardActionBtn, { backgroundColor: '#EFF6FF' }]}
                      onPress={() => {
                        const targetId = lead._id || (lead as any).id;
                        router.push({
                          pathname: '/(tabs)/leads-form',
                          params: { id: targetId, leadData: JSON.stringify(lead) }
                        } as any);
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="pencil-outline" size={13} color="#2563EB" />
                      <Text style={[s.cardActionTxt, { color: '#2563EB' }]} numberOfLines={1}>Edit</Text>
                    </TouchableOpacity>

                    {/* Delete Lead Button */}
                    <TouchableOpacity
                      style={[s.cardActionBtn, { backgroundColor: '#FEF2F2' }]}
                      onPress={() => handleDeleteLead(lead)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="trash-outline" size={13} color="#EF4444" />
                      <Text style={[s.cardActionTxt, { color: '#EF4444' }]} numberOfLines={1}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Floating Action Button (FAB) for + Add Lead */}
      {hasPermission('lead.create') && !selectionMode && (
        <TouchableOpacity
          style={s.fab}
          onPress={() => router.push({ pathname: '/(tabs)/leads-form', params: { id: '', leadId: '', leadData: '' } } as any)}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={26} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Bulk Assign Action Footer Bar */}
      {selectionMode && selectedLeadIds.length > 0 && (
        <View style={s.bulkFooter}>
          <View style={{ flex: 1 }}>
            <Text style={s.bulkFooterTitle}>{selectedLeadIds.length} Leads Selected</Text>
            <Text style={s.bulkFooterSub}>Assign selected leads to an executive</Text>
          </View>
          <TouchableOpacity
            style={s.bulkAssignBtn}
            onPress={() => setShowAssignModal(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="person-add" size={16} color="#fff" />
            <Text style={s.bulkAssignBtnTxt}>Assign</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── MODAL 1: Bulk Assign Modal ── */}
      <Modal visible={showAssignModal} animationType="fade" transparent onRequestClose={() => setShowAssignModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>Assign {selectedLeadIds.length} Leads</Text>
            <Text style={s.modalSub}>Select a sales executive to assign these records:</Text>

            <ScrollView style={{ maxHeight: 250, marginVertical: 12 }}>
              {employeesList.map((emp) => {
                const empId = emp._id || emp.id || emp.employeeId;
                const isSelected = selectedAssigneeId === empId;
                return (
                  <TouchableOpacity
                    key={empId}
                    style={[s.modalListItem, isSelected && s.modalListItemActive]}
                    onPress={() => setSelectedAssigneeId(empId)}
                  >
                    <Text style={[s.modalListItemTxt, isSelected && { color: Colors.primary, fontWeight: '700' }]}>
                      {emp.name} {emp.employeeId ? `(${emp.employeeId})` : ''}
                    </Text>
                    {isSelected && <Ionicons name="checkmark" size={16} color={Colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={s.modalBtnRow}>
              <TouchableOpacity
                style={s.modalCancelBtn}
                onPress={() => setShowAssignModal(false)}
                disabled={assignLoading}
              >
                <Text style={s.modalCancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.modalConfirmBtn}
                onPress={handleBulkAssign}
                disabled={assignLoading}
              >
                {assignLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={s.modalConfirmTxt}>Confirm Assignment</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── MODAL 2: Add Follow-up Modal with Status & Stage Cascade ── */}
      <Modal visible={followUpModalVisible} animationType="slide" transparent onRequestClose={() => setFollowUpModalVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={s.modalOverlay}
        >
          <View style={[s.modalBox, { maxHeight: '90%' }]}>
            <View style={s.modalHeaderRow}>
              <View>
                <Text style={s.modalTitle}>Log Follow-up</Text>
                <Text style={s.modalSub}>{targetLead?.name || 'Lead'}</Text>
              </View>
              <TouchableOpacity onPress={() => setFollowUpModalVisible(false)}>
                <Ionicons name="close" size={22} color={Colors.gray500} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Macro Status Picker */}
              <Text style={s.inputLabel}>Update Macro Status *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {statusesList.map((st) => {
                  const isSel = fuStatus.toLowerCase() === st.name.toLowerCase();
                  const c = getBadgeColor(st.data?.color);
                  return (
                    <TouchableOpacity
                      key={st._id || st.name}
                      style={[
                        s.fuPickerChip,
                        isSel && { backgroundColor: c.bg, borderColor: c.text },
                      ]}
                      onPress={() => setFuStatus(st.name)}
                    >
                      <Text style={[s.fuPickerChipTxt, isSel && { color: c.text, fontWeight: '700' }]}>
                        {st.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Cascaded Sub-Stage Picker */}
              <Text style={s.inputLabel}>Funnel Stage (Cascaded) *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {fuAllowedStages.map((stg) => {
                  const isSel = fuStage.toLowerCase() === stg.name.toLowerCase();
                  const c = getBadgeColor(stg.data?.color);
                  return (
                    <TouchableOpacity
                      key={stg._id || stg.name}
                      style={[
                        s.fuPickerChip,
                        isSel && { backgroundColor: c.bg, borderColor: c.text },
                      ]}
                      onPress={() => setFuStage(stg.name)}
                    >
                      <Text style={[s.fuPickerChipTxt, isSel && { color: c.text, fontWeight: '700' }]}>
                        {stg.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Next Follow-up Date */}
              <Text style={s.inputLabel}>Next Follow-up Date (Optional)</Text>
              <TextInput
                style={s.formInput}
                placeholder="YYYY-MM-DD (e.g. 2026-11-25)"
                placeholderTextColor={Colors.gray400}
                value={fuNextDate}
                onChangeText={setFuNextDate}
              />

              {/* Discussion Notes */}
              <Text style={s.inputLabel}>Discussion Notes / Outcome *</Text>
              <TextInput
                style={[s.formInput, { height: 80 }]}
                placeholder="Discussed scope, client requested quotation..."
                placeholderTextColor={Colors.gray400}
                multiline
                value={fuNotes}
                onChangeText={setFuNotes}
              />
            </ScrollView>

            <View style={s.modalBtnRow}>
              <TouchableOpacity
                style={s.modalCancelBtn}
                onPress={() => setFollowUpModalVisible(false)}
                disabled={fuLoading}
              >
                <Text style={s.modalCancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.modalConfirmBtn}
                onPress={handleSubmitFollowUp}
                disabled={fuLoading}
              >
                {fuLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={s.modalConfirmTxt}>Save Follow-up</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── MODAL 3: Record Payment Modal with 100% Settled Lock Rule (Rule 3) ── */}
      <Modal visible={paymentModalVisible} animationType="slide" transparent onRequestClose={() => setPaymentModalVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={s.modalOverlay}
        >
          <View style={[s.modalBox, { maxHeight: '90%' }]}>
            <View style={s.modalHeaderRow}>
              <View>
                <Text style={s.modalTitle}>Record Client Payment</Text>
                <Text style={s.modalSub}>Individual Lead: {targetLead?.name}</Text>
              </View>
              <TouchableOpacity onPress={() => setPaymentModalVisible(false)}>
                <Ionicons name="close" size={22} color={Colors.gray500} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Total Agreed Revenue */}
              {(() => {
                const paid = targetLead?.paymentDetails?.paidAmount || 0;
                const total = targetLead?.paymentDetails?.totalAgreedAmount || targetLead?.estimatedPrice || 0;
                const balance = total - paid;
                const is100Settled = balance <= 0 && total > 0;

                return (
                  <>
                    <View style={s.inputGroup}>
                      <Text style={s.inputLabel}>Total Agreed Revenue (₹)</Text>
                      <TextInput
                        style={[s.formInput, is100Settled && s.formInputDisabled]}
                        placeholder="e.g. 50000"
                        placeholderTextColor={Colors.gray400}
                        keyboardType="numeric"
                        editable={!is100Settled}
                        value={payTotalAgreed}
                        onChangeText={setPayTotalAgreed}
                      />
                      {is100Settled && (
                        <Text style={s.lockNotice}>
                          🔒 Value cannot be edited when project is 100% settled.
                        </Text>
                      )}
                    </View>

                    <View style={s.inputGroup}>
                      <Text style={s.inputLabel}>Received Amount (₹) *</Text>
                      <TextInput
                        style={s.formInput}
                        placeholder="e.g. 10000"
                        placeholderTextColor={Colors.gray400}
                        keyboardType="numeric"
                        value={payAmount}
                        onChangeText={setPayAmount}
                      />
                    </View>

                    <Text style={s.inputLabel}>Payment Mode</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                      {['Bank Transfer', 'UPI', 'Cash', 'Cheque', 'Card'].map((mode) => (
                        <TouchableOpacity
                          key={mode}
                          style={[s.fuPickerChip, payMode === mode && s.fuPickerChipActive]}
                          onPress={() => setPayMode(mode)}
                        >
                          <Text style={[s.fuPickerChipTxt, payMode === mode && { color: Colors.primary, fontWeight: '700' }]}>
                            {mode}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>

                    <View style={s.inputGroup}>
                      <Text style={s.inputLabel}>Transaction / Reference No.</Text>
                      <TextInput
                        style={s.formInput}
                        placeholder="e.g. TXN98492042"
                        placeholderTextColor={Colors.gray400}
                        value={payReference}
                        onChangeText={setPayReference}
                      />
                    </View>

                    <View style={s.inputGroup}>
                      <Text style={s.inputLabel}>Receipt Notes</Text>
                      <TextInput
                        style={[s.formInput, { height: 60 }]}
                        placeholder="Advance token, milestone payment..."
                        placeholderTextColor={Colors.gray400}
                        value={payNotes}
                        onChangeText={setPayNotes}
                      />
                    </View>
                  </>
                );
              })()}
            </ScrollView>

            <View style={s.modalBtnRow}>
              <TouchableOpacity
                style={s.modalCancelBtn}
                onPress={() => setPaymentModalVisible(false)}
                disabled={payLoading}
              >
                <Text style={s.modalCancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.modalConfirmBtn}
                onPress={handleSubmitPayment}
                disabled={payLoading}
              >
                {payLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={s.modalConfirmTxt}>Save Receipt</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── MODAL 4: Full Lead Detail & Tabbed Bottom Sheet ── */}
      <Modal visible={detailModalVisible} animationType="slide" transparent onRequestClose={() => setDetailModalVisible(false)}>
        <View style={s.modalOverlay}>
          <View style={[s.modalBox, { maxHeight: '92%', height: '88%' }]}>
            {selectedLead && (
              <>
                <View style={s.modalHeaderRow}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {selectedLead.leadId && <Text style={s.leadIdBadge}>{selectedLead.leadId}</Text>}
                      <Text style={s.modalLeadTypeBadge}>
                        {selectedLead.leadType === 'company' ? '🏢 Corporate' : '👤 Individual'}
                      </Text>
                    </View>
                    <Text style={s.modalTitle} numberOfLines={1}>
                      {selectedLead.companyName || selectedLead.name}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
                    <Ionicons name="close-circle-outline" size={24} color={Colors.gray400} />
                  </TouchableOpacity>
                </View>

                {/* Sub Tabs: Details, Follow-ups, Financials */}
                <View style={s.detailTabRow}>
                  <TouchableOpacity
                    style={[s.detailTabBtn, detailTab === 'details' && s.detailTabBtnActive]}
                    onPress={() => setDetailTab('details')}
                  >
                    <Text style={[s.detailTabTxt, detailTab === 'details' && s.detailTabTxtActive]}>
                      Details
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[s.detailTabBtn, detailTab === 'followups' && s.detailTabBtnActive]}
                    onPress={() => setDetailTab('followups')}
                  >
                    <Text style={[s.detailTabTxt, detailTab === 'followups' && s.detailTabTxtActive]}>
                      Follow-ups ({selectedLead.followUps?.length || 0})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[s.detailTabBtn, detailTab === 'payments' && s.detailTabBtnActive]}
                    onPress={() => setDetailTab('payments')}
                  >
                    <Text style={[s.detailTabTxt, detailTab === 'payments' && s.detailTabTxtActive]}>
                      Financials
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* TAB 1: Details */}
                {detailTab === 'details' && (
                  <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                    <View style={s.detailSection}>
                      <Text style={s.detailSecTitle}>Contact Information</Text>
                      <View style={s.detailGrid}>
                        <View style={s.detailItem}>
                          <Text style={s.detailItemLbl}>Contact Person</Text>
                          <Text style={s.detailItemVal}>{selectedLead.name || '—'}</Text>
                        </View>
                        <View style={s.detailItem}>
                          <Text style={s.detailItemLbl}>Mobile</Text>
                          <Text style={s.detailItemVal}>{selectedLead.mobile || '—'}</Text>
                        </View>
                        <View style={s.detailItem}>
                          <Text style={s.detailItemLbl}>Email</Text>
                          <Text style={s.detailItemVal}>{selectedLead.email || '—'}</Text>
                        </View>
                        <View style={s.detailItem}>
                          <Text style={s.detailItemLbl}>Location</Text>
                          <Text style={s.detailItemVal}>{selectedLead.location || '—'}</Text>
                        </View>
                      </View>
                    </View>

                    {/* Corporate Specific Details */}
                    {selectedLead.leadType === 'company' && selectedLead.corporateDetails && (
                      <View style={s.detailSection}>
                        <Text style={s.detailSecTitle}>Corporate Profile</Text>
                        <View style={s.detailGrid}>
                          <View style={s.detailItem}>
                            <Text style={s.detailItemLbl}>Company Name</Text>
                            <Text style={s.detailItemVal}>{selectedLead.corporateDetails.companyName || '—'}</Text>
                          </View>
                          <View style={s.detailItem}>
                            <Text style={s.detailItemLbl}>Designation</Text>
                            <Text style={s.detailItemVal}>{selectedLead.corporateDetails.contactPersonDesignation || '—'}</Text>
                          </View>
                          <View style={s.detailItem}>
                            <Text style={s.detailItemLbl}>GST Number</Text>
                            <Text style={s.detailItemVal}>{selectedLead.corporateDetails.gstNumber || '—'}</Text>
                          </View>
                          <View style={s.detailItem}>
                            <Text style={s.detailItemLbl}>Industry</Text>
                            <Text style={s.detailItemVal}>{selectedLead.corporateDetails.industryType || '—'}</Text>
                          </View>
                          <View style={s.detailItem}>
                            <Text style={s.detailItemLbl}>Website</Text>
                            <Text style={s.detailItemVal}>{selectedLead.corporateDetails.website || '—'}</Text>
                          </View>
                        </View>
                      </View>
                    )}

                    {/* Individual Specific Details */}
                    {selectedLead.leadType === 'individual' && selectedLead.individualDetails && (
                      <View style={s.detailSection}>
                        <Text style={s.detailSecTitle}>Individual Profile</Text>
                        <View style={s.detailGrid}>
                          <View style={s.detailItem}>
                            <Text style={s.detailItemLbl}>PAN Number</Text>
                            <Text style={s.detailItemVal}>{selectedLead.individualDetails.panNumber || '—'}</Text>
                          </View>
                          <View style={s.detailItem}>
                            <Text style={s.detailItemLbl}>Aadhaar</Text>
                            <Text style={s.detailItemVal}>{selectedLead.individualDetails.aadhaarNumber || '—'}</Text>
                          </View>
                          <View style={s.detailItem}>
                            <Text style={s.detailItemLbl}>Occupation</Text>
                            <Text style={s.detailItemVal}>{selectedLead.individualDetails.occupation || '—'}</Text>
                          </View>
                          <View style={s.detailItem}>
                            <Text style={s.detailItemLbl}>Preferred Area</Text>
                            <Text style={s.detailItemVal}>{selectedLead.individualDetails.preferredLocation || '—'}</Text>
                          </View>
                        </View>
                      </View>
                    )}

                    {/* Converted Company / Project Info (Section 2.1) */}
                    {selectedLead.convertedProject && (
                      <View style={s.convertedBox}>
                        <Ionicons name="business" size={20} color="#059669" />
                        <View style={{ flex: 1 }}>
                          <Text style={s.convertedBoxTitle}>Converted to Project</Text>
                          <Text style={s.convertedBoxSub}>
                            This corporate lead was closed as Won and migrated to the Client Company & Projects module.
                          </Text>
                          <TouchableOpacity
                            style={s.goToProjectBtn}
                            onPress={() => {
                              setDetailModalVisible(false);
                              router.push('/projects' as any);
                            }}
                          >
                            <Text style={s.goToProjectBtnTxt}>Open Projects Module</Text>
                            <Ionicons name="arrow-forward" size={14} color="#fff" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </ScrollView>
                )}

                {/* TAB 2: Follow-ups Timeline */}
                {detailTab === 'followups' && (
                  <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <Text style={s.detailSecTitle}>Timeline History</Text>
                      <TouchableOpacity
                        style={s.inlineAddBtn}
                        onPress={() => {
                          setDetailModalVisible(false);
                          handleOpenFollowUp(selectedLead);
                        }}
                      >
                        <Ionicons name="add" size={14} color="#fff" />
                        <Text style={s.inlineAddBtnTxt}>Add Follow-up</Text>
                      </TouchableOpacity>
                    </View>

                    {(!selectedLead.followUps || selectedLead.followUps.length === 0) ? (
                      <View style={s.emptyTimeline}>
                        <Text style={{ fontSize: 13, color: Colors.gray400 }}>No follow-up entries logged yet.</Text>
                      </View>
                    ) : (
                      selectedLead.followUps.map((fu, idx) => (
                        <View key={idx} style={s.timelineItem}>
                          <View style={s.timelineDot} />
                          <View style={s.timelineContent}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                              <Text style={s.timelineStatus}>{fu.status} ({fu.stage})</Text>
                              <Text style={s.timelineDate}>{fu.date ? new Date(fu.date).toLocaleDateString() : ''}</Text>
                            </View>
                            {fu.notes ? <Text style={s.timelineNotes}>{fu.notes.replace(/<[^>]*>/g, '')}</Text> : null}
                            {fu.nextFollowUpDate || fu.nextFollowUp ? (
                              <Text style={s.timelineNextDate}>
                                Next Follow-up: {fu.nextFollowUpDate || fu.nextFollowUp}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                      ))
                    )}
                  </ScrollView>
                )}

                {/* TAB 3: Financials & Receipts (Rule 6) */}
                {detailTab === 'payments' && (
                  <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                    {selectedLead.leadType === 'company' && selectedLead.convertedProject ? (
                      <View style={s.paymentLockPill}>
                        <Ionicons name="information-circle" size={20} color={Colors.primary} />
                        <View style={{ flex: 1 }}>
                          <Text style={s.paymentLockTitle}>Payment Management Locked</Text>
                          <Text style={s.paymentLockSub}>
                            Converted to Project — Payments, milestones, and receipts are managed under Project Details.
                          </Text>
                          <TouchableOpacity
                            style={s.goToProjectBtn}
                            onPress={() => {
                              setDetailModalVisible(false);
                              router.push('/projects' as any);
                            }}
                          >
                            <Text style={s.goToProjectBtnTxt}>Open Project Financials</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <>
                        {/* Summary Cards */}
                        <View style={s.financialSummaryRow}>
                          <View style={s.finCard}>
                            <Text style={s.finCardLbl}>Total Agreed</Text>
                            <Text style={s.finCardVal}>
                              ₹{(selectedLead.paymentDetails?.totalAgreedAmount || selectedLead.estimatedPrice || 0).toLocaleString()}
                            </Text>
                          </View>
                          <View style={s.finCard}>
                            <Text style={s.finCardLbl}>Paid Amount</Text>
                            <Text style={[s.finCardVal, { color: '#059669' }]}>
                              ₹{(selectedLead.paymentDetails?.paidAmount || 0).toLocaleString()}
                            </Text>
                          </View>
                          <View style={s.finCard}>
                            <Text style={s.finCardLbl}>Balance</Text>
                            <Text style={[s.finCardVal, { color: '#DC2626' }]}>
                              ₹{(
                                (selectedLead.paymentDetails?.totalAgreedAmount || selectedLead.estimatedPrice || 0) -
                                (selectedLead.paymentDetails?.paidAmount || 0)
                              ).toLocaleString()}
                            </Text>
                          </View>
                        </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 12 }}>
                          <Text style={s.detailSecTitle}>Payment Receipts</Text>
                          <TouchableOpacity
                            style={s.inlineAddBtn}
                            onPress={() => {
                              setDetailModalVisible(false);
                              handleOpenPaymentModal(selectedLead);
                            }}
                          >
                            <Ionicons name="add" size={14} color="#fff" />
                            <Text style={s.inlineAddBtnTxt}>Record Receipt</Text>
                          </TouchableOpacity>
                        </View>

                        {(!selectedLead.paymentDetails?.receipts || selectedLead.paymentDetails.receipts.length === 0) ? (
                          <View style={s.emptyTimeline}>
                            <Text style={{ fontSize: 13, color: Colors.gray400 }}>No payments recorded yet.</Text>
                          </View>
                        ) : (
                          selectedLead.paymentDetails.receipts.map((rcp: LeadReceipt, i: number) => (
                            <View key={i} style={s.receiptRow}>
                              <View style={s.receiptIconCircle}>
                                <Ionicons name="receipt-outline" size={16} color={Colors.primary} />
                              </View>
                              <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                  <Text style={s.receiptNo}>{rcp.receiptNo || `RCP-${i + 1}`}</Text>
                                  <Text style={s.receiptAmount}>₹{rcp.amount.toLocaleString()}</Text>
                                </View>
                                <Text style={s.receiptMeta}>
                                  {rcp.paymentMode} • {rcp.date ? new Date(rcp.date).toLocaleDateString() : ''}
                                  {rcp.referenceNo ? ` • Ref: ${rcp.referenceNo}` : ''}
                                </Text>
                                {rcp.notes ? <Text style={s.receiptNotes}>{rcp.notes}</Text> : null}
                              </View>
                            </View>
                          ))
                        )}
                      </>
                    )}
                  </ScrollView>
                )}

                <View style={s.modalBtnRow}>
                  <TouchableOpacity
                    style={[s.modalCancelBtn, { borderColor: '#DBEAFE', backgroundColor: '#EFF6FF' }]}
                    onPress={() => {
                      const targetId = selectedLead._id || (selectedLead as any).id;
                      setDetailModalVisible(false);
                      router.push({
                        pathname: '/(tabs)/leads-form',
                        params: { id: targetId, leadData: JSON.stringify(selectedLead) }
                      } as any);
                    }}
                  >
                    <Ionicons name="pencil" size={14} color="#2563EB" style={{ marginRight: 4 }} />
                    <Text style={[s.modalCancelTxt, { color: '#2563EB', fontWeight: '700' }]}>Edit</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[s.modalCancelBtn, { borderColor: Colors.dangerLight, backgroundColor: '#FEF2F2' }]}
                    onPress={() => {
                      setDetailModalVisible(false);
                      handleDeleteLead(selectedLead);
                    }}
                  >
                    <Ionicons name="trash-outline" size={14} color={Colors.danger} style={{ marginRight: 4 }} />
                    <Text style={[s.modalCancelTxt, { color: Colors.danger, fontWeight: '700' }]}>Delete</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={s.modalConfirmBtn}
                    onPress={() => setDetailModalVisible(false)}
                  >
                    <Text style={s.modalConfirmTxt}>Close</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.white },
  header: {
    backgroundColor: Colors.primary,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 12 : 56,
    paddingHorizontal: Spacing[4],
    paddingBottom: Spacing[4],
    overflow: 'hidden',
  },
  headerCircle: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(96,165,250,0.15)',
    top: -60,
    right: -40,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  backBtn: { padding: 4 },
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
  },
  headerBtnActive: {
    backgroundColor: Colors.white,
  },
  headerBtnTxt: {
    fontSize: Typography.fontSize.xs,
    color: Colors.white,
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: '800',
    color: Colors.white,
    marginBottom: 2,
  },
  headerSub: {
    fontSize: Typography.fontSize.sm,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: Spacing[3],
  },
  // ── Stats 2x2 Grid (Matching Dashboard & Expenses) ───────────────
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  statCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  statCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#F0F7FF',
  },
  statIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    ...IconBox.shadow as any,
  },
  statContent: {
    flex: 1,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#45556C',
    marginBottom: 3,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#163E57',
    letterSpacing: -0.3,
  },

  // ── Search Box (Matching Expenses & Tasks) ────────────────────────
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    marginBottom: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray900,
  },

  // ── Filter Chips (Matching Expenses categoryScroll) ──────────────
  categoryScroll: {
    marginBottom: 14,
  },
  categoryScrollContent: {
    gap: 8,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.full,
  },
  catChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  catChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.gray600,
  },
  catChipTextActive: {
    color: Colors.white,
    fontWeight: '700',
  },

  // ── List Header Row ──────────────────────────────────────────────
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  listSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    letterSpacing: -0.2,
  },
  listCountText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },

  scroll: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { padding: Spacing[4] },
  centered: { paddingVertical: 50, alignItems: 'center' },
  loadingTxt: { marginTop: 10, fontSize: Typography.fontSize.sm, color: Colors.gray500 },
  emptyBox: { paddingVertical: 60, alignItems: 'center', paddingHorizontal: 30 },
  emptyTitle: { fontSize: Typography.fontSize.md, fontWeight: '700', color: Colors.gray800, marginTop: 12 },
  emptySub: { fontSize: Typography.fontSize.sm, color: Colors.gray500, textAlign: 'center', marginTop: 4, lineHeight: 18 },
  emptyBtn: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: Radius.md,
    marginTop: 16,
  },
  emptyBtnTxt: { color: '#fff', fontSize: Typography.fontSize.sm, fontWeight: '700' },

  leadCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing[4],
    marginBottom: Spacing[3],
    ...Shadow.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  leadCardSelected: { borderColor: Colors.primary, backgroundColor: '#F8FAFF' },
  leadCardFlagged: { borderColor: '#FCA5A5', backgroundColor: '#FFFDFD' },
  cardTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  selectCheckbox: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  avatar: {
    width: IconBox.size,
    height: IconBox.size,
    borderRadius: IconBox.radius,
    backgroundColor: IconBox.bg,
    alignItems: 'center',
    justifyContent: 'center',
    ...IconBox.shadow as any,
  },
  avatarTxt: { fontSize: 14, fontWeight: '800', color: Colors.primary },
  leadIdBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.gray500,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.xs,
  },
  flagBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Radius.xs,
  },
  flagText: { fontSize: 10, fontWeight: '800', color: '#DC2626' },
  cardName: { fontSize: Typography.fontSize.base, fontWeight: '700', color: Colors.gray900, marginTop: 4 },
  cardContactPerson: { fontSize: Typography.fontSize.xs, color: Colors.gray500, marginTop: 2 },
  cardPhoneRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  cardPhoneTxt: { fontSize: Typography.fontSize.xs, color: Colors.gray600, fontWeight: '600' },
  cardLocationTxt: { fontSize: Typography.fontSize.xs, color: Colors.gray400 },
  badgeColumn: { alignItems: 'flex-end', gap: 4 },
  badgeBox: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  badgeTxt: { fontSize: 10, fontWeight: '700' },
  cardChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  cardChipTxt: { fontSize: 11, color: Colors.gray600, fontWeight: '600', maxWidth: 140 },
  convertedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.md,
    marginTop: 10,
  },
  convertedBannerTxt: { fontSize: 11, color: '#065F46', fontWeight: '700' },
  paymentProgressBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: Radius.md,
    padding: 10,
    marginTop: 10,
  },
  paymentProgressLbl: { fontSize: 11, color: Colors.gray600, fontWeight: '600' },
  progressBarBg: { height: 6, backgroundColor: '#E2E8F0', borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 3 },
  cardActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginTop: 12,
    paddingTop: 10,
  },
  cardActionBtn: {
    minWidth: '30%',
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 32,
    gap: 4,
    paddingHorizontal: 8,
    borderRadius: Radius.md,
  },
  cardActionTxt: {
    fontSize: 11,
    fontWeight: '700',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 84,
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.md,
    elevation: 25,
    zIndex: 999,
  },
  bulkFooter: {
    position: 'absolute',
    bottom: 64,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    ...Shadow.md,
    elevation: 30,
    zIndex: 1000,
  },
  bulkFooterTitle: { fontSize: 13, fontWeight: '800', color: Colors.gray900 },
  bulkFooterSub: { fontSize: 11, color: Colors.gray500 },
  bulkAssignBtn: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    height: 38,
    borderRadius: 8,
  },
  bulkAssignBtnTxt: { color: '#fff', fontSize: 12, fontWeight: '700' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 18,
    ...Shadow.lg,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: Colors.gray900 },
  modalSub: { fontSize: 12, color: Colors.gray500, marginTop: 2 },
  modalLeadTypeBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4338ca',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  detailTabRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
    marginBottom: 14,
  },
  detailTabBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 8,
  },
  detailTabBtnActive: { backgroundColor: '#fff', ...Shadow.sm },
  detailTabTxt: { fontSize: 11, fontWeight: '600', color: Colors.gray500 },
  detailTabTxtActive: { color: Colors.primary, fontWeight: '700' },
  detailSection: { marginBottom: 14 },
  detailSecTitle: { fontSize: 13, fontWeight: '700', color: Colors.gray800, marginBottom: 8 },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 10,
  },
  detailItem: { width: '48%', marginBottom: 4 },
  detailItemLbl: { fontSize: 10, color: Colors.gray400, fontWeight: '600' },
  detailItemVal: { fontSize: 12, color: Colors.gray800, fontWeight: '600', marginTop: 1 },
  convertedBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  convertedBoxTitle: { fontSize: 13, fontWeight: '700', color: '#065F46' },
  convertedBoxSub: { fontSize: 11, color: '#047857', marginTop: 2, lineHeight: 16 },
  goToProjectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  goToProjectBtnTxt: { color: '#fff', fontSize: 11, fontWeight: '700' },
  paymentLockPill: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 12,
    padding: 14,
  },
  paymentLockTitle: { fontSize: 13, fontWeight: '700', color: '#1E40AF' },
  paymentLockSub: { fontSize: 11, color: '#1D4ED8', marginTop: 2, lineHeight: 16 },
  financialSummaryRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  finCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  finCardLbl: { fontSize: 10, color: Colors.gray500, fontWeight: '600' },
  finCardVal: { fontSize: 13, fontWeight: '800', color: Colors.gray900, marginTop: 2 },
  inlineAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  inlineAddBtnTxt: { color: '#fff', fontSize: 11, fontWeight: '700' },
  emptyTimeline: { paddingVertical: 20, alignItems: 'center' },
  timelineItem: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
    paddingLeft: 4,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginTop: 5,
  },
  timelineContent: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
  },
  timelineStatus: { fontSize: 12, fontWeight: '700', color: Colors.gray800 },
  timelineDate: { fontSize: 10, color: Colors.gray400 },
  timelineNotes: { fontSize: 11, color: Colors.gray600, marginTop: 4, lineHeight: 16 },
  timelineNextDate: { fontSize: 10, color: Colors.primary, fontWeight: '600', marginTop: 4 },
  receiptRow: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  receiptIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptNo: { fontSize: 12, fontWeight: '700', color: Colors.gray800 },
  receiptAmount: { fontSize: 12, fontWeight: '800', color: '#059669' },
  receiptMeta: { fontSize: 10, color: Colors.gray500, marginTop: 2 },
  receiptNotes: { fontSize: 10, color: Colors.gray600, marginTop: 2, fontStyle: 'italic' },
  inputGroup: { marginBottom: 10 },
  inputLabel: { fontSize: 11, fontWeight: '600', color: Colors.gray700, marginBottom: 5 },
  formInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: Colors.gray900,
  },
  formInputDisabled: { backgroundColor: '#F1F5F9', color: Colors.gray400 },
  lockNotice: { fontSize: 10, color: '#D97706', marginTop: 4, fontWeight: '600' },
  fuPickerChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 6,
  },
  fuPickerChipActive: { backgroundColor: '#EFF6FF', borderColor: Colors.primary },
  fuPickerChipTxt: { fontSize: 11, color: Colors.gray600, fontWeight: '600' },
  modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalCancelTxt: { fontSize: 12, fontWeight: '600', color: Colors.gray600 },
  modalConfirmBtn: {
    flex: 2,
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalConfirmTxt: { fontSize: 12, fontWeight: '700', color: '#fff' },
  modalListItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalListItemActive: { backgroundColor: '#F0F9FF' },
  modalListItemTxt: { fontSize: 13, color: Colors.gray800 },
});
