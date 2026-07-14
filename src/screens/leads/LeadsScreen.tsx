import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, StatusBar, RefreshControl, TextInput, Modal,
  ActivityIndicator, Alert, KeyboardAvoidingView
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Radius, Shadow } from '../../design-system/tokens';
import { mockLeads, mockEmployees, Lead } from '../../data/mockData';
import {
  fetchLeads,
  bulkAssignLeads,
  importLeads,
  updateLeadStatusApi,
  deleteLeadApi,
  FetchLeadsParams,
  fetchAllLeads,
  fetchLeadStatisticsCounts,
  fetchLeadDetails,
  updateLeadApi,
} from '../../services/leadService';
import { fetchProfile } from '../../services/authService';

const STATUS_CONFIG: Record<string, { color: string; bg: string }> = {
  New: { color: '#4DA8DA', bg: '#E1F0FA' },
  Qualified: { color: '#34D399', bg: '#D1FAE5' },
  Proposal: { color: '#FBBF24', bg: '#FEF3C7' },
  Negotiation: { color: '#F87171', bg: '#FEE2E2' },
  Contacted: { color: '#8B5CF6', bg: '#F3E8FF' },
  Won: { color: '#059669', bg: '#A7F3D0' },
  Lost: { color: '#9CA3AF', bg: '#F3F4F6' },
};

function StatusBadge({ status }: { status: string }) {
  const normalized = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  const cfg = STATUS_CONFIG[normalized] ?? { color: Colors.gray500, bg: Colors.gray100 };
  return (
    <View style={[s.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[s.badgeTxt, { color: cfg.color }]}>{normalized}</Text>
    </View>
  );
}

const normalizeLead = (item: any): Lead => {
  let uiStatus = 'New';
  if (item.status) {
    const sLower = item.status.toLowerCase();
    if (sLower === 'proposal_sent' || sLower === 'proposal') uiStatus = 'Proposal';
    else if (sLower === 'in_progress' || sLower === 'in progress') uiStatus = 'In Progress';
    else if (sLower === 'on_hold' || sLower === 'on hold') uiStatus = 'On Hold';
    else uiStatus = sLower.charAt(0).toUpperCase() + sLower.slice(1);
  }

  return {
    id: item._id || item.id || '',
    fullName: item.name || item.fullName || 'Unnamed Lead',
    mobile: item.mobile || '',
    email: item.email || '',
    leadType: item.leadType || 'SME',
    status: uiStatus,
    assignedTo: item.assignedTo && typeof item.assignedTo === 'object' ? item.assignedTo.name : (item.assignedTo || 'Unassigned'),
    followUpType: item.followUpType || 'Call',
    followUpDate: item.followUpDate || '',
    leadSource: item.leadSource || 'Website',
    notes: item.notes || '',
    createdAt: item.createdAt ? new Date(item.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
  };
};

interface LeadCardProps {
  lead: Lead;
  selectionMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onFollowUpPress: () => void;
  onDeletePress?: () => void;
}

function LeadCard({ lead, selectionMode, selected, onToggleSelect, onFollowUpPress, onDeletePress }: LeadCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const initials = lead.fullName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <TouchableOpacity
      style={[s.card, selected && s.cardSelected]}
      activeOpacity={selectionMode ? 0.8 : 1}
      onPress={() => selectionMode ? onToggleSelect() : undefined}
    >
      <View style={s.cardTop}>
        {selectionMode ? (
          <TouchableOpacity style={s.checkbox} onPress={onToggleSelect}>
            <Ionicons
              name={selected ? "checkbox" : "square-outline"}
              size={22}
              color={selected ? Colors.primary : Colors.gray400}
            />
          </TouchableOpacity>
        ) : (
          <View style={s.avatar}>
            <Text style={s.avatarTxt}>{initials}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={s.cardName} numberOfLines={1}>{lead.fullName}</Text>
          <View style={s.metaRow}>
            <Ionicons name="call-outline" size={11} color={Colors.gray400} />
            <Text style={s.metaTxt}>{lead.mobile}</Text>
          </View>
        </View>
        <StatusBadge status={lead.status} />
      </View>

      <View style={s.chips}>
        <View style={s.chip}>
          <Ionicons name="pricetag-outline" size={11} color={Colors.primary} />
          <Text style={s.chipTxt}>{lead.leadType}</Text>
        </View>
        <View style={s.chip}>
          <Ionicons name="person-outline" size={11} color={Colors.gray500} />
          <Text style={s.chipTxt} numberOfLines={1}>{lead.assignedTo}</Text>
        </View>
        <View style={s.chip}>
          <Ionicons name="calendar-outline" size={11} color={Colors.gray500} />
          <Text style={s.chipTxt}>{lead.createdAt}</Text>
        </View>
      </View>

      {!selectionMode && (
        <View style={s.actions}>
          <TouchableOpacity style={s.actionBtn} activeOpacity={0.7}>
            <Ionicons name="call" size={15} color="#34D399" />
            <Text style={[s.actionTxt, { color: '#34D399' }]}>Call</Text>
          </TouchableOpacity>

          <View style={s.actionDiv} />

          <TouchableOpacity style={s.actionBtn} activeOpacity={0.7} onPress={onFollowUpPress}>
            <Ionicons name="create-outline" size={15} color={Colors.primary} />
            <Text style={[s.actionTxt, { color: Colors.primary }]}>Edit</Text>
          </TouchableOpacity>

          <View style={s.actionDiv} />

          <TouchableOpacity style={s.actionBtn} activeOpacity={0.7} onPress={onFollowUpPress}>
            <Ionicons name="alarm-outline" size={15} color="#FBBF24" />
            <Text style={[s.actionTxt, { color: '#FBBF24' }]}>Follow-up</Text>
          </TouchableOpacity>

          <View style={s.actionDiv} />
          <TouchableOpacity style={s.actionBtn} onPress={() => setMenuOpen(v => !v)}>
            <Ionicons name="ellipsis-horizontal" size={15} color={Colors.gray500} />
            <Text style={[s.actionTxt, { color: Colors.gray500 }]}>More</Text>
          </TouchableOpacity>
        </View>
      )}

      {menuOpen && !selectionMode && (
        <View style={s.menu}>
          {['View Details', 'Send Email', 'Convert to Deal', 'Delete'].map(item => (
            <TouchableOpacity
              key={item}
              style={s.menuItem}
              onPress={() => {
                setMenuOpen(false);
                if (item === 'Delete' && onDeletePress) {
                  onDeletePress();
                }
              }}
            >
              <Text style={[s.menuTxt, item === 'Delete' && { color: Colors.danger }]}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

const FILTERS = ['All', 'New', 'Qualified', 'Proposal', 'Negotiation', 'Contacted'];

export default function LeadsScreen() {
  const router = useRouter();

  // Leads data state
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Role & Admin Leads Stats State
  const [userRole, setUserRole] = useState<'employee' | 'superadmin' | 'hr' | 'manager'>('employee');
  const [adminStats, setAdminStats] = useState<any>(null);

  // Filters & Search
  const [filter, setFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchBox, setShowSearchBox] = useState(false);

  // Bulk Selection States
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);

  // Assign Modal States
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState('MM-001');
  const [assignLoading, setAssignLoading] = useState(false);

  // Import Modal States
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedImportFile, setSelectedImportFile] = useState('Sales_Leads_June.xlsx');
  const [importCount, setImportCount] = useState('100');
  const [importLoading, setImportLoading] = useState(false);

  // Follow-up Modal States
  const [followUpLead, setFollowUpLead] = useState<Lead | null>(null);
  const [followUpStatus, setFollowUpStatus] = useState('contacted');
  const [followUpSubStatus, setFollowUpSubStatus] = useState('Interested');
  const [followUpNotes, setFollowUpNotes] = useState('');
  const [followUpNextDate, setFollowUpNextDate] = useState('');
  const [followUpLoading, setFollowUpLoading] = useState(false);

  // ── Load Role Check & Statistics ──
  useEffect(() => {
    const checkRoleAndLoadStats = async () => {
      try {
        const profileData = await fetchProfile();
        if (profileData && profileData.user) {
          const role = profileData.user.role || 'employee';
          setUserRole(role);
          if (role === 'superadmin' || role === 'hr' || role === 'manager') {
            const statsRes = await fetchLeadStatisticsCounts().catch(() => null);
            if (statsRes && statsRes.success) {
              setAdminStats(statsRes.data);
            }
          }
        }
      } catch (err) {
        console.warn('Failed to load profile/stats for LeadsScreen:', err);
      }
    };
    checkRoleAndLoadStats();
  }, []);

  const loadLeads = async (showIndicator = true) => {
    if (showIndicator) setLoading(true);
    try {
      if (userRole === 'superadmin' || userRole === 'hr' || userRole === 'manager') {
        const apiStatus = filter !== 'All' ? filter : undefined;
        const res = await fetchAllLeads({
          page: 1,
          limit: 100,
          status: apiStatus
        });
        if (res && res.success && Array.isArray(res.data)) {
          setLeads(res.data.map(normalizeLead));
        } else {
          setLeads([]);
        }
      } else {
        const params: FetchLeadsParams = {};
        if (filter !== 'All') {
          params.status = filter.toLowerCase();
        }
        if (searchQuery.trim()) {
          params.search = searchQuery.trim();
        }

        const res = await fetchLeads(params);

        let list: any[] = [];
        if (res && res.success) {
          list = res.items || res.data || [];
        } else if (Array.isArray(res)) {
          list = res;
        }
        setLeads(list.map(normalizeLead));
      }
    } catch (err) {
      console.warn('Failed to load leads from API:', err);
      setLeads([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadLeads();
  }, [filter, searchQuery, userRole]);

  const onRefresh = () => {
    setRefreshing(true);
    loadLeads(false);
  };

  // Toggle selection on a card
  const handleToggleSelect = (id: string) => {
    setSelectedLeadIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Turn on selection mode
  const handleStartSelection = () => {
    setSelectionMode(true);
    setSelectedLeadIds([]);
  };

  // Cancel selection mode
  const handleCancelSelection = () => {
    setSelectionMode(false);
    setSelectedLeadIds([]);
  };

  // Handle Bulk Assign Submit
  const handleBulkAssignSubmit = async () => {
    if (selectedLeadIds.length === 0) {
      Alert.alert('Error', 'Please select at least one lead.');
      return;
    }
    setAssignLoading(true);
    try {
      const assigneeObj = mockEmployees.find(e => e.id === selectedAssigneeId);
      const assigneeName = assigneeObj ? assigneeObj.name : 'Unassigned';

      await bulkAssignLeads({
        leadIds: selectedLeadIds,
        assignedTo: selectedAssigneeId
      });

      Alert.alert('Success', 'Leads assigned successfully.');
      setShowAssignModal(false);

      setLeads(prev =>
        prev.map(l => selectedLeadIds.includes(l.id) ? { ...l, assignedTo: assigneeName } : l)
      );
      handleCancelSelection();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to bulk assign leads.');
    } finally {
      setAssignLoading(false);
    }
  };

  // Handle Excel Import Submit
  const handleImportSubmit = async () => {
    setImportLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: 'file://mock/spreadsheets/' + selectedImportFile,
        name: selectedImportFile,
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      } as any);

      const res = await importLeads(formData);

      const count = res.count || parseInt(importCount) || 10;
      Alert.alert('Success', `Leads imported successfully! Total imported: ${count}`);
      setShowImportModal(false);
      loadLeads(false);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to import leads.');
    } finally {
      setImportLoading(false);
    }
  };

  // Handle Open Followup Modal
  const openFollowUpModal = (lead: Lead) => {
    setFollowUpLead(lead);
    setFollowUpStatus(lead.status.toLowerCase());
    setFollowUpSubStatus('Interested');
    setFollowUpNotes(lead.notes || '');
    setFollowUpNextDate(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  };

  // Handle Follow Up stage changes submit
  const handleFollowUpSubmit = async () => {
    if (!followUpLead) return;
    setFollowUpLoading(true);
    try {
      let apiStatus = followUpStatus.toLowerCase();
      if (apiStatus === 'proposal') {
        apiStatus = 'proposal_sent';
      } else if (apiStatus === 'in progress' || apiStatus === 'in-progress') {
        apiStatus = 'in_progress';
      }

      if (userRole === 'superadmin' || userRole === 'hr' || userRole === 'manager') {
        const payload = {
          status: followUpStatus.charAt(0).toUpperCase() + followUpStatus.slice(1).toLowerCase(),
          note: followUpNotes.trim() || 'Status updated by Admin'
        };
        await updateLeadApi(followUpLead.id, payload);
      } else {
        const payload = {
          status: apiStatus,
          subStatus: followUpSubStatus.trim() || undefined,
          notes: followUpNotes.trim() || undefined,
          nextFollowUp: followUpNextDate ? new Date(followUpNextDate).toISOString() : undefined
        };
        await updateLeadStatusApi(followUpLead.id, payload);
      }
      Alert.alert('Success', 'Lead stage and notes updated successfully.');
      setFollowUpLead(null);

      let uiStatus = 'New';
      const sLower = followUpStatus.toLowerCase();
      if (sLower === 'proposal_sent' || sLower === 'proposal') uiStatus = 'Proposal';
      else if (sLower === 'in_progress' || sLower === 'in progress') uiStatus = 'In Progress';
      else if (sLower === 'on_hold' || sLower === 'on hold') uiStatus = 'On Hold';
      else uiStatus = sLower.charAt(0).toUpperCase() + sLower.slice(1);

      setLeads(prev =>
        prev.map(l =>
          l.id === followUpLead.id
            ? {
              ...l,
              status: uiStatus,
              notes: followUpNotes.trim() || l.notes,
              followUpDate: followUpNextDate || l.followUpDate
            }
            : l
        )
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update lead stage.');
    } finally {
      setFollowUpLoading(false);
    }
  };

  const handleDeleteLead = (id: string) => {
    Alert.alert(
      'Delete Lead',
      'Are you sure you want to delete this lead? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteLeadApi(id);
              Alert.alert('Success', 'Lead deleted successfully.');
              setLeads(prev => prev.filter(l => l.id !== id));
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete lead.');
            }
          }
        }
      ]
    );
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Header */}
      <LinearGradient colors={['#56CCF2', '#4DA8DA', '#2E86B5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.header}>
        <View style={s.hCircle} />
        <View style={s.hRow}>
          <TouchableOpacity onPress={() => router.back()} style={s.hBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={s.hTitle}>Lead Management</Text>
          <TouchableOpacity style={s.hBtn} onPress={() => setShowSearchBox(v => !v)}>
            <Ionicons name={showSearchBox ? "close-outline" : "search-outline"} size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={s.hStats}>
          {[
            { label: 'Total Leads', value: adminStats ? adminStats.totalLeads : leads.length },
            { label: 'New Status', value: adminStats ? adminStats.new : leads.filter(l => l.status === 'New').length },
            { label: 'Pending Won', value: adminStats ? (adminStats.totalLeads - adminStats.converted - adminStats.lost) : leads.filter(l => !['Won', 'Lost'].includes(l.status)).length },
          ].map((st, i) => (
            <View key={i} style={s.hStatItem}>
              <Text style={s.hStatVal}>{st.value}</Text>
              <Text style={s.hStatLabel}>{st.label}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>

      {/* Conditional Search Box */}
      {showSearchBox && (
        <View style={s.searchBarContainer}>
          <Ionicons name="search-outline" size={18} color="#6B7280" style={{ marginRight: 8 }} />
          <TextInput
            style={s.searchBarInput}
            placeholder="Search leads by name or query..."
            placeholderTextColor="#A4A4AD"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      )}

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Quick Actions */}
        <Text style={s.sectionTitle}>Quick Actions</Text>
        <TouchableOpacity
          style={s.addBtn}
          onPress={() => router.push('/leads/add' as any)}
          activeOpacity={0.85}
        >
          <LinearGradient colors={['#56CCF2', '#4DA8DA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.addGrad}>
            <View style={s.addIconCircle}>
              <Ionicons name="person-add" size={22} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.addTitle}>Create Lead</Text>
              <Text style={s.addSub}>Create a single lead profile</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />
          </LinearGradient>
        </TouchableOpacity>

        <View style={s.qaRow}>
          <TouchableOpacity style={s.qaItem} onPress={() => setShowImportModal(true)} activeOpacity={0.75}>
            <View style={[s.qaIcon, { backgroundColor: '#E1F0FA' }]}>
              <Ionicons name="cloud-upload-outline" size={18} color="#4DA8DA" />
            </View>
            <Text style={s.qaLabel}>Import Excel</Text>
          </TouchableOpacity>

          {selectionMode ? (
            <TouchableOpacity style={[s.qaItem, { borderColor: Colors.primary, borderWidth: 1 }]} onPress={handleCancelSelection} activeOpacity={0.75}>
              <View style={[s.qaIcon, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="close-circle-outline" size={18} color={Colors.danger} />
              </View>
              <Text style={s.qaLabel}>Cancel Select</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={s.qaItem} onPress={handleStartSelection} activeOpacity={0.75}>
              <View style={[s.qaIcon, { backgroundColor: '#D1FAE5' }]}>
                <Ionicons name="checkbox-outline" size={18} color="#34D399" />
              </View>
              <Text style={s.qaLabel}>Bulk Assign</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={s.qaItem} activeOpacity={0.75}>
            <View style={[s.qaIcon, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="stats-chart-outline" size={18} color="#FBBF24" />
            </View>
            <Text style={s.qaLabel}>Analytics</Text>
          </TouchableOpacity>
        </View>

        {/* Filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
          {FILTERS.map(f => (
            <TouchableOpacity key={f} style={[s.filterChip, filter === f && s.filterChipActive]} onPress={() => setFilter(f)}>
              <Text style={[s.filterChipTxt, filter === f && s.filterChipTxtActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Leads */}
        <View style={s.leadsHeader}>
          <Text style={s.sectionTitle}>Leads ({leads.length})</Text>
          {selectionMode && (
            <Text style={s.selectedCountText}>
              {selectedLeadIds.length} Selected
            </Text>
          )}
        </View>

        {loading ? (
          <View style={s.centered}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={s.loadingText}>Fetching leads from API...</Text>
          </View>
        ) : (
          <View>
            {leads.map(lead => (
              <LeadCard
                key={lead.id}
                lead={lead}
                selectionMode={selectionMode}
                selected={selectedLeadIds.includes(lead.id)}
                onToggleSelect={() => handleToggleSelect(lead.id)}
                onFollowUpPress={() => openFollowUpModal(lead)}
                onDeletePress={() => handleDeleteLead(lead.id)}
              />
            ))}
            {leads.length === 0 && (
              <View style={s.emptyContainer}>
                <Ionicons name="people-outline" size={48} color="#E5E7EB" />
                <Text style={s.emptyText}>No leads matches found</Text>
              </View>
            )}
          </View>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bulk Action Footer */}
      {selectionMode && selectedLeadIds.length > 0 && (
        <View style={[s.bulkFooter, Shadow.lg]}>
          <View style={{ flex: 1 }}>
            <Text style={s.bulkFooterTitle}>Bulk Actions</Text>
            <Text style={s.bulkFooterSub}>{selectedLeadIds.length} leads chosen</Text>
          </View>
          <TouchableOpacity style={s.bulkAssignBtn} onPress={() => setShowAssignModal(true)}>
            <Ionicons name="person-outline" size={16} color="#fff" />
            <Text style={s.bulkAssignBtnTxt}>Assign Selected</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* FAB (Only show when not in selection mode) */}
      {!selectionMode && (
        <TouchableOpacity style={s.fab} onPress={() => router.push('/leads/add' as any)} activeOpacity={0.85}>
          <LinearGradient colors={['#56CCF2', '#2E86B5']} style={s.fabGrad}>
            <Ionicons name="add" size={26} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* ── Modal 1: Bulk Assign Modal ── */}
      <Modal visible={showAssignModal} animationType="slide" transparent onRequestClose={() => setShowAssignModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <View>
                <Text style={s.modalTitle}>Bulk Assign Leads</Text>
                <Text style={s.modalSub}>Select employee to assign {selectedLeadIds.length} leads to</Text>
              </View>
              <TouchableOpacity onPress={() => setShowAssignModal(false)} style={s.modalClose}>
                <Ionicons name="close" size={20} color={Colors.gray600} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
              <Text style={s.fieldLabel}>Select Assignee *</Text>
              <View style={s.pickerContainer}>
                {mockEmployees.map(e => (
                  <TouchableOpacity key={e.id} style={[s.pickerChip, selectedAssigneeId === e.id && s.pickerChipActive]} onPress={() => setSelectedAssigneeId(e.id)}>
                    <Text style={[s.pickerChipText, selectedAssigneeId === e.id && s.pickerChipTextActive]}>{e.name} ({e.id})</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={s.modalActionsRow}>
                <TouchableOpacity style={s.modalCancelBtn} onPress={() => setShowAssignModal(false)}>
                  <Text style={s.modalCancelTxt}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.modalSubmitBtn} onPress={handleBulkAssignSubmit} disabled={assignLoading}>
                  {assignLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.modalSubmitTxt}>Confirm Assign</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Modal 2: Import Excel Leads Modal ── */}
      <Modal visible={showImportModal} animationType="slide" transparent onRequestClose={() => setShowImportModal(false)}>
        <View style={s.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalCard}>
            <View style={s.modalHeader}>
              <View>
                <Text style={s.modalTitle}>Import Leads (Excel Upload)</Text>
                <Text style={s.modalSub}>Select spreadsheet file containing contacts</Text>
              </View>
              <TouchableOpacity onPress={() => setShowImportModal(false)} style={s.modalClose}>
                <Ionicons name="close" size={20} color={Colors.gray600} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
              <Text style={s.fieldLabel}>Select Template File *</Text>
              <View style={s.pickerContainer}>
                {['Sales_Leads_June.xlsx', 'Tech_Leads_Template.xlsx', 'Custom_Export_Contacts.xlsx'].map(file => (
                  <TouchableOpacity key={file} style={[s.pickerChip, selectedImportFile === file && s.pickerChipActive]} onPress={() => setSelectedImportFile(file)}>
                    <Text style={[s.pickerChipText, selectedImportFile === file && s.pickerChipTextActive]}>{file}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.fieldLabel}>Simulated Lead Count *</Text>
              <TextInput
                style={s.textInput}
                value={importCount}
                onChangeText={setImportCount}
                keyboardType="numeric"
                placeholder="e.g. 100"
                placeholderTextColor="#A4A4AD"
              />

              <View style={s.infoBox}>
                <Ionicons name="information-circle-outline" size={16} color={Colors.primary} style={{ marginRight: 6 }} />
                <Text style={s.infoText}>The Excel file must contain spreadsheet columns: Name, Mobile, Email, Source, CompanyName.</Text>
              </View>

              <View style={s.modalActionsRow}>
                <TouchableOpacity style={s.modalCancelBtn} onPress={() => setShowImportModal(false)}>
                  <Text style={s.modalCancelTxt}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.modalSubmitBtn} onPress={handleImportSubmit} disabled={importLoading}>
                  {importLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.modalSubmitTxt}>Upload & Import</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ── Modal 3: Follow-Up & Stage Update Modal ── */}
      <Modal visible={followUpLead !== null} animationType="slide" transparent onRequestClose={() => setFollowUpLead(null)}>
        <View style={s.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalCard}>
            <View style={s.modalHeader}>
              <View>
                <Text style={s.modalTitle}>Update Lead Follow-up</Text>
                <Text style={s.modalSub}>Select status stage, update comments, and follow-up timeline</Text>
              </View>
              <TouchableOpacity onPress={() => setFollowUpLead(null)} style={s.modalClose}>
                <Ionicons name="close" size={20} color={Colors.gray600} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
              <Text style={s.fieldLabel}>Status Stage *</Text>
              <View style={s.pickerContainer}>
                {['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'].map(st => (
                  <TouchableOpacity key={st} style={[s.pickerChip, followUpStatus === st && s.pickerChipActive]} onPress={() => setFollowUpStatus(st)}>
                    <Text style={[s.pickerChipText, followUpStatus === st && s.pickerChipTextActive]}>{st.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.fieldLabel}>Sub Status Stage</Text>
              <TextInput
                style={s.textInput}
                value={followUpSubStatus}
                onChangeText={setFollowUpSubStatus}
                placeholder="e.g. Interested, Call back, Ringing"
                placeholderTextColor="#A4A4AD"
              />

              <Text style={s.fieldLabel}>Follow-up Notes / Comments</Text>
              <TextInput
                style={[s.textInput, { height: 80, paddingTop: 10 }]}
                value={followUpNotes}
                onChangeText={setFollowUpNotes}
                multiline
                placeholder="Enter discussion summary details..."
                placeholderTextColor="#A4A4AD"
              />

              <Text style={s.fieldLabel}>Next Follow-up Date (YYYY-MM-DD)</Text>
              <TextInput
                style={s.textInput}
                value={followUpNextDate}
                onChangeText={setFollowUpNextDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#A4A4AD"
              />

              <View style={s.modalActionsRow}>
                <TouchableOpacity style={s.modalCancelBtn} onPress={() => setFollowUpLead(null)}>
                  <Text style={s.modalCancelTxt}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.modalSubmitBtn} onPress={handleFollowUpSubmit} disabled={followUpLoading}>
                  {followUpLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.modalSubmitTxt}>Save Stage Update</Text>}
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
  header: {
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 12 : 56,
    paddingHorizontal: 16, paddingBottom: 20, overflow: 'hidden',
  },
  hCircle: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.06)', top: -50, right: -30 },
  hRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  hBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  hTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: -0.3, marginLeft: 12 },
  hStats: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.13)', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  hStatItem: { flex: 1, alignItems: 'center' },
  hStatVal: { fontSize: 18, fontWeight: '800', color: '#fff' },
  hStatLabel: { fontSize: 10, color: 'rgba(255,255,255,0.65)', fontWeight: '600', marginTop: 2 },

  searchBarContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingHorizontal: 16, height: 48 },
  searchBarInput: { flex: 1, fontSize: 14, color: Colors.gray900, height: 40 },

  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 20 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.gray900, marginBottom: 12 },

  addBtn: { borderRadius: 16, overflow: 'hidden', marginBottom: 10, ...Shadow.md },
  addGrad: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  addIconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  addTitle: { fontSize: 15, fontWeight: '700', color: '#fff' },
  addSub: { fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 2 },

  qaRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  qaItem: { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 12, alignItems: 'center', ...Shadow.sm },
  qaIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  qaLabel: { fontSize: 11, color: Colors.gray700, fontWeight: '600' },

  filterRow: { paddingBottom: 16, gap: 8 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: Radius.full, backgroundColor: '#fff', borderWidth: 1.5, borderColor: Colors.gray200 },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterChipTxt: { fontSize: 12, fontWeight: '600', color: Colors.gray700 },
  filterChipTxtActive: { color: '#fff' },

  leadsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  selectedCountText: { fontSize: 12, fontWeight: '700', color: Colors.primary },

  card: { backgroundColor: '#fff', borderRadius: 16, marginBottom: 12, ...Shadow.sm, overflow: 'hidden', borderWidth: 1.5, borderColor: 'transparent' },
  cardSelected: { borderColor: Colors.primary, backgroundColor: '#EFF6FF' },
  cardTop: { flexDirection: 'row', alignItems: 'center', padding: 14, paddingBottom: 10, gap: 12 },
  checkbox: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary + '20', alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 14, fontWeight: '800', color: Colors.primary },
  cardName: { fontSize: 15, fontWeight: '700', color: Colors.gray900, marginBottom: 3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaTxt: { fontSize: 12, color: Colors.gray500 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.full },
  badgeTxt: { fontSize: 11, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 14, paddingBottom: 10, gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.gray50, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  chipTxt: { fontSize: 11, color: Colors.gray600, fontWeight: '500', maxWidth: 110 },

  actions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: Colors.gray100 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 11, gap: 5 },
  actionTxt: { fontSize: 12, fontWeight: '600' },
  actionDiv: { width: 1, backgroundColor: Colors.gray100, marginVertical: 8 },

  menu: { position: 'absolute', right: 14, bottom: 52, backgroundColor: '#fff', borderRadius: 12, ...Shadow.lg, borderWidth: 1, borderColor: Colors.gray100, zIndex: 10, minWidth: 160 },
  menuItem: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.gray50 },
  menuTxt: { fontSize: 13, fontWeight: '600', color: Colors.gray800 },

  fab: { position: 'absolute', bottom: 28, right: 20, borderRadius: 30, ...Shadow.lg },
  fabGrad: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },

  centered: { paddingVertical: 40, alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 13, color: Colors.gray600 },
  emptyContainer: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { marginTop: 10, fontSize: 13, color: Colors.gray400 },

  bulkFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  bulkFooterTitle: { fontSize: 14, fontWeight: '800', color: Colors.gray900 },
  bulkFooterSub: { fontSize: 11, color: Colors.gray500, marginTop: 2 },
  bulkAssignBtn: { backgroundColor: Colors.primary, flexDirection: 'row', paddingHorizontal: 16, height: 44, borderRadius: 10, alignItems: 'center', gap: 6 },
  bulkAssignBtnTxt: { fontSize: 13, color: '#fff', fontWeight: '700' },

  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%', paddingHorizontal: 20, paddingTop: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.gray900 },
  modalSub: { fontSize: 12, color: Colors.gray400, marginTop: 2 },
  modalClose: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.gray100, alignItems: 'center', justifyContent: 'center' },

  fieldLabel: { fontSize: 11, fontWeight: '700', color: Colors.gray600, marginTop: 12, marginBottom: 6, letterSpacing: 0.2, textTransform: 'uppercase' },
  textInput: { height: 46, backgroundColor: '#F9FAFB', borderRadius: 10, borderWidth: 1.5, borderColor: '#E4E4E7', paddingHorizontal: 14, fontSize: 13, color: Colors.gray900, marginBottom: 4 },
  infoBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.overlayLight, borderRadius: 8, padding: 10, marginVertical: 8 },
  infoText: { flex: 1, fontSize: 11, color: Colors.primary, lineHeight: 16 },

  pickerContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 4 },
  pickerChip: { backgroundColor: '#F9FAFB', borderWidth: 1.5, borderColor: '#E4E4E7', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  pickerChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pickerChipText: { fontSize: 11, color: Colors.gray600, fontWeight: '700' },
  pickerChipTextActive: { color: Colors.white },

  modalActionsRow: { flexDirection: 'row', gap: 10, marginTop: 20, marginBottom: 20 },
  modalCancelBtn: { flex: 1, height: 48, borderRadius: 12, borderWidth: 1.5, borderColor: '#E4E4E7', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.white },
  modalCancelTxt: { fontSize: 14, fontWeight: '700', color: Colors.gray600 },
  modalSubmitBtn: { flex: 2, height: 48, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  modalSubmitTxt: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
