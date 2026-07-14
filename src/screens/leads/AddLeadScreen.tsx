import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Platform, StatusBar, KeyboardAvoidingView,
  Modal, Dimensions, Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Shadow, Typography, IconBox } from '../../design-system/tokens';
import { createLeadApi, fetchAllLeads, fetchLeadStatisticsCounts } from '../../services/leadService';
import { fetchProfile } from '../../services/authService';
// import { mockLeads, Lead } from '../../data/mockData';

// ── Helpers ────────────────────────────────────────────────────────────────────
const LEAD_TYPES = ['Enterprise', 'SME', 'Startup', 'Individual'];
const LEAD_STATUSES = ['New', 'Contacted', 'In Progress', 'Qualified', 'Proposal Sent', 'Negotiation', 'Won', 'Lost', 'On Hold'];
const ASSIGNED_TO = ['Venil Mottana', 'Rahul Sharma', 'Anita Mehta', 'Priya Kapoor', 'Suresh Kumar'];
const ASSIGNEE_IDS: Record<string, string> = {
  'Rahul Sharma': 'MM-001',
  'Anita Mehta': 'MM-002',
  'Venil Mottana': 'MM-003',
  'Priya Kapoor': 'MM-004',
  'Suresh Kumar': 'MM-005',
};
const FOLLOW_UP_TYPES = ['Call', 'Email', 'Meeting', 'WhatsApp', 'Demo'];
const LEAD_SOURCES = ['Website', 'Referral', 'LinkedIn', 'Cold Call', 'Exhibition', 'Social Media', 'Other'];

interface FormData {
  fullName: string;
  mobile: string;
  email: string;
  leadType: string;
  status: string;
  assignedTo: string;
  followUpType: string;
  followUpDate: string;
  leadSource: string;
  notes: string;
}

interface Errors { [key: string]: string }

// ── Sub-components ─────────────────────────────────────────────────────────────
function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <Text style={s.label}>
      {label}{required && <Text style={{ color: Colors.danger }}> *</Text>}
    </Text>
  );
}

function Field({ children, error }: { children: React.ReactNode; error?: string }) {
  return (
    <View style={s.fieldWrap}>
      {children}
      {!!error && (
        <View style={s.errorRow}>
          <Ionicons name="alert-circle-outline" size={12} color={Colors.danger} />
          <Text style={s.errorTxt}>{error}</Text>
        </View>
      )}
    </View>
  );
}

function TextBox({
  value, onChangeText, placeholder, keyboardType, multiline, error, icon,
}: {
  value: string; onChangeText: (v: string) => void; placeholder: string;
  keyboardType?: any; multiline?: boolean; error?: boolean; icon: string;
}) {
  return (
    <View style={[s.inputWrap, error && s.inputError, multiline && s.inputMultiline]}>
      <Ionicons name={icon as any} size={18} color={error ? Colors.danger : Colors.gray400} style={s.inputIcon} />
      <TextInput
        style={[s.input, multiline && s.inputArea]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={'#A4A4AD'}
        keyboardType={keyboardType || 'default'}
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </View>
  );
}

function Dropdown({
  value, options, onSelect, placeholder, error, icon,
}: {
  value: string; options: string[]; onSelect: (v: string) => void;
  placeholder: string; error?: boolean; icon: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <TouchableOpacity style={[s.inputWrap, error && s.inputError]} onPress={() => setOpen(v => !v)} activeOpacity={0.8}>
        <Ionicons name={icon as any} size={18} color={error ? Colors.danger : Colors.gray400} style={s.inputIcon} />
        <Text style={[s.dropTxt, !value && { color: '#A4A4AD' }]} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={'#A4A4AD'} />
      </TouchableOpacity>
      {open && (
        <View style={s.dropList}>
          {options.map(opt => (
            <TouchableOpacity
              key={opt}
              style={[s.dropItem, value === opt && s.dropItemActive]}
              onPress={() => { onSelect(opt); setOpen(false); }}
            >
              <Text style={[s.dropItemTxt, value === opt && s.dropItemTxtActive]}>{opt}</Text>
              {value === opt && <Ionicons name="checkmark" size={14} color={Colors.primary} />}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Toast ──────────────────────────────────────────────────────────────────────
function Toast({ visible }: { visible: boolean }) {
  return visible ? (
    <View style={s.toast}>
      <Ionicons name="checkmark-circle" size={18} color="#fff" />
      <Text style={s.toastTxt}>Lead saved successfully!</Text>
    </View>
  ) : null;
}

// ── Main Screen ────────────────────────────────────────────────────────────────
export default function AddLeadScreen() {
  const router = useRouter();
  const [form, setForm] = useState<FormData>({
    fullName: '', mobile: '', email: '', leadType: '', status: 'New',
    assignedTo: '', followUpType: '', followUpDate: '', leadSource: '', notes: '',
  });
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterFollowUp, setFilterFollowUp] = useState('');
  const [filterOpen, setFilterOpen] = useState<'status' | 'assignee' | 'followup' | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  // API Data States
  const [leads, setLeads] = useState<any[]>([]);
  const [adminStats, setAdminStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<any>>(new Set());
  const [userRole, setUserRole] = useState<string>('employee');

  const isSuperAdmin = userRole === 'superadmin';

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAllLeads({ page: 1, limit: 100 });
      if (res && res.success && Array.isArray(res.data)) {
        setLeads(res.data);
      }
      const statsRes = await fetchLeadStatisticsCounts().catch(() => null);
      if (statsRes && statsRes.success) {
        setAdminStats(statsRes.data);
      }
    } catch (err) {
      console.warn('Failed to load leads in AddLeadScreen:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    fetchProfile().then(p => {
      if (p && p.user) setUserRole(p.user.role || 'employee');
    }).catch(() => { });
  }, [loadData]);

  const toggleRow = (id: any) => setSelectedRows(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const toggleAll = () => setSelectedRows(
    selectedRows.size === leads.length ? new Set() : new Set(leads.map(r => r._id || r.id))
  );

  const set = (key: keyof FormData) => (val: string) => {
    setForm(f => ({ ...f, [key]: val }));
    if (errors[key]) setErrors(e => { const n = { ...e }; delete n[key]; return n; });
  };

  function validate(): boolean {
    const e: Errors = {};
    if (!form.fullName.trim()) e.fullName = 'Full name is required';
    if (!form.mobile.trim()) e.mobile = 'Mobile number is required';
    else if (!/^\+?[\d\s\-]{7,15}$/.test(form.mobile)) e.mobile = 'Enter a valid mobile number';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email address';
    if (!form.leadType) e.leadType = 'Please select a lead type';
    if (!form.status) e.status = 'Please select a status';
    if (!form.assignedTo) e.assignedTo = 'Please assign to a team member';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // Modal form state
  const [showModal, setShowModal] = useState(false);
  const [mf, setMf] = useState({
    fullName: '', mobile: '', email: '', company: '', companyManual: '',
    estimatedPrice: '0.00', leadType: '', status: 'New', leadSource: '',
    entityType: 'Individual', assignedTo: '', notes: '',
  });
  const [mfDropOpen, setMfDropOpen] = useState<string | null>(null);
  const setMfField = (key: string) => (val: string) => setMf(p => ({ ...p, [key]: val }));

  const mapUiStatusToApi = (st: string) => {
    const lower = st.toLowerCase();
    if (lower === 'in progress') return 'in_progress';
    if (lower === 'proposal sent') return 'proposal_sent';
    if (lower === 'on hold') return 'on_hold';
    return lower;
  };

  async function handleCreate() {
    const assignedId = ASSIGNEE_IDS[mf.assignedTo] || mf.assignedTo || undefined;
    const payload = {
      name: mf.fullName.trim(),
      mobile: mf.mobile.trim(),
      email: mf.email.trim() || undefined,
      websiteType: mf.leadType || undefined,
      source: mf.leadSource || undefined,
      status: mapUiStatusToApi(mf.status),
      message: mf.notes.trim() || undefined,
      assignedTo: assignedId,
      companyType: mf.entityType || 'Individual',
      companyName: (mf.companyManual || mf.company).trim() || undefined,
      estimatedPrice: parseFloat(mf.estimatedPrice) || 0
    };

    setSaving(true);
    try {
      await createLeadApi(payload);
      setShowModal(false);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 1500);
      loadData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create lead.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    const assignedId = ASSIGNEE_IDS[form.assignedTo] || form.assignedTo || undefined;
    const payload = {
      name: form.fullName.trim(),
      mobile: form.mobile.trim(),
      email: form.email.trim() || undefined,
      websiteType: form.leadType || undefined,
      source: form.leadSource || undefined,
      status: mapUiStatusToApi(form.status),
      message: form.notes.trim() || undefined,
      assignedTo: assignedId,
      companyType: 'Individual',
      estimatedPrice: 0
    };

    try {
      await createLeadApi(payload);
      setSaving(false);
      setShowToast(true);
      setTimeout(() => { setShowToast(false); router.canGoBack() ? router.back() : router.replace('/(tabs)'); }, 1500);
    } catch (err: any) {
      setSaving(false);
      Alert.alert('Error', err.message || 'Failed to save lead.');
    }
  }

  return (
    <View style={s.root}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

        {/* Sticky Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.gray900} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Leads</Text>
        </View>

        <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* Stats Cards */}
          <View style={s.statsGrid}>
            {([
              { label: 'Total Leads', count: adminStats ? adminStats.totalLeads : leads.length, icon: 'people-outline' as const, color: Colors.white, bg: '#2B7FFF' },
              { label: 'New Leads', count: adminStats ? adminStats.new : leads.filter(l => l.status === 'New').length, icon: 'person-add-outline' as const, color: Colors.white, bg: '#2B7FFF' },
              { label: 'Qualified', count: adminStats ? adminStats.qualified : leads.filter(l => l.status === 'Qualified').length, icon: 'shield-checkmark-outline' as const, color: Colors.white, bg: '#00BC7D' },
              { label: 'Won Leads', count: adminStats ? adminStats.converted : leads.filter(l => l.status === 'Won').length, icon: 'trophy-outline' as const, color: Colors.white, bg: '#00C950' },
            ]).map((stat) => (
              <View key={stat.label} style={s.statCard}>
                <View style={[s.statIconBox, { backgroundColor: stat.bg }]}>
                  <Ionicons name={stat.icon} size={20} color={stat.color} />
                </View>
                <View style={s.statContent}>
                  <Text style={s.statLabel}>{stat.label}</Text>
                  <Text style={s.statCount}>{stat.count}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Filter Toolbar */}
          <View style={s.toolbar}>
            <View style={s.searchWrap}>
              <Ionicons name="search-outline" size={16} color={'#A4A4AD'} />
              <TextInput
                style={s.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="Search name, mobile, email..."
                placeholderTextColor={'#A4A4AD'}
              />
              {!!search && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Ionicons name="close-circle" size={16} color={'#A4A4AD'} />
                </TouchableOpacity>
              )}
            </View>

            <View style={s.filterRow}>
              <View style={{ flex: 1 }}>
                <TouchableOpacity style={s.filterChip} onPress={() => setFilterOpen(p => p === 'status' ? null : 'status')} activeOpacity={0.8}>
                  <Text style={[s.filterChipTxt, !!filterStatus && { color: Colors.primary }]} numberOfLines={1}>{filterStatus || 'ALL STATUS'}</Text>
                  <Ionicons name={filterOpen === 'status' ? 'chevron-up' : 'chevron-down'} size={12} color={filterStatus ? Colors.primary : '#A4A4AD'} />
                </TouchableOpacity>
                {filterOpen === 'status' && (
                  <View style={s.filterDrop}>
                    <TouchableOpacity style={s.filterDropItem} onPress={() => { setFilterStatus(''); setFilterOpen(null); }}>
                      <Text style={s.filterDropTxt}>All Status</Text>
                    </TouchableOpacity>
                    {LEAD_STATUSES.map(opt => (
                      <TouchableOpacity key={opt} style={[s.filterDropItem, filterStatus === opt && s.filterDropItemActive]} onPress={() => { setFilterStatus(opt); setFilterOpen(null); }}>
                        <Text style={[s.filterDropTxt, filterStatus === opt && { color: Colors.primary, fontWeight: '700' }]}>{opt}</Text>
                        {filterStatus === opt && <Ionicons name="checkmark" size={12} color={Colors.primary} />}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <View style={{ flex: 1 }}>
                <TouchableOpacity style={s.filterChip} onPress={() => setFilterOpen(p => p === 'assignee' ? null : 'assignee')} activeOpacity={0.8}>
                  <Text style={[s.filterChipTxt, !!filterAssignee && { color: Colors.primary }]} numberOfLines={1}>{filterAssignee || 'ALL ASSIGNEES'}</Text>
                  <Ionicons name={filterOpen === 'assignee' ? 'chevron-up' : 'chevron-down'} size={12} color={filterAssignee ? Colors.primary : '#A4A4AD'} />
                </TouchableOpacity>
                {filterOpen === 'assignee' && (
                  <View style={s.filterDrop}>
                    <TouchableOpacity style={s.filterDropItem} onPress={() => { setFilterAssignee(''); setFilterOpen(null); }}>
                      <Text style={s.filterDropTxt}>All Assignees</Text>
                    </TouchableOpacity>
                    {ASSIGNED_TO.map(opt => (
                      <TouchableOpacity key={opt} style={[s.filterDropItem, filterAssignee === opt && s.filterDropItemActive]} onPress={() => { setFilterAssignee(opt); setFilterOpen(null); }}>
                        <Text style={[s.filterDropTxt, filterAssignee === opt && { color: Colors.primary, fontWeight: '700' }]}>{opt}</Text>
                        {filterAssignee === opt && <Ionicons name="checkmark" size={12} color={Colors.primary} />}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <View style={{ flex: 1 }}>
                <TouchableOpacity style={s.filterChip} onPress={() => setFilterOpen(p => p === 'followup' ? null : 'followup')} activeOpacity={0.8}>
                  <Text style={[s.filterChipTxt, !!filterFollowUp && { color: Colors.primary }]} numberOfLines={1}>{filterFollowUp || 'ALL FOLLOW-UPS'}</Text>
                  <Ionicons name={filterOpen === 'followup' ? 'chevron-up' : 'chevron-down'} size={12} color={filterFollowUp ? Colors.primary : '#A4A4AD'} />
                </TouchableOpacity>
                {filterOpen === 'followup' && (
                  <View style={[s.filterDrop, { right: 0 }]}>
                    <TouchableOpacity style={s.filterDropItem} onPress={() => { setFilterFollowUp(''); setFilterOpen(null); }}>
                      <Text style={s.filterDropTxt}>All Follow-ups</Text>
                    </TouchableOpacity>
                    {FOLLOW_UP_TYPES.map(opt => (
                      <TouchableOpacity key={opt} style={[s.filterDropItem, filterFollowUp === opt && s.filterDropItemActive]} onPress={() => { setFilterFollowUp(opt); setFilterOpen(null); }}>
                        <Text style={[s.filterDropTxt, filterFollowUp === opt && { color: Colors.primary, fontWeight: '700' }]}>{opt}</Text>
                        {filterFollowUp === opt && <Ionicons name="checkmark" size={12} color={Colors.primary} />}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </View>

            <View style={s.actionRow}>
              <View style={s.dateRangeWrap}>
                <View style={s.dateRangeRow}>
                  <View style={s.dateField}>
                    <Text style={s.dateRangeLabel}>From</Text>
                    <TextInput style={s.dateInput} value={dateFrom} onChangeText={setDateFrom} placeholder="dd-mm-yyyy" placeholderTextColor={'#A4A4AD'} />
                  </View>
                  <Text style={s.dateSep}>–</Text>
                  <View style={s.dateField}>
                    <Text style={s.dateRangeLabel}>To</Text>
                    <TextInput style={s.dateInput} value={dateTo} onChangeText={setDateTo} placeholder="dd-mm-yyyy" placeholderTextColor={'#A4A4AD'} />
                  </View>
                </View>
              </View>
              {!isSuperAdmin && (
                <TouchableOpacity style={s.addLeadBtn} activeOpacity={0.85} onPress={() => setShowModal(true)}>
                  <Ionicons name="add" size={16} color="#fff" />
                  <Text style={s.addLeadTxt}>Add Lead</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Leads Table */}
          <View style={s.tableContainer}>
            <View style={s.tableTopBar}>
              <Text style={s.tableTopTitle}>Leads</Text>
              <View style={s.tableTopActions}>
                <TouchableOpacity style={s.tableActionBtn} activeOpacity={0.8}>
                  <Ionicons name="download-outline" size={13} color={Colors.gray700} />
                  <Text style={s.tableActionTxt}>Export</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.tableActionBtn} activeOpacity={0.8}>
                  <Ionicons name="document-outline" size={13} color={Colors.gray700} />
                  <Text style={s.tableActionTxt}>Template</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.tableActionBtn, s.tableActionBtnPrimary]} activeOpacity={0.8}>
                  <Ionicons name="cloud-upload-outline" size={13} color="#fff" />
                  <Text style={[s.tableActionTxt, { color: '#fff' }]}>Import</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={s.tableWrap}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View>
                  <View style={s.tableHeaderRow}>
                    <TouchableOpacity style={s.tableChkCell} onPress={toggleAll}>
                      <View style={[s.tableChkBox, selectedRows.size === leads.length && s.tableChkBoxChecked]}>
                        {selectedRows.size === leads.length && <Ionicons name="checkmark" size={10} color="#fff" />}
                      </View>
                    </TouchableOpacity>
                    {COLS.map(col => (
                      <View key={col.key} style={[s.tableHeaderCell, { width: col.width }]}>
                        <Text style={s.tableHeaderTxt}>{col.label}</Text>
                      </View>
                    ))}
                  </View>
                  {leads.map((rawRow, idx) => {
                    const row = {
                      id: rawRow._id || rawRow.id || '',
                      timestamp: rawRow.createdAt ? new Date(rawRow.createdAt).toLocaleDateString() : '',
                      name: rawRow.contactPerson || rawRow.name || 'Unnamed Lead',
                      mobile: rawRow.phone || rawRow.mobile || '',
                      leadType: rawRow.leadType || rawRow.websiteType || 'SME',
                      status: rawRow.status || 'New',
                      assignedTo: rawRow.assignedTo && typeof rawRow.assignedTo === 'object' ? rawRow.assignedTo.name : (rawRow.assignedTo || 'Unassigned'),
                    };
                    const sc = STATUS_COLORS[row.status] || { bg: Colors.gray50, text: Colors.gray600 };
                    return (
                      <View key={row.id} style={[s.tableRow, idx % 2 === 1 && s.tableRowAlt, selectedRows.has(row.id) && s.tableRowSelected]}>
                        <TouchableOpacity style={s.tableChkCell} onPress={() => toggleRow(row.id)}>
                          <View style={[s.tableChkBox, selectedRows.has(row.id) && s.tableChkBoxChecked]}>
                            {selectedRows.has(row.id) && <Ionicons name="checkmark" size={10} color="#fff" />}
                          </View>
                        </TouchableOpacity>
                        <View style={[s.tableCell, { width: COLS[0].width }]}><Text style={s.tableTxt} numberOfLines={1}>{row.id.slice(-6)}</Text></View>
                        <View style={[s.tableCell, { width: COLS[1].width }]}><Text style={s.tableTxtSm}>{row.timestamp}</Text></View>
                        <View style={[s.tableCell, { width: COLS[2].width }]}><Text style={s.tableTxt} numberOfLines={1}>{row.name}</Text></View>
                        <View style={[s.tableCell, { width: COLS[3].width }]}><Text style={s.tableTxt}>{row.mobile}</Text></View>
                        <View style={[s.tableCell, { width: COLS[4].width }]}><Text style={s.tableTxt}>{row.leadType}</Text></View>
                        <View style={[s.tableCell, { width: COLS[5].width }]}>
                          <View style={[s.statusBadge, { backgroundColor: sc.bg }]}>
                            <Text style={[s.statusBadgeTxt, { color: sc.text }]}>{row.status}</Text>
                          </View>
                        </View>
                        <View style={[s.tableCell, { width: COLS[6].width }]}><Text style={s.tableTxt} numberOfLines={1}>{row.assignedTo}</Text></View>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          </View>

          <View style={{ height: 20 }} />
        </ScrollView>

        <Toast visible={showToast} />

        {/* Add New Lead Modal */}
        <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
          <View style={s.modalOverlay}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalCard}>
              {/* Modal Header */}
              <View style={s.modalHeader}>
                <View>
                  <Text style={s.modalTitle}>Add New Lead</Text>
                  <Text style={s.modalSub}>Register a new potential client</Text>
                </View>
                <TouchableOpacity onPress={() => setShowModal(false)} style={s.modalClose}>
                  <Ionicons name="close" size={20} color={Colors.gray600} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 100, flexGrow: 1, }}>

                <MRow>
                  <MField label="Full Name" style={{ flex: 1 }}>
                    <MInput value={mf.fullName} onChangeText={setMfField('fullName')} placeholder="ENTER NAME" />
                  </MField>
                  <MField label="Mobile Number" style={{ flex: 1 }}>
                    <MInput value={mf.mobile} onChangeText={setMfField('mobile')} placeholder="ENTER 10 DIGIT MOBILE" keyboardType="phone-pad" />
                  </MField>
                </MRow>

                <MField label="Email Address">
                  <MInput value={mf.email} onChangeText={setMfField('email')} placeholder="email@example.com" keyboardType="email-address" />
                </MField>

                <MField label="Company Name">
                  <MInput value={mf.company} onChangeText={setMfField('company')} placeholder="SEARCH AND SELECT COMPANY NAME" />
                  <Text style={s.mfOr}>OR ENTER COMPANY NAME MANUALLY</Text>
                  <MInput value={mf.companyManual} onChangeText={setMfField('companyManual')} placeholder="Select an existing company or type a new one manually" />
                </MField>

                <MRow>
                  <MField label="Estimated Price" style={{ flex: 1 }}>
                    <MInput value={mf.estimatedPrice} onChangeText={setMfField('estimatedPrice')} placeholder="0.00" keyboardType="decimal-pad" />
                  </MField>
                  <MField label="Lead Type" style={{ flex: 1 }}>
                    <MDropdown value={mf.leadType} options={LEAD_TYPES} onSelect={setMfField('leadType')} placeholder="SELECT LEAD TYPE" id="leadType" open={mfDropOpen} setOpen={setMfDropOpen} />
                  </MField>
                </MRow>

                <MRow>
                  <MField label="Status" style={{ flex: 1 }}>
                    <MDropdown value={mf.status} options={LEAD_STATUSES} onSelect={setMfField('status')} placeholder="NEW" id="mstatus" open={mfDropOpen} setOpen={setMfDropOpen} />
                  </MField>
                  <MField label="Lead Source" style={{ flex: 1 }}>
                    <MInput value={mf.leadSource} onChangeText={setMfField('leadSource')} placeholder="ENTER OR SELECT LEAD SOURCE" />
                  </MField>
                </MRow>

                <MRow>
                  <MField label="Entity Type" style={{ flex: 1 }}>
                    <MDropdown value={mf.entityType} options={['Individual', 'Company']} onSelect={setMfField('entityType')} placeholder="INDIVIDUAL" id="entity" open={mfDropOpen} setOpen={setMfDropOpen} />
                  </MField>
                  <MField label="Assign To Team Member" style={{ flex: 1 }}>
                    <MDropdown value={mf.assignedTo} options={ASSIGNED_TO} onSelect={setMfField('assignedTo')} placeholder="SELECT ASSIGNEE (UNASSIGNED)" id="assignee" open={mfDropOpen} setOpen={setMfDropOpen} />
                  </MField>
                </MRow>

                <MField label="Requirement Details / Message">
                  <MInput value={mf.notes} onChangeText={setMfField('notes')} placeholder="ENTER LEAD REQUIREMENTS OR NOTES..." multiline />
                </MField>

                <View style={s.mfActions}>
                  <TouchableOpacity style={s.mfCancel} onPress={() => setShowModal(false)} activeOpacity={0.8}>
                    <Text style={s.mfCancelTxt}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.mfCreate} onPress={handleCreate} activeOpacity={0.85}>
                    <Text style={s.mfCreateTxt}>Create Lead</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </View>
  );
}

// ── Modal sub-components ──────────────────────────────────────────────────────
function MField({ label, children, style }: { label: string; children: React.ReactNode; style?: any }) {
  return (
    <View style={[s.mfField, style]}>
      <Text style={s.mfLabel}>{label}</Text>
      {children}
    </View>
  );
}
function MRow({ children }: { children: React.ReactNode }) {
  return <View style={s.mfRow}>{children}</View>;
}
function MInput({ value, onChangeText, placeholder, keyboardType, multiline }: {
  value: string; onChangeText: (v: string) => void; placeholder: string;
  keyboardType?: any; multiline?: boolean;
}) {
  return (
    <TextInput
      style={[s.mfInput, multiline && s.mfInputMulti]}
      value={value} onChangeText={onChangeText} placeholder={placeholder}
      placeholderTextColor={'#A4A4AD'} keyboardType={keyboardType || 'default'}
      multiline={multiline} numberOfLines={multiline ? 3 : 1}
      textAlignVertical={multiline ? 'top' : 'center'}
    />
  );
}
function MDropdown({ value, options, onSelect, placeholder, id, open, setOpen }: {
  value: string; options: string[]; onSelect: (v: string) => void;
  placeholder: string; id: string; open: string | null; setOpen: (v: string | null) => void;
}) {
  return (
    <View>
      <TouchableOpacity style={s.mfInput} onPress={() => setOpen(open === id ? null : id)} activeOpacity={0.8}>
        <Text style={[{ fontSize: 11, flex: 1, color: value ? '#A4A4AD' : '#A4A4AD' }]} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <Ionicons name={open === id ? 'chevron-up' : 'chevron-down'} size={14} color={'#A4A4AD'} />
      </TouchableOpacity>
      {open === id && (
        <View style={s.mfDrop}>
          {options.map(opt => (
            <TouchableOpacity key={opt} style={[s.mfDropItem, value === opt && s.mfDropItemActive]} onPress={() => { onSelect(opt); setOpen(null); }}>
              <Text style={[s.mfDropTxt, value === opt && { color: Colors.primary, fontWeight: '700' }]}>{opt}</Text>
              {value === opt && <Ionicons name="checkmark" size={12} color={Colors.primary} />}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// const DUMMY_LEADS = [
//   { id: 1, timestamp: '01-07-2025 09:14', name: 'Arjun Mehta', mobile: '9876543210', leadType: 'Enterprise', status: 'New', assignedTo: 'Rahul Sharma' },
//   { id: 2, timestamp: '01-07-2025 10:32', name: 'Priya Kapoor', mobile: '9123456780', leadType: 'SME', status: 'Contacted', assignedTo: 'Anita Mehta' },
//   { id: 3, timestamp: '01-07-2025 11:05', name: 'Sanjay Verma', mobile: '9988776655', leadType: 'Startup', status: 'In Progress', assignedTo: 'Venil Mottana' },
//   { id: 4, timestamp: '02-07-2025 08:50', name: 'Kavita Singh', mobile: '9871234560', leadType: 'Individual', status: 'Qualified', assignedTo: 'Priya Kapoor' },
//   { id: 5, timestamp: '02-07-2025 12:20', name: 'Rohit Desai', mobile: '9765432100', leadType: 'Enterprise', status: 'Proposal Sent', assignedTo: 'Suresh Kumar' },
//   { id: 6, timestamp: '02-07-2025 14:45', name: 'Meena Joshi', mobile: '9654321098', leadType: 'SME', status: 'Negotiation', assignedTo: 'Rahul Sharma' },
//   { id: 7, timestamp: '03-07-2025 09:00', name: 'Vikram Nair', mobile: '9543210987', leadType: 'Startup', status: 'Won', assignedTo: 'Anita Mehta' },
//   { id: 8, timestamp: '03-07-2025 10:15', name: 'Sunita Rao', mobile: '9432109876', leadType: 'Individual', status: 'Lost', assignedTo: 'Venil Mottana' },
//   { id: 9, timestamp: '03-07-2025 11:30', name: 'Anil Pandey', mobile: '9321098765', leadType: 'Enterprise', status: 'On Hold', assignedTo: 'Priya Kapoor' },
//   { id: 10, timestamp: '04-07-2025 08:00', name: 'Deepa Iyer', mobile: '9210987654', leadType: 'SME', status: 'New', assignedTo: 'Suresh Kumar' },
//   { id: 11, timestamp: '04-07-2025 09:45', name: 'Kiran Bose', mobile: '9109876543', leadType: 'Startup', status: 'Contacted', assignedTo: 'Rahul Sharma' },
// ];

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  'New': { bg: '#EFF6FF', text: '#2563EB' },
  'Contacted': { bg: '#F0FDF4', text: '#16A34A' },
  'In Progress': { bg: '#FFF7ED', text: '#EA580C' },
  'Qualified': { bg: '#F5F3FF', text: '#7C3AED' },
  'Proposal Sent': { bg: '#FEFCE8', text: '#CA8A04' },
  'Negotiation': { bg: '#FFF1F2', text: '#E11D48' },
  'Won': { bg: '#DCFCE7', text: '#15803D' },
  'Lost': { bg: '#FEE2E2', text: '#DC2626' },
  'On Hold': { bg: '#F1F5F9', text: '#475569' },
};

const COLS = [
  { key: 'sno', label: 'S.No', width: 44 },
  { key: 'timestamp', label: 'Timestamp', width: 130 },
  { key: 'name', label: 'Name', width: 110 },
  { key: 'mobile', label: 'Mobile No.', width: 105 },
  { key: 'leadType', label: 'Lead Type', width: 90 },
  { key: 'status', label: 'Status', width: 115 },
  { key: 'assignedTo', label: 'Assigned To', width: 115 },
];

// const STATS = [
//   { label: 'Total Leads', count: 11, icon: 'people-outline' as const, color: Colors.white, bg: '#2B7FFF' },
//   { label: 'New Leads', count: 5, icon: 'person-add-outline' as const, color: Colors.white, bg: '#2B7FFF' },
//   { label: 'Qualified', count: 0, icon: 'shield-checkmark-outline' as const, color: Colors.white, bg: '#00BC7D' },
//   { label: 'Won Leads', count: 5, icon: 'trophy-outline' as const, color: Colors.white, bg: '#00C950' },
// ];

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FAFAFA' },

  header: {
    backgroundColor: Colors.white,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 12 : 56,
    paddingHorizontal: 16, paddingBottom: 16,
    flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: Colors.gray100,
  },
  backBtn: { marginRight: 16, padding: 4 },
  headerTitle: { fontSize: Typography.fontSize.md, fontWeight: '700', color: Colors.gray900 },

  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 20 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statCard: {
    width: '48%',
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    ...Shadow.sm,
  },
  statIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    ...IconBox.shadow as any,
  },
  statContent: {
    flex: 1,
  },
  statCount: { fontSize: 20, fontWeight: '800', color: Colors.gray900 },
  statLabel: { fontSize: 10, fontWeight: '600', color: '#45556C', marginBottom: 2 },

  toolbar: { backgroundColor: Colors.white, borderRadius: 16, padding: 12, marginBottom: 14, ...Shadow.sm, gap: 10, zIndex: 100 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F9FAFB', borderRadius: 10, borderWidth: 1.5, borderColor: '#E4E4E7', paddingHorizontal: 12, height: 42 },
  searchInput: { flex: 1, fontSize: 13, color: Colors.gray900, paddingVertical: 0 },
  filterRow: { flexDirection: 'row', gap: 6, zIndex: 99 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F9FAFB', borderRadius: 8, borderWidth: 1.5, borderColor: '#E4E4E7', paddingHorizontal: 8, height: 36 },
  filterChipTxt: { fontSize: 10, fontWeight: '700', color: '#A4A4AD', letterSpacing: 0.3, flex: 1 },
  filterDrop: { position: 'absolute', top: 40, left: 0, right: 0, backgroundColor: Colors.white, borderRadius: 10, borderWidth: 1.5, borderColor: '#E4E4E7', ...Shadow.md, zIndex: 999 },
  filterDropItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.gray50 },
  filterDropItemActive: { backgroundColor: Colors.primary + '10' },
  filterDropTxt: { fontSize: 13, color: Colors.gray800, fontWeight: '500' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  addLeadBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 14, height: 38, ...Shadow.sm },
  addLeadTxt: { fontSize: 13, fontWeight: '700', color: '#fff' },
  dateRangeWrap: { flex: 1, backgroundColor: '#F9FAFB', borderRadius: 10, borderWidth: 1.5, borderColor: '#E4E4E7', paddingHorizontal: 10, paddingVertical: 8 },
  dateRangeLabel: { fontSize: 10, fontWeight: '700', color: '#A4A4AD', marginBottom: 2, letterSpacing: 0.3 },
  dateRangeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dateField: { flex: 1 },
  dateInput: { fontSize: 12, color: Colors.gray900, paddingVertical: 0 },
  dateSep: { fontSize: 13, color: Colors.gray400, fontWeight: '600', marginTop: 14 },

  // Table
  tableContainer: { marginBottom: 14 },
  tableTopBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  tableTopTitle: { fontSize: 14, fontWeight: '700', color: Colors.gray800 },
  tableTopActions: { flexDirection: 'row', gap: 6 },
  tableActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.white, borderRadius: 8, borderWidth: 1.5, borderColor: '#E4E4E7', paddingHorizontal: 10, paddingVertical: 6 },
  tableActionBtnPrimary: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tableActionTxt: { fontSize: 12, fontWeight: '600', color: Colors.gray700 },
  tableWrap: { borderRadius: 14, borderWidth: 1, borderColor: Colors.gray100, overflow: 'hidden', marginBottom: 14, ...Shadow.sm },
  tableHeaderRow: { flexDirection: 'row', backgroundColor: Colors.gray50, borderBottomWidth: 1.5, borderBottomColor: Colors.gray200 },
  tableHeaderCell: { paddingHorizontal: 10, paddingVertical: 11, justifyContent: 'center', alignItems: 'center' },
  tableHeaderTxt: { fontSize: 11, fontWeight: '700', color: Colors.gray600, letterSpacing: 0.3, textAlign: 'center' },
  tableChkCell: { width: 38, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  tableChkBox: { width: 16, height: 16, borderRadius: 4, borderWidth: 1.5, borderColor: Colors.gray300, backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center' },
  tableChkBoxChecked: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tableRowSelected: {},
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.gray100, backgroundColor: Colors.white },
  tableRowAlt: { backgroundColor: '#FAFCFF' },
  tableCell: { paddingHorizontal: 10, paddingVertical: 11, justifyContent: 'center', alignItems: 'center' },
  tableTxt: { fontSize: 12, color: Colors.gray800, fontWeight: '500', textAlign: 'center' },
  tableTxtSm: { fontSize: 11, color: Colors.gray600, textAlign: 'center' },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  statusBadgeTxt: { fontSize: 10, fontWeight: '700', letterSpacing: 0.2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%', paddingHorizontal: 20, paddingTop: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.gray900 },
  modalSub: { fontSize: 12, color: Colors.gray400, marginTop: 2 },
  modalClose: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.gray100, alignItems: 'center', justifyContent: 'center' },
  mfField: { marginBottom: 14 },
  mfRow: { flexDirection: 'row', gap: 10, marginBottom: 8, },
  mfLabel: { fontSize: 11, fontWeight: '700', color: Colors.gray600, marginBottom: 5, letterSpacing: 0.2 },
  mfInput: { height: 46, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 10, borderWidth: 1.5, borderColor: '#E4E4E7', paddingHorizontal: 14, fontSize: 11, color: Colors.gray900 },
  mfInputMulti: { height: undefined, minHeight: 80, maxHeight: 120, paddingTop: 12, textAlignVertical: 'top', alignItems: 'flex-start' },
  mfOr: { fontSize: 10, fontWeight: '700', color: Colors.gray400, textAlign: 'center', marginVertical: 6, letterSpacing: 0.5 },
  mfDrop: { backgroundColor: Colors.white, borderRadius: 10, borderWidth: 1.5, borderColor: '#E4E4E7', marginTop: 2, ...Shadow.md, zIndex: 999 },
  mfDropItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.gray50 },
  mfDropItemActive: { backgroundColor: Colors.primary + '10' },
  mfDropTxt: { fontSize: 13, color: '#A4A4AD', fontWeight: '500' },
  mfActions: { flexDirection: 'row', gap: 10, marginTop: 8, flexShrink: 0 },
  mfCancel: { flex: 1, height: 48, borderRadius: 12, borderWidth: 1.5, borderColor: '#E4E4E7', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.white },
  mfCancelTxt: { fontSize: 14, fontWeight: '700', color: Colors.gray600 },
  mfCreate: { flex: 2, height: 48, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', ...Shadow.sm },
  mfCreateTxt: { fontSize: 14, fontWeight: '700', color: '#fff' },

  section: { backgroundColor: Colors.white, borderRadius: 16, padding: 16, marginBottom: 14, ...Shadow.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  sectionIcon: { width: 26, height: 26, borderRadius: 8, backgroundColor: Colors.primary + '15', alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: Colors.gray700, letterSpacing: 0.3 },

  label: { fontSize: 13, fontWeight: '600', color: Colors.gray700, marginBottom: 6 },
  fieldWrap: { marginBottom: 14 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  errorTxt: { fontSize: 11, color: Colors.danger, fontWeight: '500' },

  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F9FAFB', borderRadius: 12,
    borderWidth: 1.5, borderColor: '#E4E4E7',
    paddingHorizontal: 12, minHeight: 50,
  },
  inputError: { borderColor: Colors.danger, backgroundColor: Colors.dangerLight },
  inputMultiline: { alignItems: 'flex-start', paddingVertical: 12 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: Colors.gray900, paddingVertical: 0 },
  inputArea: { minHeight: 90, paddingTop: 0 },

  dropTxt: { flex: 1, fontSize: 15, color: Colors.gray900 },
  dropList: { backgroundColor: Colors.white, borderRadius: 12, borderWidth: 1.5, borderColor: '#E4E4E7', marginTop: 4, ...Shadow.md, zIndex: 99 },
  dropItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: Colors.gray50 },
  dropItemActive: { backgroundColor: Colors.primary + '10' },
  dropItemTxt: { fontSize: 14, color: Colors.gray800, fontWeight: '500' },
  dropItemTxtActive: { color: Colors.primary, fontWeight: '700' },

  bottomBar: {
    flexDirection: 'row', gap: 12,
    paddingHorizontal: 16, paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    backgroundColor: Colors.white,
    borderTopWidth: 1, borderTopColor: Colors.gray100,
    ...Shadow.lg,
  },
  cancelBtn: { flex: 1, height: 52, borderRadius: 14, borderWidth: 1.5, borderColor: Colors.gray300, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.white },
  cancelTxt: { fontSize: 15, fontWeight: '700', color: Colors.gray600 },
  saveBtn: { flex: 2, height: 52, borderRadius: 14, backgroundColor: Colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, ...Shadow.md },
  saveTxt: { fontSize: 15, fontWeight: '700', color: '#fff' },

  toast: {
    position: 'absolute', bottom: 100, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.successDark, borderRadius: 12,
    paddingHorizontal: 18, paddingVertical: 12, ...Shadow.lg,
  },
  toastTxt: { fontSize: 14, color: '#fff', fontWeight: '700' },
});
