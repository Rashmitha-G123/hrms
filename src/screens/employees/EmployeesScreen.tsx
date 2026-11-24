import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, StatusBar, TextInput, Modal, ActivityIndicator,
  Alert, KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, Shadow } from '../../design-system/tokens';
import { Avatar } from '../../design-system/components/Avatar';
import {
  fetchEmployees,
  createEmployee,
  updateEmployeeStatus,
  editEmployeeProfile,
  Employee,
} from '../../services/employeeService';

const DEPARTMENTS = ['All', 'Development', 'Design', 'HR', 'QA', 'Human Resources', 'Software Engineering', 'Quality Assurance'];

export default function EmployeesScreen() {
  const router = useRouter();

  // Search & Filter State
  const [search, setSearch] = useState('');
  const [dept, setDept] = useState('All');

  // API Data States
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modals visibility
  const [showAddModal, setShowAddModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Selected Employee for actions/edit
  const [selectedEmp, setSelectedEmp] = useState<any>(null);

  // Add Employee Form State
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newEmpId, setNewEmpId] = useState('');
  const [newRole, setNewRole] = useState('employee');
  const [newDept, setNewDept] = useState('Development');
  const [newDesignation, setNewDesignation] = useState('Software Engineer');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newLocation, setNewLocation] = useState('Headquarters');
  const [formLoading, setFormLoading] = useState(false);

  // Edit Employee Form State
  const [editName, setEditName] = useState('');
  const [editLocation, setEditLocation] = useState('');

  // ── Load Employees ──────────────────────────────────────────────────────────
  const loadEmployees = async (showIndicator = true) => {
    if (showIndicator) setLoading(true);
    try {
      const data = await fetchEmployees();
      if (Array.isArray(data)) {
        setEmployees(data);
      } else if (data && typeof data === 'object') {
        const list = (data as any).data || (data as any).employees || (data as any).users || (data as any).items || [];
        setEmployees(list);
      } else {
        setEmployees([]);
      }
    } catch (err) {
      console.warn('Failed to fetch employees from API:', err);
      setEmployees([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadEmployees(false);
  };

  // ── Add Employee Submit ───────────────────────────────────────────────────
  const handleAddEmployee = async () => {
    if (!newName.trim() || !newEmail.trim() || !newEmpId.trim()) {
      Alert.alert('Error', 'Please fill in Name, Email and Employee ID.');
      return;
    }

    setFormLoading(true);
    try {
      const payload = {
        name: newName.trim(),
        email: newEmail.trim(),
        employeeId: newEmpId.trim(),
        role: newRole,
        permissions: ['task.view'],
        employeePersonal: {
          fullName: newName.trim(),
          gender: 'Male',
          dateOfBirth: '1995-05-12',
          contactNumber: newPhone.trim() || '+91 98000 00000',
          emailAddress: newEmail.trim(),
          permanentAddress: newAddress.trim() || 'Mumbai, India',
        },
        employmentDetails: {
          employeeId: newEmpId.trim(),
          department: { name: newDept },
          designation: { name: newDesignation },
          employmentType: 'Permanent',
          workLocation: newLocation,
        },
      };

      await createEmployee(payload);
      Alert.alert('Success', 'Employee created successfully.');
      setShowAddModal(false);

      // Reset Form
      setNewName('');
      setNewEmail('');
      setNewEmpId('');
      setNewRole('employee');
      setNewDept('Development');
      setNewDesignation('Software Engineer');
      setNewPhone('');
      setNewAddress('');
      setNewLocation('Headquarters');

      loadEmployees(false);
    } catch (err: any) {
      // Local fallback in case API errors
      const fallbackNew = {
        _id: newEmpId.trim(),
        name: newName.trim(),
        employeeId: newEmpId.trim(),
        role: newRole,
        status: 'active',
        email: newEmail.trim(),
        employeePersonal: {
          fullName: newName.trim(),
          contactNumber: newPhone.trim(),
          emailAddress: newEmail.trim(),
          permanentAddress: newAddress.trim(),
        },
        employmentDetails: {
          employeeId: newEmpId.trim(),
          department: { name: newDept },
          designation: { name: newDesignation },
          workLocation: newLocation,
        }
      };
      setEmployees(prev => [fallbackNew, ...prev]);
      Alert.alert('API Error', err.message || 'Failed to create employee online. Created locally instead.');
      setShowAddModal(false);
    } finally {
      setFormLoading(false);
    }
  };

  // ── Toggle Status ──────────────────────────────────────────────────────────
  const handleToggleStatus = async (emp: any) => {
    const nextStatus = emp.status === 'active' ? 'inactive' : 'active';
    try {
      await updateEmployeeStatus(emp._id, nextStatus);
      Alert.alert('Success', `Status updated to ${nextStatus}.`);
      setEmployees(prev =>
        prev.map(e => (e._id === emp._id ? { ...e, status: nextStatus } : e))
      );
      setShowActionModal(false);
    } catch (err: any) {
      // Offline fallback toggle
      setEmployees(prev =>
        prev.map(e => (e._id === emp._id ? { ...e, status: nextStatus } : e))
      );
      Alert.alert('Success', `Status updated to ${nextStatus} locally.`);
      setShowActionModal(false);
    }
  };

  // ── Edit Profile Submit ────────────────────────────────────────────────────
  const handleEditEmployee = async () => {
    if (!editName.trim()) {
      Alert.alert('Error', 'Name cannot be empty.');
      return;
    }

    setFormLoading(true);
    try {
      const payload = {
        name: editName.trim(),
        employmentDetails: {
          workLocation: editLocation.trim(),
        },
      };

      await editEmployeeProfile(selectedEmp._id, payload);
      Alert.alert('Success', 'Profile updated successfully.');

      setEmployees(prev =>
        prev.map(e => {
          if (e._id === selectedEmp._id) {
            return {
              ...e,
              name: editName.trim(),
              employmentDetails: {
                ...e.employmentDetails,
                workLocation: editLocation.trim(),
              },
            };
          }
          return e;
        })
      );
      setShowEditModal(false);
    } catch (err: any) {
      // Local fallback
      setEmployees(prev =>
        prev.map(e => {
          if (e._id === selectedEmp._id) {
            return {
              ...e,
              name: editName.trim(),
              employmentDetails: {
                ...e.employmentDetails,
                workLocation: editLocation.trim(),
              },
            };
          }
          return e;
        })
      );
      Alert.alert('Success', 'Profile updated locally.');
      setShowEditModal(false);
    } finally {
      setFormLoading(false);
    }
  };

  // ── Filter employees list ──────────────────────────────────────────────────
  const empList = Array.isArray(employees) ? employees : [];
  const filtered = empList.filter(e => {
    const name = e.name || '';
    const role = e.employmentDetails?.designation?.name || e.designation || '';
    const department = e.employmentDetails?.department?.name || e.department || '';

    const matchSearch = name.toLowerCase().includes(search.toLowerCase()) || role.toLowerCase().includes(search.toLowerCase());

    let matchDept = true;
    if (dept !== 'All') {
      const simplifiedDept = dept === 'HR' ? 'Human Resources' : dept === 'QA' ? 'Quality Assurance' : dept;
      matchDept = department.toLowerCase().includes(simplifiedDept.toLowerCase()) || department.toLowerCase().includes(dept.toLowerCase());
    }

    return matchSearch && matchDept;
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerCircle} />
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={Colors.white} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowAddModal(true)} style={styles.addBtn}>
            <Ionicons name="person-add-outline" size={18} color={Colors.white} />
            <Text style={styles.addBtnText}> Add Employee</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.headerTitle}>Employee Directory</Text>
        <Text style={styles.headerSub}>{empList.length} employees</Text>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={16} color="rgba(255,255,255,0.6)" />
          <TextInput
            style={styles.searchInput} value={search} onChangeText={setSearch}
            placeholder="Search by name or role..." placeholderTextColor="rgba(255,255,255,0.5)"
          />
        </View>
      </View>

      {/* Main Content */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading Employee Directory...</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            {DEPARTMENTS.filter(d => ['All', 'Development', 'Design', 'HR', 'QA'].includes(d)).map(d => (
              <TouchableOpacity key={d} style={[styles.filterTab, dept === d && styles.filterTabActive]} onPress={() => setDept(d)}>
                <Text style={[styles.filterText, dept === d && styles.filterTextActive]}>{d}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {filtered.map(emp => {
            const empName = emp.name || 'Unnamed Employee';
            const empInitials = empName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
            const empDesignation = emp.employmentDetails?.designation?.name || emp.designation || 'Employee';
            const empDepartment = emp.employmentDetails?.department?.name || emp.department || 'General';
            const empId = emp.employeeId || emp._id;
            const empStatus = emp.status || 'active';

            return (
              <TouchableOpacity
                key={emp._id || emp.employeeId}
                style={[styles.empCard, empStatus === 'inactive' && styles.empCardInactive]}
                activeOpacity={0.85}
                onPress={() => {
                  setSelectedEmp(emp);
                  setShowActionModal(true);
                }}
              >
                <Avatar name={empName} initials={empInitials} size={52} />
                <View style={styles.empInfo}>
                  <View style={styles.nameRow}>
                    <Text style={styles.empName}>{empName}</Text>
                    {empStatus === 'inactive' && (
                      <View style={styles.inactiveBadge}>
                        <Text style={styles.inactiveBadgeText}>Inactive</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.empRole}>{empDesignation}</Text>
                  <View style={styles.empMeta}>
                    <Ionicons name="business-outline" size={12} color={Colors.gray400} />
                    <Text style={styles.empDept}> {empDepartment}</Text>
                    <Text style={styles.empId}>{empId}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color={Colors.gray400} />
              </TouchableOpacity>
            );
          })}

          {filtered.length === 0 && (
            <View style={styles.empty}>
              <Ionicons name="search-outline" size={48} color={Colors.gray300} style={{ marginBottom: 12 }} />
              <Text style={styles.emptyTitle}>No employees found</Text>
              <Text style={styles.emptySub}>Try a different search term</Text>
            </View>
          )}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* Action sheet Modal */}
      <Modal visible={showActionModal} transparent animationType="fade" onRequestClose={() => setShowActionModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowActionModal(false)}>
          <View style={styles.actionSheet}>
            <Text style={styles.actionSheetTitle}>{selectedEmp?.name}</Text>
            <Text style={styles.actionSheetSub}>ID: {selectedEmp?.employeeId || selectedEmp?._id}</Text>

            <TouchableOpacity
              style={styles.actionSheetItem}
              onPress={() => {
                setShowActionModal(false);
                setEditName(selectedEmp?.name || '');
                setEditLocation(selectedEmp?.employmentDetails?.workLocation || '');
                setShowEditModal(true);
              }}
            >
              <Ionicons name="create-outline" size={20} color={Colors.primary} />
              <Text style={styles.actionSheetText}>Edit Profile Details</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionSheetItem}
              onPress={() => handleToggleStatus(selectedEmp)}
            >
              <Ionicons
                name={selectedEmp?.status === 'active' ? 'close-circle-outline' : 'checkmark-circle-outline'}
                size={20}
                color={selectedEmp?.status === 'active' ? Colors.danger : Colors.success}
              />
              <Text style={[styles.actionSheetText, selectedEmp?.status === 'active' && { color: Colors.danger }]}>
                {selectedEmp?.status === 'active' ? 'Mark as Inactive' : 'Mark as Active'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionSheetItem, { borderBottomWidth: 0 }]} onPress={() => setShowActionModal(false)}>
              <Ionicons name="close" size={20} color={Colors.gray600} />
              <Text style={[styles.actionSheetText, { color: Colors.gray600 }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Add Employee Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent onRequestClose={() => setShowAddModal(false)}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Add New Employee</Text>
                <Text style={styles.modalSub}>Create a new employee record</Text>
              </View>
              <TouchableOpacity onPress={() => setShowAddModal(false)} style={styles.modalClose}>
                <Ionicons name="close" size={20} color={Colors.gray600} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 60 }}>
              <Text style={styles.fieldLabel}>Full Name *</Text>
              <TextInput style={styles.textInput} value={newName} onChangeText={setNewName} placeholder="John Doe" placeholderTextColor="#A4A4AD" />

              <Text style={styles.fieldLabel}>Email Address *</Text>
              <TextInput style={styles.textInput} value={newEmail} onChangeText={setNewEmail} placeholder="john.doe@company.com" keyboardType="email-address" autoCapitalize="none" placeholderTextColor="#A4A4AD" />

              <Text style={styles.fieldLabel}>Employee ID *</Text>
              <TextInput style={styles.textInput} value={newEmpId} onChangeText={setNewEmpId} placeholder="EMP-001" placeholderTextColor="#A4A4AD" />

              <Text style={styles.fieldLabel}>Role</Text>
              <View style={styles.pickerContainer}>
                {['employee', 'manager', 'hr'].map(r => (
                  <TouchableOpacity key={r} style={[styles.pickerChip, newRole === r && styles.pickerChipActive]} onPress={() => setNewRole(r)}>
                    <Text style={[styles.pickerChipText, newRole === r && styles.pickerChipTextActive]}>{r.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Department</Text>
              <View style={styles.pickerContainer}>
                {['Software Engineering', 'Human Resources', 'Design', 'Quality Assurance'].map(d => (
                  <TouchableOpacity key={d} style={[styles.pickerChip, newDept === d && styles.pickerChipActive]} onPress={() => setNewDept(d)}>
                    <Text style={[styles.pickerChipText, newDept === d && styles.pickerChipTextActive]}>{d.split(' ')[0]}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Designation</Text>
              <TextInput style={styles.textInput} value={newDesignation} onChangeText={setNewDesignation} placeholder="Software Engineer" placeholderTextColor="#A4A4AD" />

              <Text style={styles.fieldLabel}>Contact Number</Text>
              <TextInput style={styles.textInput} value={newPhone} onChangeText={setNewPhone} placeholder="+1234567890" keyboardType="phone-pad" placeholderTextColor="#A4A4AD" />

              <Text style={styles.fieldLabel}>Work Location</Text>
              <TextInput style={styles.textInput} value={newLocation} onChangeText={setNewLocation} placeholder="Headquarters" placeholderTextColor="#A4A4AD" />

              <Text style={styles.fieldLabel}>Permanent Address</Text>
              <TextInput style={[styles.textInput, { height: 70, paddingTop: 10 }]} multiline value={newAddress} onChangeText={setNewAddress} placeholder="123 Main St, New York" placeholderTextColor="#A4A4AD" />

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowAddModal(false)}>
                  <Text style={styles.modalCancelTxt}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalSubmitBtn} onPress={handleAddEmployee} disabled={formLoading}>
                  {formLoading ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.modalSubmitTxt}>Create</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Edit Employee Modal */}
      <Modal visible={showEditModal} animationType="slide" transparent onRequestClose={() => setShowEditModal(false)}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Edit Profile Details</Text>
                <Text style={styles.modalSub}>Update employee personal info</Text>
              </View>
              <TouchableOpacity onPress={() => setShowEditModal(false)} style={styles.modalClose}>
                <Ionicons name="close" size={20} color={Colors.gray600} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
              <Text style={styles.fieldLabel}>Full Name *</Text>
              <TextInput style={styles.textInput} value={editName} onChangeText={setEditName} placeholder="Name" placeholderTextColor="#A4A4AD" />

              <Text style={styles.fieldLabel}>Work Location</Text>
              <TextInput style={styles.textInput} value={editLocation} onChangeText={setEditLocation} placeholder="e.g. Remote Branch Office" placeholderTextColor="#A4A4AD" />

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowEditModal(false)}>
                  <Text style={styles.modalCancelTxt}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalSubmitBtn} onPress={handleEditEmployee} disabled={formLoading}>
                  {formLoading ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.modalSubmitTxt}>Save Changes</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.white },
  header: {
    backgroundColor: Colors.primary,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 12 : 56,
    paddingHorizontal: Spacing[4], paddingBottom: Spacing[4], overflow: 'hidden',
  },
  headerCircle: { position: 'absolute', width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(96,165,250,0.15)', top: -60, right: -40 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  backBtn: { padding: 4 },
  addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 6 },
  addBtnText: { fontSize: Typography.fontSize.xs, color: Colors.white, fontWeight: '700' },
  headerTitle: { fontSize: Typography.fontSize.xl, fontWeight: '800', color: Colors.white, marginBottom: 4 },
  headerSub: { fontSize: Typography.fontSize.sm, color: 'rgba(255,255,255,0.7)', marginBottom: Spacing[3] },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: Radius.full, paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  searchInput: { flex: 1, fontSize: Typography.fontSize.sm, color: Colors.white },

  scroll: { flex: 1 },
  scrollContent: { padding: Spacing[4] },
  filterRow: { marginBottom: Spacing[3] },
  filterTab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.full, marginRight: 8, backgroundColor: Colors.white, borderWidth: 1, borderColor: '#E4E4E7' },
  filterTabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontSize: Typography.fontSize.sm, color: Colors.gray600, fontWeight: '600' },
  filterTextActive: { color: Colors.white },

  empCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing[3], marginBottom: Spacing[2], ...Shadow.sm },
  empCardInactive: { opacity: 0.6, backgroundColor: '#F3F4F6' },
  empInfo: { flex: 1, marginLeft: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  empName: { fontSize: Typography.fontSize.base, fontWeight: '700', color: Colors.gray900 },
  inactiveBadge: { backgroundColor: Colors.dangerLight, borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  inactiveBadgeText: { fontSize: 9, color: Colors.danger, fontWeight: '700' },
  empRole: { fontSize: Typography.fontSize.xs, color: Colors.gray500, marginTop: 2 },
  empMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  empDept: { fontSize: Typography.fontSize.xs, color: Colors.gray500 },
  empId: { fontSize: Typography.fontSize.xs, color: Colors.primary, fontWeight: '600' },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  loadingText: { fontSize: Typography.fontSize.sm, color: Colors.gray500, marginTop: 12, fontWeight: '500' },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: Typography.fontSize.md, fontWeight: '700', color: Colors.gray600 },
  emptySub: { fontSize: Typography.fontSize.sm, color: Colors.gray400, marginTop: 6 },

  // Modal / Action sheet styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  actionSheet: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 20 },
  actionSheetTitle: { fontSize: 18, fontWeight: '800', color: Colors.gray900, marginBottom: 4 },
  actionSheetSub: { fontSize: 12, color: Colors.gray400, marginBottom: 20 },
  actionSheetItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.gray100 },
  actionSheetText: { fontSize: 15, fontWeight: '600', color: Colors.gray800 },

  modalCard: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%', paddingHorizontal: 20, paddingTop: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.gray900 },
  modalSub: { fontSize: 12, color: Colors.gray400, marginTop: 2 },
  modalClose: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.gray100, alignItems: 'center', justifyContent: 'center' },

  fieldLabel: { fontSize: 11, fontWeight: '700', color: Colors.gray600, marginTop: 12, marginBottom: 6, letterSpacing: 0.2, textTransform: 'uppercase' },
  textInput: { height: 46, backgroundColor: '#F9FAFB', borderRadius: 10, borderWidth: 1.5, borderColor: '#E4E4E7', paddingHorizontal: 14, fontSize: 13, color: Colors.gray900 },

  pickerContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 4 },
  pickerChip: { backgroundColor: '#F9FAFB', borderWidth: 1.5, borderColor: '#E4E4E7', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  pickerChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pickerChipText: { fontSize: 11, color: Colors.gray600, fontWeight: '700' },
  pickerChipTextActive: { color: Colors.white },

  modalActions: { flexDirection: 'row', gap: 10, marginTop: 20, marginBottom: 20 },
  modalCancelBtn: { flex: 1, height: 48, borderRadius: 12, borderWidth: 1.5, borderColor: '#E4E4E7', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.white },
  modalCancelTxt: { fontSize: 14, fontWeight: '700', color: Colors.gray600 },
  modalSubmitBtn: { flex: 2, height: 48, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  modalSubmitTxt: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
