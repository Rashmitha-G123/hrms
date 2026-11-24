import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Platform, StatusBar, KeyboardAvoidingView,
  Alert, ActivityIndicator, Dimensions, Modal
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, Shadow } from '../../design-system/tokens';
import { useAuth } from '../../context/AuthContext';
import {
  createLeadApi,
  updateLeadApi,
  fetchLeadDetails,
  fetchCommonSettings,
  CommonSettingItem,
  getBadgeColor,
  DEFAULT_LEAD_STATUSES,
  DEFAULT_LEAD_STAGES,
  DEFAULT_LEAD_SOURCES,
} from '../../services/leadService';
import { fetchEmployeesSelectionApi } from '../../services/employeeService';

export default function AddLeadScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; leadId?: string; leadData?: string }>();
  const rawId = params.id || params.leadId;
  const leadId = rawId && rawId.trim() !== '' ? rawId.trim() : undefined;
  const isEdit = Boolean(leadId);
  const [leadMongoId, setLeadMongoId] = useState<string>(leadId || '');

  const { user } = useAuth();

  // ── Form State ───────────────────────────────────────────────────────────────
  const [leadType, setLeadType] = useState<'company' | 'individual'>('company');

  // Fields according to the image
  const [mobile, setMobile] = useState('');
  const [nameOrCompany, setNameOrCompany] = useState(''); // Company Name if Corporate, Client Name if Individual
  const [email, setEmail] = useState('');
  const [assignedTo, setAssignedTo] = useState('');

  const [status, setStatus] = useState('Unattended');
  const [stage, setStage] = useState('Unattended');
  const [source, setSource] = useState('Website');

  const [managersFeedback, setManagersFeedback] = useState('');
  const [asmFeedback, setAsmFeedback] = useState('');
  const [tlFeedback, setTlFeedback] = useState('');

  const [location, setLocation] = useState('');
  const [projectValue, setProjectValue] = useState(''); // Extra field for Individual Client (Optional)

  const [details, setDetails] = useState(''); // Rich details / notes

  // ── Master Lists & Selectors ─────────────────────────────────────────────────
  const [statusesList, setStatusesList] = useState<CommonSettingItem[]>(DEFAULT_LEAD_STATUSES);
  const [stagesList, setStagesList] = useState<CommonSettingItem[]>(DEFAULT_LEAD_STAGES);
  const [sourcesList, setSourcesList] = useState<CommonSettingItem[]>(DEFAULT_LEAD_SOURCES);
  const [employeesList, setEmployeesList] = useState<any[]>([]);

  const [loadingInitial, setLoadingInitial] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const toTitleCase = (str?: string): string => {
    if (!str) return '';
    return str
      .toLowerCase()
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const normalizeStatusForApi = (rawStatus: string): string => {
    const s = rawStatus.trim().toLowerCase();
    if (s === 'in progress' || s === 'in_progress') return 'in_progress';
    if (s === 'proposal sent' || s === 'proposal_sent') return 'proposal_sent';
    if (s === 'on hold' || s === 'on_hold') return 'on_hold';
    if (s === 'booked lead' || s === 'booked') return 'booked';
    if (s === 'dead lead' || s === 'dead') return 'dead';
    return s;
  };

  const resetForm = () => {
    setLeadType('company');
    setMobile('');
    setNameOrCompany('');
    setEmail('');
    setAssignedTo('');
    setStatus(statusesList[0]?.name ? toTitleCase(statusesList[0].name) : 'Unattended');
    setStage(stagesList[0]?.name ? toTitleCase(stagesList[0].name) : 'Unattended');
    setSource(sourcesList[0]?.name || 'Website');
    setManagersFeedback('');
    setAsmFeedback('');
    setTlFeedback('');
    setLocation('');
    setProjectValue('');
    setDetails('');
    setLeadMongoId('');
    setFieldErrors({});
  };

  const populateLeadFields = (l: any) => {
    if (!l) return;
    if (l._id) setLeadMongoId(l._id);
    const type = (l.leadType === 'individual' ? 'individual' : 'company') as 'company' | 'individual';
    setLeadType(type);
    setMobile(l.mobile || l.phone || l.contactNumber || '');
    const cName = l.corporateDetails?.companyName || l.companyName || l.name || '';
    const iName = l.name || l.contactPerson || '';
    setNameOrCompany(type === 'company' ? cName : iName);
    setEmail(l.email || '');

    const empId =
      l.assignedTo?._id ||
      l.assignedTo?.id ||
      (typeof l.assignedTo === 'string' ? l.assignedTo : '') ||
      l.assignedExecutiveId ||
      '';
    setAssignedTo(empId);

    if (l.status) setStatus(toTitleCase(l.status.replace(/_/g, ' ')));
    if (l.stage) setStage(toTitleCase(l.stage.replace(/_/g, ' ')));
    if (l.source) setSource(toTitleCase(l.source.replace(/_/g, ' ')));

    setManagersFeedback(l.managersFeedback || l.managerFeedback || '');
    setAsmFeedback(l.asmFeedback || '');
    setTlFeedback(l.tlFeedback || '');

    setLocation(l.location || l.city || '');
    const val =
      l.projectValue !== undefined && l.projectValue !== null
        ? String(l.projectValue)
        : l.estimatedPrice !== undefined && l.estimatedPrice !== null
          ? String(l.estimatedPrice)
          : l.paymentDetails?.totalAgreedAmount !== undefined && l.paymentDetails?.totalAgreedAmount !== null
            ? String(l.paymentDetails.totalAgreedAmount)
            : '';
    setProjectValue(val);
    setDetails(l.details || l.notes || l.description || '');
  };

  // Active Dropdown state
  const [openDropdown, setOpenDropdown] = useState<'status' | 'stage' | 'source' | 'assignee' | null>(null);

  // ── Initial Fetch: Master Settings + Lead Details (if Edit) ───────────────────
  useEffect(() => {
    let isMounted = true;
    (async () => {
      setLoadingInitial(true);
      try {
        const [statusRes, stageRes, sourceRes, empRes] = await Promise.all([
          fetchCommonSettings('lead_status'),
          fetchCommonSettings('lead_stage'),
          fetchCommonSettings('lead_source'),
          fetchEmployeesSelectionApi(1, 100).catch(() => ({ employees: [] })),
        ]);

        if (isMounted) {
          if (statusRes && statusRes.length > 0) {
            setStatusesList(statusRes);
            if (!isEdit) setStatus(toTitleCase(statusRes[0].name));
          }
          if (stageRes && stageRes.length > 0) {
            setStagesList(stageRes);
            if (!isEdit) setStage(toTitleCase(stageRes[0].name));
          }
          if (sourceRes && sourceRes.length > 0) {
            setSourcesList(sourceRes);
            if (!isEdit) setSource(toTitleCase(sourceRes[0].name));
          }
          if (empRes?.employees?.length > 0) {
            setEmployeesList(empRes.employees);
          }
        }

        // If leadData was passed in route params, populate immediately
        let dataPopulated = false;
        if (params.leadData && params.leadData.trim() !== '') {
          try {
            const parsed = JSON.parse(params.leadData);
            if (isMounted && parsed) {
              populateLeadFields(parsed);
              dataPopulated = true;
            }
          } catch (e) {
            console.warn('Failed to parse leadData param:', e);
          }
        }

        // If Edit Mode and not yet populated, fetch current lead details
        if (leadId && !dataPopulated) {
          try {
            const detailRes = await fetchLeadDetails(leadId);
            const rawLead: any = (detailRes as any)?.data || (detailRes as any)?.lead || detailRes;
            if (isMounted && rawLead) {
              populateLeadFields(rawLead);
            }
          } catch (fetchErr: any) {
            console.warn('Fallback lead detail fetch notice:', fetchErr?.message);
          }
        } else if (!leadId) {
          // Add Mode: reset form completely to avoid showing previous edit data
          if (isMounted) {
            resetForm();
          }
        }
      } catch (err) {
        console.warn('Error loading lead form data:', err);
      } finally {
        if (isMounted) setLoadingInitial(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [leadId, params.leadData]);

  // Cascade Rule: Do NOT restrict stages forcefully unless explicitly configured
  // This allows stages matching user screenshots ('LOST', 'UNATTENDED', 'DISCOVERY', 'PROPOSAL', 'NEGOTIATION', 'WON')
  const allowedStages = useMemo(() => {
    if (!status || stagesList.length === 0) return stagesList;
    const hasStatusMapping = stagesList.some(
      (sItem) => Array.isArray(sItem.data?.statuses) && sItem.data!.statuses.length > 0
    );
    if (!hasStatusMapping) return stagesList;

    const filtered = stagesList.filter((sItem) => {
      const allowed = sItem.data?.statuses;
      if (!Array.isArray(allowed) || allowed.length === 0) return true;
      return allowed.some((st) => st.trim().toUpperCase() === status.trim().toUpperCase());
    });
    return filtered.length > 0 ? filtered : stagesList;
  }, [status, stagesList]);

  // Auto-select valid stage if needed
  useEffect(() => {
    if (allowedStages.length > 0 && stage) {
      const currentValid = allowedStages.some(
        (st) => st.name.trim().toLowerCase() === stage.trim().toLowerCase()
      );
      if (!currentValid) {
        setStage(allowedStages[0].name);
      }
    }
  }, [allowedStages, stage]);

  const currentStatusObj = useMemo(
    () => statusesList.find((s) => s.name.toLowerCase() === status.toLowerCase()),
    [statusesList, status]
  );
  const currentStageObj = useMemo(
    () => stagesList.find((s) => s.name.toLowerCase() === stage.toLowerCase()),
    [stagesList, stage]
  );

  const statusColor = getBadgeColor(currentStatusObj?.data?.color);
  const stageColor = getBadgeColor(currentStageObj?.data?.color);

  // ── Validation ───────────────────────────────────────────────────────────────
  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!mobile.trim()) {
      errors.mobile = 'Contact number is required';
    } else if (!/^\+?[\d\s\-]{7,15}$/.test(mobile.trim())) {
      errors.mobile = 'Enter a valid contact number (7-15 digits)';
    }

    if (!nameOrCompany.trim()) {
      errors.nameOrCompany = leadType === 'company' ? 'Company / Business name is required' : 'Client name is required';
    }

    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Enter a valid email address';
    }

    if (!assignedTo) {
      errors.assignedTo = 'Executive assignment is required';
    }

    if (!source) {
      errors.source = 'Source is required';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ── Submit / Save Lead ───────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!validate()) {
      Alert.alert('Required Fields', 'Please complete all required fields (*)');
      return;
    }

    setSubmitting(true);
    setFieldErrors({});

    try {
      const parsedProjectVal = projectValue.trim() ? parseFloat(projectValue.trim()) : undefined;

      const payload: any = {
        leadType,
        mobile: mobile.trim(),
        email: email.trim() || undefined,
        assignedTo: assignedTo || undefined,
        status: normalizeStatusForApi(status),
        stage: stage.trim(),
        source: source.trim(),
        managersFeedback: managersFeedback.trim() || undefined,
        asmFeedback: asmFeedback.trim() || undefined,
        tlFeedback: tlFeedback.trim() || undefined,
        location: location.trim() || undefined,
        details: details.trim() || undefined,
        notes: details.trim() || undefined,
      };

      if (leadType === 'company') {
        payload.companyName = nameOrCompany.trim();
        payload.name = nameOrCompany.trim();
        payload.corporateDetails = {
          companyName: nameOrCompany.trim(),
        };
      } else {
        payload.name = nameOrCompany.trim();
        payload.companyName = undefined;
        if (parsedProjectVal !== undefined && !isNaN(parsedProjectVal)) {
          payload.projectValue = parsedProjectVal;
          payload.estimatedPrice = parsedProjectVal;
        }
      }

      const targetId = leadMongoId || leadId;
      if (isEdit && targetId) {
        // Section 1: Always pass the 24-character hexadecimal _id in PUT /api/leads/:id
        await updateLeadApi(targetId, payload);
        Alert.alert('Success', 'Lead updated successfully!', [
          { text: 'OK', onPress: () => router.replace('/(tabs)/leads' as any) }
        ]);
      } else {
        await createLeadApi(payload);
        Alert.alert('Success', `${leadType === 'company' ? 'Corporate' : 'Individual'} lead created successfully!`, [
          { text: 'OK', onPress: () => router.replace('/(tabs)/leads' as any) }
        ]);
      }
    } catch (err: any) {
      const msg: string = err.message || `Failed to ${isEdit ? 'update' : 'create'} lead.`;
      const lower = msg.toLowerCase();
      const newErrors: Record<string, string> = {};

      if (lower.includes('duplicate') || lower.includes('already exists')) {
        if (lower.includes('email')) {
          newErrors.email = 'A lead with this email address already exists.';
        }
        if (lower.includes('mobile') || lower.includes('phone') || lower.includes('contact')) {
          newErrors.mobile = 'A lead with this contact number already exists.';
        }
        // If message is generic duplicate but doesn't mention field specifically
        if (!newErrors.email && !newErrors.mobile) {
          newErrors.mobile = 'Duplicate lead detected with this contact number.';
          if (email.trim()) {
            newErrors.email = 'Duplicate lead detected with this email address.';
          }
        }
        setFieldErrors((prev) => ({ ...prev, ...newErrors }));
      }

      Alert.alert('Duplicate Record', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const getEmployeeDesignation = (emp: any): string => {
    if (!emp) return '';
    if (typeof emp.designation === 'string' && emp.designation.trim() && emp.designation.toLowerCase() !== 'n/a') {
      return emp.designation.trim();
    }
    if (typeof emp.designation === 'object' && emp.designation?.name) {
      return emp.designation.name.trim();
    }
    if (typeof emp.employmentDetails?.designation === 'string' && emp.employmentDetails.designation.trim()) {
      return emp.employmentDetails.designation.trim();
    }
    if (typeof emp.employmentDetails?.designation?.name === 'string') {
      return emp.employmentDetails.designation.name.trim();
    }
    if (typeof emp.role === 'string' && emp.role.trim() && emp.role.toLowerCase() !== 'n/a') {
      return emp.role.trim();
    }
    if (typeof emp.department === 'string' && emp.department.trim()) {
      return emp.department.trim();
    }
    if (typeof emp.department?.name === 'string') {
      return emp.department.name.trim();
    }
    return 'Sales Executive';
  };

  const selectedExecutive = employeesList.find(
    (e) => (e._id || e.id || e.employeeId) === assignedTo
  );

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} translucent />

      {/* Header matching standard HRMS screens */}
      <View style={s.header}>
        <View style={s.headerCircle} />
        <View style={s.headerRow}>
          <TouchableOpacity
            onPress={() => router.replace('/(tabs)/leads' as any)}
            style={s.backBtn}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={22} color={Colors.white} />
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={[s.badgeSmall, leadType === 'individual' && { backgroundColor: 'rgba(243,232,255,0.25)', borderColor: '#E9D5FF' }]}>
              <Text style={s.badgeSmallTxt}>
                {leadType === 'company' ? 'Corporate' : 'Individual'}
              </Text>
            </View>
          </View>
        </View>

        <Text style={s.headerTitle}>
          {isEdit ? 'Edit Lead' : 'Create New Lead'}
        </Text>
        <Text style={s.headerSub}>
          {isEdit
            ? 'Update lead details, pipeline stage, and notes'
            : leadType === 'company'
              ? 'Register a new B2B corporate lead'
              : 'Register a new individual client record'}
        </Text>
      </View>

      {loadingInitial ? (
        <View style={s.centerLoading}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={{ marginTop: 10, color: Colors.gray500, fontSize: 13 }}>Loading lead details...</Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 20}
        >
          <ScrollView
            style={s.scroll}
            contentContainerStyle={s.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* ── Lead Type / Category Tabs ── */}
            <View style={s.leadTypeContainer}>
              <View style={s.leadTypeHeaderRow}>
                <Text style={s.sectionFieldLabel}>Lead Type / Category</Text>
                <Text style={s.leadTypeHelper}>
                  {leadType === 'company' ? 'Converts to Company + Project on Won' : 'Direct Project Value tracking'}
                </Text>
              </View>

              <View style={s.tabToggleRow}>
                <TouchableOpacity
                  style={[s.tabToggleBtn, leadType === 'company' && s.tabToggleBtnActive]}
                  onPress={() => {
                    setLeadType('company');
                    setFieldErrors({});
                  }}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name="business-outline"
                    size={16}
                    color={leadType === 'company' ? Colors.white : Colors.gray600}
                  />
                  <Text style={[s.tabToggleTxt, leadType === 'company' && s.tabToggleTxtActive]}>
                    Corporate / Business
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[s.tabToggleBtn, leadType === 'individual' && s.tabToggleBtnActive]}
                  onPress={() => {
                    setLeadType('individual');
                    setFieldErrors({});
                  }}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name="person-outline"
                    size={16}
                    color={leadType === 'individual' ? Colors.white : Colors.gray600}
                  />
                  <Text style={[s.tabToggleTxt, leadType === 'individual' && s.tabToggleTxtActive]}>
                    Individual Client
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ── ROW 1: Contact Number * & Company / Client Name * ── */}
            <View style={s.formRow}>
              <View style={[s.formCol, { flex: 1 }]}>
                <Text style={s.fieldLabel}>
                  Contact Number <Text style={s.req}>*</Text>
                </Text>
                <TextInput
                  style={[s.inputBox, !!fieldErrors.mobile && s.inputError]}
                  placeholder="Enter contact number"
                  placeholderTextColor={Colors.gray400}
                  keyboardType="phone-pad"
                  value={mobile}
                  onChangeText={(v) => {
                    setMobile(v);
                    if (fieldErrors.mobile) setFieldErrors((p) => ({ ...p, mobile: '' }));
                  }}
                />
                {!!fieldErrors.mobile && <Text style={s.errTxt}>{fieldErrors.mobile}</Text>}
              </View>

              <View style={[s.formCol, { flex: 1 }]}>
                <Text style={s.fieldLabel}>
                  {leadType === 'company' ? 'Company / Business Name' : 'Client / Full Name'} <Text style={s.req}>*</Text>
                </Text>
                <TextInput
                  style={[s.inputBox, !!fieldErrors.nameOrCompany && s.inputError]}
                  placeholder={leadType === 'company' ? 'e.g. Acme Technologies' : 'e.g. John Doe'}
                  placeholderTextColor={Colors.gray400}
                  value={nameOrCompany}
                  onChangeText={(v) => {
                    setNameOrCompany(v);
                    if (fieldErrors.nameOrCompany) setFieldErrors((p) => ({ ...p, nameOrCompany: '' }));
                  }}
                />
                {!!fieldErrors.nameOrCompany && <Text style={s.errTxt}>{fieldErrors.nameOrCompany}</Text>}
              </View>
            </View>

            {/* ── ROW 2: Email & Select Executive * ── */}
            <View style={s.formRow}>
              <View style={[s.formCol, { flex: 1 }]}>
                <Text style={s.fieldLabel}>Email Address</Text>
                <TextInput
                  style={[s.inputBox, !!fieldErrors.email && s.inputError]}
                  placeholder="Enter email address"
                  placeholderTextColor={Colors.gray400}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={(v) => {
                    setEmail(v);
                    if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: '' }));
                  }}
                />
                {!!fieldErrors.email && <Text style={s.errTxt}>{fieldErrors.email}</Text>}
              </View>

              <View style={[s.formCol, { flex: 1 }]}>
                <Text style={s.fieldLabel}>
                  Select Executive <Text style={s.req}>*</Text>
                </Text>
                <TouchableOpacity
                  style={[s.selectBox, !!fieldErrors.assignedTo && s.inputError]}
                  onPress={() => setOpenDropdown('assignee')}
                  activeOpacity={0.8}
                >
                  <Text style={[s.selectValTxt, !assignedTo && { color: Colors.gray400, fontWeight: '400' }]} numberOfLines={1}>
                    {selectedExecutive
                      ? `${selectedExecutive.name} | ${getEmployeeDesignation(selectedExecutive)}`
                      : 'Select Executive'}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={Colors.gray400} />
                </TouchableOpacity>
                {!!fieldErrors.assignedTo && <Text style={s.errTxt}>{fieldErrors.assignedTo}</Text>}
              </View>
            </View>

            {/* ── ROW 3: Status & Stage ── */}
            <View style={s.formRow}>
              <View style={[s.formCol, { flex: 1 }]}>
                <Text style={s.fieldLabel}>Status</Text>
                <TouchableOpacity
                  style={s.selectBox}
                  onPress={() => setOpenDropdown('status')}
                  activeOpacity={0.8}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                    <View style={[s.circleDot, { backgroundColor: statusColor.text }]} />
                    <Text style={s.selectValTxt} numberOfLines={1}>{toTitleCase(status)}</Text>
                  </View>
                  <Ionicons name="chevron-down" size={16} color={Colors.gray400} />
                </TouchableOpacity>
              </View>

              <View style={[s.formCol, { flex: 1 }]}>
                <Text style={s.fieldLabel}>Stage</Text>
                <TouchableOpacity
                  style={s.selectBox}
                  onPress={() => setOpenDropdown('stage')}
                  activeOpacity={0.8}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                    <View style={[s.circleDot, { backgroundColor: stageColor.text }]} />
                    <Text style={s.selectValTxt} numberOfLines={1}>{toTitleCase(stage)}</Text>
                  </View>
                  <Ionicons name="chevron-down" size={16} color={Colors.gray400} />
                </TouchableOpacity>
              </View>
            </View>

            {/* ── ROW 4: Select Source * & Managers Feedback ── */}
            <View style={s.formRow}>
              <View style={[s.formCol, { flex: 1 }]}>
                <Text style={s.fieldLabel}>
                  Select Source <Text style={s.req}>*</Text>
                </Text>
                <TouchableOpacity
                  style={[s.selectBox, !!fieldErrors.source && s.inputError]}
                  onPress={() => setOpenDropdown('source')}
                  activeOpacity={0.8}
                >
                  <Text style={[s.selectValTxt, !source && { color: Colors.gray400, fontWeight: '400' }]} numberOfLines={1}>
                    {source ? toTitleCase(source) : 'Select Source'}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={Colors.gray400} />
                </TouchableOpacity>
                {!!fieldErrors.source && <Text style={s.errTxt}>{fieldErrors.source}</Text>}
              </View>

              <View style={[s.formCol, { flex: 1 }]}>
                <Text style={s.fieldLabel}>Manager's Feedback</Text>
                <TextInput
                  style={[s.inputBox, s.textAreaInput]}
                  placeholder="Enter manager feedback"
                  placeholderTextColor={Colors.gray400}
                  multiline
                  numberOfLines={3}
                  value={managersFeedback}
                  onChangeText={setManagersFeedback}
                />
              </View>
            </View>

            {/* ── ROW 5: ASM Feedback & TL Feedback ── */}
            <View style={s.formRow}>
              <View style={[s.formCol, { flex: 1 }]}>
                <Text style={s.fieldLabel}>ASM Feedback</Text>
                <TextInput
                  style={[s.inputBox, s.textAreaInput]}
                  placeholder="Enter ASM feedback"
                  placeholderTextColor={Colors.gray400}
                  multiline
                  numberOfLines={3}
                  value={asmFeedback}
                  onChangeText={setAsmFeedback}
                />
              </View>

              <View style={[s.formCol, { flex: 1 }]}>
                <Text style={s.fieldLabel}>TL Feedback</Text>
                <TextInput
                  style={[s.inputBox, s.textAreaInput]}
                  placeholder="Enter TL feedback"
                  placeholderTextColor={Colors.gray400}
                  multiline
                  numberOfLines={3}
                  value={tlFeedback}
                  onChangeText={setTlFeedback}
                />
              </View>
            </View>

            {/* ── ROW 6: Location & (if Individual) Project Value (Optional) ── */}
            <View style={s.formRow}>
              <View style={[s.formCol, { flex: 1 }]}>
                <Text style={s.fieldLabel}>Location</Text>
                <TextInput
                  style={s.inputBox}
                  placeholder="Enter location"
                  placeholderTextColor={Colors.gray400}
                  value={location}
                  onChangeText={setLocation}
                />
              </View>

              {leadType === 'individual' ? (
                <View style={[s.formCol, { flex: 1 }]}>
                  <Text style={s.fieldLabel}>Project Value (Optional)</Text>
                  <TextInput
                    style={s.inputBox}
                    placeholder="Enter project value"
                    placeholderTextColor={Colors.gray400}
                    keyboardType="numeric"
                    value={projectValue}
                    onChangeText={setProjectValue}
                  />
                </View>
              ) : (
                <View style={[s.formCol, { flex: 1 }]} />
              )}
            </View>

            {/* ── ROW 7: Details (Notes & Scope) ── */}
            <View style={s.detailsContainer}>
              <Text style={s.fieldLabel}>Details</Text>
              <View style={s.richEditorBox}>
                <View style={s.editorToolbar}>
                  <View style={s.editorNormalSelect}>
                    <Text style={s.editorNormalTxt}>Normal</Text>
                    <Ionicons name="swap-vertical" size={12} color={Colors.gray600} />
                  </View>
                  <View style={s.toolbarDivider} />
                  <TouchableOpacity style={s.toolbarBtn}><Text style={s.toolbarBold}>B</Text></TouchableOpacity>
                  <TouchableOpacity style={s.toolbarBtn}><Text style={s.toolbarItalic}>I</Text></TouchableOpacity>
                  <TouchableOpacity style={s.toolbarBtn}><Text style={s.toolbarUnderline}>U</Text></TouchableOpacity>
                  <TouchableOpacity style={s.toolbarBtn}><Text style={s.toolbarStrike}>S</Text></TouchableOpacity>
                  <TouchableOpacity style={s.toolbarBtn}><Ionicons name="chatbox-ellipses-outline" size={13} color={Colors.gray600} /></TouchableOpacity>
                  <TouchableOpacity style={s.toolbarBtn}><Ionicons name="list" size={13} color={Colors.gray600} /></TouchableOpacity>
                  <TouchableOpacity style={s.toolbarBtn}><Ionicons name="reorder-four" size={13} color={Colors.gray600} /></TouchableOpacity>
                  <TouchableOpacity style={s.toolbarBtn}><Ionicons name="link-outline" size={13} color={Colors.gray600} /></TouchableOpacity>
                  <TouchableOpacity style={s.toolbarBtn}><Ionicons name="image-outline" size={13} color={Colors.gray600} /></TouchableOpacity>
                  <TouchableOpacity style={s.toolbarBtn}><Ionicons name="grid-outline" size={13} color={Colors.gray600} /></TouchableOpacity>
                  <TouchableOpacity style={s.toolbarBtn}><Ionicons name="code-slash-outline" size={13} color={Colors.gray600} /></TouchableOpacity>
                </View>
                <TextInput
                  style={s.detailsInput}
                  placeholder="Enter details..."
                  placeholderTextColor={Colors.gray400}
                  multiline
                  value={details}
                  onChangeText={setDetails}
                />
              </View>
            </View>

            {/* ── Bottom Action Buttons ── */}
            <View style={s.btnRow}>
              <TouchableOpacity
                style={s.cancelBtn}
                onPress={() => router.replace('/(tabs)/leads' as any)}
                disabled={submitting}
                activeOpacity={0.8}
              >
                <Text style={s.cancelBtnTxt}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.createBtn, submitting && s.createBtnDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
                activeOpacity={0.85}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name={isEdit ? 'save-outline' : 'checkmark-circle-outline'} size={18} color="#fff" />
                    <Text style={s.createBtnTxt}>
                      {isEdit ? 'Save Changes' : 'Create Lead'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <View style={{ height: 120 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {/* ── Dropdown Selection Modal (Solves scroll issue) ── */}
      <Modal
        visible={openDropdown !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setOpenDropdown(null)}
      >
        <TouchableOpacity
          style={s.modalOverlay}
          activeOpacity={1}
          onPress={() => setOpenDropdown(null)}
        >
          <View style={s.modalCard} onStartShouldSetResponder={() => true}>
            <View style={s.modalCardHeader}>
              <Text style={s.modalCardHeaderTxt}>
                {openDropdown === 'status' && 'Select Status'}
                {openDropdown === 'stage' && 'Select Stage'}
                {openDropdown === 'source' && 'Select Source'}
                {openDropdown === 'assignee' && 'Select Executive'}
              </Text>
              <TouchableOpacity
                onPress={() => setOpenDropdown(null)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="close" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ maxHeight: 360 }}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
              bounces={false}
            >
              {openDropdown === 'status' &&
                statusesList.map((st) => {
                  const isSelected = st.name.trim().toLowerCase() === status.trim().toLowerCase();
                  const c = getBadgeColor(st.data?.color);
                  return (
                    <TouchableOpacity
                      key={st._id || st.name}
                      style={[s.dropdownRow, isSelected && s.dropdownRowActive]}
                      onPress={() => {
                        setStatus(toTitleCase(st.name));
                        setOpenDropdown(null);
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                        <View style={[s.circleDot, { backgroundColor: isSelected ? '#FFFFFF' : c.text }]} />
                        <Text style={[s.dropdownRowTxt, isSelected && s.dropdownRowTxtActive]}>
                          {toTitleCase(st.name)}
                        </Text>
                      </View>
                      {isSelected && <Ionicons name="checkmark" size={18} color="#FFFFFF" />}
                    </TouchableOpacity>
                  );
                })}

              {openDropdown === 'stage' &&
                allowedStages.map((stg) => {
                  const isSelected = stg.name.trim().toLowerCase() === stage.trim().toLowerCase();
                  const c = getBadgeColor(stg.data?.color);
                  return (
                    <TouchableOpacity
                      key={stg._id || stg.name}
                      style={[s.dropdownRow, isSelected && s.dropdownRowActive]}
                      onPress={() => {
                        setStage(toTitleCase(stg.name));
                        setOpenDropdown(null);
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                        <View style={[s.circleDot, { backgroundColor: isSelected ? '#FFFFFF' : c.text }]} />
                        <Text style={[s.dropdownRowTxt, isSelected && s.dropdownRowTxtActive]}>
                          {toTitleCase(stg.name)}
                        </Text>
                      </View>
                      {isSelected && <Ionicons name="checkmark" size={18} color="#FFFFFF" />}
                    </TouchableOpacity>
                  );
                })}

              {openDropdown === 'source' &&
                sourcesList.map((src) => {
                  const isSelected = src.name.trim().toLowerCase() === source.trim().toLowerCase();
                  return (
                    <TouchableOpacity
                      key={src._id || src.name}
                      style={[s.dropdownRow, isSelected && s.dropdownRowActive]}
                      onPress={() => {
                        setSource(toTitleCase(src.name));
                        setOpenDropdown(null);
                        if (fieldErrors.source) setFieldErrors((p) => ({ ...p, source: '' }));
                      }}
                    >
                      <Text style={[s.dropdownRowTxt, isSelected && s.dropdownRowTxtActive]}>
                        {toTitleCase(src.name)}
                      </Text>
                      {isSelected && <Ionicons name="checkmark" size={18} color="#FFFFFF" />}
                    </TouchableOpacity>
                  );
                })}

              {openDropdown === 'assignee' &&
                employeesList.map((emp) => {
                  const empId = emp._id || emp.id || emp.employeeId;
                  const isSelected = assignedTo === empId;
                  const desig = getEmployeeDesignation(emp);
                  return (
                    <TouchableOpacity
                      key={empId}
                      style={[s.dropdownRow, isSelected && s.dropdownRowActive]}
                      onPress={() => {
                        setAssignedTo(empId);
                        setOpenDropdown(null);
                        if (fieldErrors.assignedTo) setFieldErrors((p) => ({ ...p, assignedTo: '' }));
                      }}
                    >
                      <Text style={[s.dropdownRowTxt, isSelected && s.dropdownRowTxtActive]} numberOfLines={1}>
                        {emp.name} | {desig}
                      </Text>
                      {isSelected && <Ionicons name="checkmark" size={18} color="#FFFFFF" />}
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
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
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing[2],
  },
  backBtn: {
    padding: Spacing[1],
  },
  headerTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: '800',
    color: Colors.white,
    marginBottom: 4,
  },
  headerSub: {
    fontSize: Typography.fontSize.sm,
    color: 'rgba(255,255,255,0.8)',
  },
  badgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  badgeSmallTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.white,
  },
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: Spacing[4],
  },
  leadTypeContainer: {
    marginBottom: 16,
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing[3],
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadow.sm,
  },
  leadTypeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionFieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.gray700,
    letterSpacing: 0.2,
  },
  leadTypeHelper: {
    fontSize: 10,
    color: Colors.gray400,
    fontStyle: 'italic',
  },
  tabToggleRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: Radius.md,
    overflow: 'hidden',
    padding: 3,
    backgroundColor: '#F8FAFC',
    gap: 4,
  },
  tabToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: Radius.sm,
    gap: 6,
  },
  tabToggleBtnActive: {
    backgroundColor: Colors.primary,
  },
  tabToggleTxt: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.gray600,
  },
  tabToggleTxtActive: {
    color: Colors.white,
    fontWeight: '700',
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
    zIndex: 1,
    alignItems: 'flex-start',
  },
  formCol: {
    position: 'relative',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
    letterSpacing: 0.2,
    marginBottom: 6,
  },
  req: {
    color: '#EF4444',
    fontWeight: '700',
  },
  inputBox: {
    height: 44,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    fontSize: 13,
    fontWeight: '500',
    color: Colors.gray900,
    backgroundColor: Colors.white,
  },
  inputError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  errTxt: {
    fontSize: 11,
    color: '#EF4444',
    marginTop: 3,
    fontWeight: '500',
  },
  selectBox: {
    height: 44,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
  },
  selectValTxt: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.gray900,
  },
  circleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxHeight: 460,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.lg,
    overflow: 'hidden',
    ...Shadow.lg,
    elevation: 24,
  },
  modalCardHeader: {
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  modalCardHeaderTxt: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.6,
  },
  dropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dropdownRowActive: {
    backgroundColor: '#2563EB',
  },
  dropdownRowTxt: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.gray700,
  },
  dropdownRowTxtActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  textAreaInput: {
    height: 72,
    textAlignVertical: 'top',
    paddingTop: 8,
  },
  detailsContainer: {
    marginBottom: 20,
  },
  richEditorBox: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: Colors.white,
  },
  editorToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 8,
    flexWrap: 'wrap',
  },
  editorNormalSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  editorNormalTxt: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.gray700,
  },
  toolbarDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#CBD5E1',
    marginHorizontal: 2,
  },
  toolbarBtn: {
    padding: 3,
  },
  toolbarBold: {
    fontWeight: '800',
    fontSize: 13,
    color: Colors.gray700,
  },
  toolbarItalic: {
    fontStyle: 'italic',
    fontWeight: '700',
    fontSize: 13,
    color: Colors.gray700,
  },
  toolbarUnderline: {
    textDecorationLine: 'underline',
    fontWeight: '700',
    fontSize: 13,
    color: Colors.gray700,
  },
  toolbarStrike: {
    textDecorationLine: 'line-through',
    fontWeight: '700',
    fontSize: 13,
    color: Colors.gray700,
  },
  detailsInput: {
    height: 110,
    padding: 12,
    fontSize: 13,
    color: Colors.gray900,
    textAlignVertical: 'top',
  },
  btnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
  },
  cancelBtn: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: Colors.white,
  },
  cancelBtnTxt: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.gray600,
    letterSpacing: 0.3,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: Radius.md,
    backgroundColor: '#7C3AED',
  },
  createBtnDisabled: {
    opacity: 0.6,
  },
  createBtnTxt: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.white,
    letterSpacing: 0.3,
  },
});
