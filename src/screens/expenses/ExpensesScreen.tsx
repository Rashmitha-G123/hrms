import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, StatusBar, Alert, ActivityIndicator, Modal, TextInput,
  RefreshControl, KeyboardAvoidingView, Dimensions
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import { Colors, Typography, Spacing, Radius, Shadow, IconBox } from '../../design-system/tokens';
import {
  fetchMyExpenses,
  fetchAllExpenses,
  submitExpenseApi,
  updateExpenseStatusApi,
  ExpenseItem,
} from '../../services/expenseService';
import { fetchEmployees, Employee } from '../../services/employeeService';
import { fetchProfile, getCachedUser } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const { width: SCREEN_W } = Dimensions.get('window');
const isSmall = SCREEN_W < 380;
const CARD_W = (SCREEN_W - 16 * 2 - 10) / 2;

const EXPENSE_CATEGORIES: { label: string; iconName: IoniconName; color: string }[] = [
  { label: 'Food', iconName: 'restaurant-outline', color: '#F59E0B' },
  { label: 'Travel', iconName: 'airplane-outline', color: '#0EA5E9' },
  { label: 'Office Supplies', iconName: 'briefcase-outline', color: '#10B981' },
  { label: 'Communication', iconName: 'call-outline', color: '#6366F1' },
  { label: 'Accommodation', iconName: 'bed-outline', color: '#8B5CF6' },
  { label: 'Others', iconName: 'ellipsis-horizontal-circle-outline', color: '#64748B' },
];

export default function ExpensesScreen() {
  const router = useRouter();
  const { hasPermission, hasAnyPermission, canViewModule, user: authUser } = useAuth();

  // Role & Current User State
  const [userRole, setUserRole] = useState<'employee' | 'admin' | 'hr' | 'superadmin'>('employee');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const isAdmin = userRole === 'admin' || userRole === 'superadmin' || userRole === 'hr';

  // Permission Checks based on Web Matrix
  const canSubmit = isAdmin || hasPermission('expense.submit');
  const canApprove = isAdmin || hasPermission('expense.approve');
  const canViewAll = isAdmin || hasAnyPermission(['expense.view_all', 'expense.approve']);

  // Admin Tab: 'requests' (Employee Requests) vs 'my' (My Claims)
  const [adminTab, setAdminTab] = useState<'requests' | 'my'>(canViewAll ? 'requests' : 'my');

  // Expenses Data
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [personalExpenses, setPersonalExpenses] = useState<ExpenseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Detail Modal State
  const [selectedExpense, setSelectedExpense] = useState<ExpenseItem | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);

  // Admin Rejection Modal State
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  // Submit Modal State
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Food');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [receiptFile, setReceiptFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);

  // Receipt File Helpers
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIconAndBadge = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') {
      return { icon: 'document-text-outline' as const, color: '#EF4444', badge: 'PDF', bg: '#FEE2E2' };
    }
    if (ext === 'docx' || ext === 'doc') {
      return { icon: 'document-attach-outline' as const, color: '#2563EB', badge: 'DOCX', bg: '#EFF6FF' };
    }
    return { icon: 'image-outline' as const, color: '#10B981', badge: ext ? ext.toUpperCase() : 'IMG', bg: '#E8F8EE' };
  };

  const handlePickReceipt = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'image/jpeg',
          'image/png',
          'image/jpg',
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/msword',
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      const ext = asset.name.split('.').pop()?.toLowerCase();
      const validExtensions = ['jpg', 'jpeg', 'png', 'docx', 'pdf', 'doc'];
      if (!validExtensions.includes(ext || '')) {
        Alert.alert(
          'Unsupported File Format',
          'Please upload a receipt in JPG, JPEG, PNG, DOCX, or PDF format.'
        );
        return;
      }

      setReceiptFile(asset);
    } catch (err: any) {
      console.warn('Error picking receipt document:', err);
      Alert.alert('File Picker Error', 'Could not open document picker. Please try again.');
    }
  };

  // Admin Generate on behalf of employee state
  const [claimFor, setClaimFor] = useState<'myself' | 'employee'>('myself');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showEmployeePicker, setShowEmployeePicker] = useState(false);
  const [empSearch, setEmpSearch] = useState('');
  const [assigningExpenseId, setAssigningExpenseId] = useState<string | null>(null);
  const [expenseEmpMap, setExpenseEmpMap] = useState<Record<string, { _id?: string; employeeId?: string; name: string }>>({});

  // ── Role & Profile Initialization & Mapping Loading ───────────────────────
  useEffect(() => {
    AsyncStorage.getItem('@hrms_expense_emp_map')
      .then(stored => {
        if (stored) {
          try {
            setExpenseEmpMap(JSON.parse(stored));
          } catch (_) { }
        }
      })
      .catch(() => { });

    getCachedUser().then(u => {
      if (u) {
        setCurrentUser(u);
        if (u.role) {
          const r = u.role.toLowerCase();
          setUserRole(r as any);
        }
      }
    });

    fetchProfile()
      .then(p => {
        if (p?.user) {
          setCurrentUser(p.user);
          if (p.user.role) {
            const r = p.user.role.toLowerCase();
            setUserRole(r as any);
          }
        }
      })
      .catch(() => { });

    fetchEmployees()
      .then(emps => {
        if (Array.isArray(emps)) setEmployees(emps);
      })
      .catch(() => { });
  }, []);

  // ── Load Expenses based on Role & Active Tab ──────────────────────────────
  const loadExpenses = useCallback(async (isPull = false) => {
    if (!isPull) setLoading(true);
    try {
      const isPrivileged = canViewAll;

      // Always load personal expenses for stats so stats remain previous & constant
      const myRes = await fetchMyExpenses().catch(() => null);
      if (myRes && Array.isArray(myRes.data)) {
        setPersonalExpenses(myRes.data);
      }

      let res;
      if (isPrivileged && adminTab === 'requests') {
        res = await fetchAllExpenses();
      } else {
        res = myRes || (await fetchMyExpenses());
      }

      if (res && Array.isArray(res.data)) {
        setExpenses(res.data);
      } else {
        setExpenses([]);
      }
    } catch (err: any) {
      console.warn('Failed to load expenses:', err);
      setExpenses([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userRole, adminTab, canViewAll]);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  const onRefresh = () => {
    setRefreshing(true);
    loadExpenses(true);
  };

  // ── Stats Calculations (Keep previous constant stats) ─────────────────────
  const statsSource = personalExpenses.length > 0 ? personalExpenses : expenses;

  const totalPending = useMemo(() => {
    return statsSource
      .filter(e => (e.status || '').toLowerCase() === 'pending')
      .reduce((a, e) => a + (Number(e.amount) || 0), 0);
  }, [statsSource]);

  const totalApproved = useMemo(() => {
    return statsSource
      .filter(e => (e.status || '').toLowerCase() === 'approved')
      .reduce((a, e) => a + (Number(e.amount) || 0), 0);
  }, [statsSource]);

  const totalRejected = useMemo(() => {
    return statsSource
      .filter(e => (e.status || '').toLowerCase() === 'rejected')
      .reduce((a, e) => a + (Number(e.amount) || 0), 0);
  }, [statsSource]);

  const totalAmount = useMemo(() => {
    return statsSource.reduce((a, e) => a + (Number(e.amount) || 0), 0);
  }, [statsSource]);

  const stats = [
    {
      label: 'Total Expenses',
      value: String(statsSource.length),
      icon: 'wallet-outline' as const,
      color: '#2563EB',
      bgColor: '#DBEAFE',
      filter: 'all' as const,
    },
    {
      label: 'Pending',
      value: `₹${totalPending.toLocaleString()}`,
      icon: 'time-outline' as const,
      color: '#F59E0B',
      bgColor: '#FEF3C7',
      filter: 'pending' as const,
    },
    {
      label: 'Approved',
      value: `₹${totalApproved.toLocaleString()}`,
      icon: 'checkmark-circle-outline' as const,
      color: '#10B981',
      bgColor: '#D1FAE5',
      filter: 'approved' as const,
    },
    {
      label: 'Rejected',
      value: `₹${totalRejected.toLocaleString()}`,
      icon: 'alert-circle-outline' as const,
      color: '#EF4444',
      bgColor: '#FEE2E2',
      filter: 'rejected' as const,
    },
  ];

  // ── Helper to Clean Embedded Employee Metadata from Description ────────────
  const cleanDescription = (desc?: string): string => {
    if (!desc) return '';
    return desc
      .replace(/^\[For:\s*[^\]]+\]\s*/i, '')
      .replace(/^\[Employee:\s*[^\]]+\]\s*/i, '')
      .trim();
  };

  // ── Resolve Employee Information for an Expense ───────────────────────────
  const resolveEmployeeInfo = useCallback(
    (expense?: ExpenseItem | null) => {
      if (!expense) {
        return { name: 'Staff Member', id: '', initials: 'EM' };
      }

      // 1. Check local / persistent mapping by expense._id
      if (expense._id && expenseEmpMap[expense._id]) {
        const mapped = expenseEmpMap[expense._id];
        const match = employees.find(
          e => (mapped.employeeId && e.employeeId === mapped.employeeId) || (mapped._id && e._id === mapped._id)
        );
        const name = match?.name || mapped.name || 'Staff Member';
        const id = match?.employeeId || mapped.employeeId || '';
        return {
          name,
          id,
          initials: (name || 'EM').slice(0, 2).toUpperCase(),
        };
      }

      // 2. Check if description has embedded employee info [For: Name | ID] or [Employee: Name (ID)]
      if (expense.description) {
        const matchFor = expense.description.match(/^\[For:\s*([^|\]]+)(?:\s*\|\s*([^\]]+))?\]/i);
        if (matchFor) {
          const parsedName = matchFor[1].trim();
          const parsedId = (matchFor[2] || '').trim();
          const empMatch = employees.find(
            e =>
              e.name.toLowerCase() === parsedName.toLowerCase() ||
              (parsedId && (e.employeeId === parsedId || e._id === parsedId))
          );
          const name = empMatch?.name || parsedName;
          const id = empMatch?.employeeId || parsedId;
          return {
            name,
            id,
            initials: (name || 'EM').slice(0, 2).toUpperCase(),
          };
        }
        const matchEmp = expense.description.match(/^\[Employee:\s*([^(]+)(?:\s*\(([^)]+)\))?\]/i);
        if (matchEmp) {
          const parsedName = matchEmp[1].trim();
          const parsedId = (matchEmp[2] || '').trim();
          const empMatch = employees.find(
            e =>
              e.name.toLowerCase() === parsedName.toLowerCase() ||
              (parsedId && (e.employeeId === parsedId || e._id === parsedId))
          );
          const name = empMatch?.name || parsedName;
          const id = empMatch?.employeeId || parsedId;
          return {
            name,
            id,
            initials: (name || 'EM').slice(0, 2).toUpperCase(),
          };
        }
      }

      // 3. Check if expense has direct employeeId or empId matching an employee in list
      const empId = expense.employeeId || (expense as any).empId;
      if (empId && employees.length > 0) {
        const match = employees.find(e => e.employeeId === empId || e._id === empId);
        if (match) {
          return {
            name: match.name,
            id: match.employeeId || match._id,
            initials: (match.name.slice(0, 2)).toUpperCase(),
          };
        }
      }

      // 4. Check if expense.employee is an object with matching employee in list or name
      if (expense.employee && typeof expense.employee === 'object') {
        const empObjId = expense.employee.employeeId || (expense.employee as any)._id;
        if (empObjId && employees.length > 0) {
          const match = employees.find(e => e.employeeId === empObjId || e._id === empObjId);
          if (match) {
            return {
              name: match.name,
              id: match.employeeId || match._id,
              initials: (match.name.slice(0, 2)).toUpperCase(),
            };
          }
        }
        if (expense.employee.name) {
          return {
            name: expense.employee.name,
            id: expense.employee.employeeId || expense.employeeId || '',
            initials: (expense.employee.name.slice(0, 2)).toUpperCase(),
          };
        }
      }

      // 5. Check by string ID in expense.employee or userId
      const targetId =
        (typeof expense.employee === 'string' ? expense.employee : '') ||
        (expense as any).userId;
      if (targetId && employees.length > 0) {
        const match = employees.find(e => e._id === targetId || e.employeeId === targetId);
        if (match) {
          return {
            name: match.name,
            id: match.employeeId || match._id,
            initials: (match.name.slice(0, 2)).toUpperCase(),
          };
        }
      }

      // 6. Check direct employeeName field
      const directName = (expense as any).employeeName || (expense as any).name;
      if (directName) {
        return {
          name: directName,
          id: expense.employeeId || '',
          initials: (directName.slice(0, 2)).toUpperCase(),
        };
      }

      return {
        name: expense.employee?.name || (expense.employeeId ? `Employee (${expense.employeeId})` : 'Staff Member'),
        id: expense.employeeId || '',
        initials: (expense.employee?.name || 'EM').slice(0, 2).toUpperCase(),
      };
    },
    [employees, expenseEmpMap]
  );

  // ── Filtered List ─────────────────────────────────────────────────────────
  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      // If admin is viewing 'My Claims', exclude expenses that were created on behalf of employees
      const isOtherEmpClaim =
        Boolean(expenseEmpMap[e._id]) ||
        Boolean(e.description?.match(/^\[(?:For|Employee):/i));
      if (isAdmin && adminTab === 'my' && isOtherEmpClaim) {
        return false;
      }

      const empInfo = resolveEmployeeInfo(e);
      const cleanDesc = cleanDescription(e.description);
      const matchSearch =
        (e.title || '').toLowerCase().includes(search.toLowerCase()) ||
        (e.category || '').toLowerCase().includes(search.toLowerCase()) ||
        cleanDesc.toLowerCase().includes(search.toLowerCase()) ||
        empInfo.name.toLowerCase().includes(search.toLowerCase()) ||
        empInfo.id.toLowerCase().includes(search.toLowerCase());

      const statusKey = (e.status || 'pending').toLowerCase();
      const matchStatus = statusFilter === 'all' || statusKey === statusFilter;

      const matchCategory =
        !selectedCategory || (e.category || '').toLowerCase() === selectedCategory.toLowerCase();

      return matchSearch && matchStatus && matchCategory;
    });
  }, [expenses, search, statusFilter, selectedCategory, resolveEmployeeInfo, isAdmin, adminTab, expenseEmpMap]);

  // ── Create Expense (Self or for Employee if Admin) ─────────────────────────
  const handleCreateExpense = async () => {
    if (!title.trim()) {
      Alert.alert('Required Field', 'Please enter a title for the expense.');
      return;
    }
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount greater than 0.');
      return;
    }

    if (isAdmin && claimFor === 'employee' && !selectedEmployee) {
      Alert.alert('Required Field', 'Please select an employee to generate the expense for.');
      return;
    }

    setSubmitting(true);
    try {
      const isForEmployee = isAdmin && claimFor === 'employee' && selectedEmployee;
      const empTag = isForEmployee
        ? `[For: ${selectedEmployee.name}${selectedEmployee.employeeId ? ` | ${selectedEmployee.employeeId}` : ''}]`
        : '';
      const finalDescription = isForEmployee
        ? (description.trim() ? `${empTag} ${description.trim()}` : empTag)
        : description.trim();

      const payload: any = {
        title: title.trim(),
        category,
        amount: numAmount,
        date: date || new Date().toISOString().split('T')[0],
        description: finalDescription,
      };

      if (isForEmployee) {
        const empMongoId = selectedEmployee._id || '';
        const empCode = selectedEmployee.employeeId || '';
        payload.employee = empMongoId || empCode;
        payload.user = empMongoId || empCode;
        payload.userId = empMongoId || empCode;
        payload.employeeId = empCode || empMongoId;
        payload.empId = empCode || empMongoId;
        payload.employeeName = selectedEmployee.name;
        payload.name = selectedEmployee.name;
        payload.forEmployee = empMongoId || empCode;
        payload.targetUserId = empMongoId || empCode;
        payload.onBehalfOf = empMongoId || empCode;
        payload.applicant = empMongoId || empCode;
        payload.employeeDetails = {
          _id: empMongoId,
          name: selectedEmployee.name,
          employeeId: empCode,
          email: selectedEmployee.email,
        };
      }

      const completeSubmission = async (submitRes: any) => {
        const createdId = submitRes?.data?._id || (submitRes as any)?._id || (submitRes as any)?.data?.id;
        if (createdId && isForEmployee) {
          const newMapping = {
            ...expenseEmpMap,
            [createdId]: {
              _id: selectedEmployee._id,
              employeeId: selectedEmployee.employeeId,
              name: selectedEmployee.name,
            },
          };
          setExpenseEmpMap(newMapping);
          try {
            await AsyncStorage.setItem('@hrms_expense_emp_map', JSON.stringify(newMapping));
          } catch (e) {
            console.warn('Failed to save mapping:', e);
          }
        }

        Alert.alert(
          'Success',
          isAdmin && claimFor === 'employee' && selectedEmployee
            ? `Expense claim generated for ${selectedEmployee.name} successfully.`
            : 'Expense claim submitted successfully.'
        );
        setShowModal(false);
        setTitle('');
        setAmount('');
        setDescription('');
        setDate(new Date().toISOString().split('T')[0]);
        setReceiptFile(null);
        if (isAdmin && claimFor === 'employee') {
          setAdminTab('requests');
        }
        setSelectedEmployee(null);
        setClaimFor('myself');
        loadExpenses();
      };

      const handleUploadFailure = (uploadErr: any) => {
        Alert.alert(
          'Receipt Upload Failed',
          `${uploadErr.message || 'The server rejected the file upload.'}\n\nWould you like to submit this expense claim without the attached receipt?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Submit Without Receipt',
              onPress: async () => {
                setSubmitting(true);
                try {
                  const fallbackRes = await submitExpenseApi(payload, false);
                  await completeSubmission(fallbackRes);
                } catch (fallbackErr: any) {
                  Alert.alert('Submission Error', fallbackErr.message || 'Failed to submit expense claim.');
                } finally {
                  setSubmitting(false);
                }
              },
            },
          ]
        );
      };

      let res;
      if (receiptFile) {
        const buildFormData = (fileField: string) => {
          const fd = new FormData();
          fd.append('title', title.trim());
          fd.append('category', category);
          fd.append('amount', String(numAmount));
          fd.append('date', date || new Date().toISOString().split('T')[0]);
          if (finalDescription) {
            fd.append('description', finalDescription);
          }
          if (Platform.OS === 'web' && (receiptFile as any).file) {
            fd.append(fileField, (receiptFile as any).file);
          } else {
            const filePayload = {
              uri: receiptFile.uri,
              name: receiptFile.name,
              type: receiptFile.mimeType || 'image/jpeg',
            } as any;
            fd.append(fileField, filePayload);
          }
          if (isForEmployee) {
            const empMongoId = selectedEmployee._id || '';
            const empCode = selectedEmployee.employeeId || '';
            fd.append('employee', empMongoId || empCode);
            fd.append('employeeId', empCode || empMongoId);
            fd.append('employeeName', selectedEmployee.name);
          }
          return fd;
        };

        try {
          res = await submitExpenseApi(buildFormData('receipt'), true);
        } catch (firstErr: any) {
          if (
            firstErr.message &&
            (firstErr.message.includes('Unexpected field') || firstErr.message.includes('receipt'))
          ) {
            try {
              res = await submitExpenseApi(buildFormData('file'), true);
            } catch (secondErr: any) {
              handleUploadFailure(secondErr);
              return;
            }
          } else {
            handleUploadFailure(firstErr);
            return;
          }
        }
      } else {
        res = await submitExpenseApi(payload, false);
      }

      await completeSubmission(res);
      setClaimFor('myself');
      loadExpenses();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to submit expense claim.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Admin Actions: Approve Expense ────────────────────────────────────────
  const handleApproveExpense = async (expense: ExpenseItem) => {
    const empInfo = resolveEmployeeInfo(expense);
    Alert.alert(
      'Approve Claim',
      `Are you sure you want to approve this expense of ₹${Number(expense.amount).toLocaleString()} for ${empInfo.name || expense.title}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          style: 'default',
          onPress: async () => {
            setStatusUpdating(true);
            try {
              await updateExpenseStatusApi(expense._id, 'Approved');
              Alert.alert('Success', 'Expense claim approved successfully.');
              setShowDetailModal(false);
              loadExpenses();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to approve expense claim');
            } finally {
              setStatusUpdating(false);
            }
          },
        },
      ]
    );
  };

  // ── Admin Actions: Reject Expense ─────────────────────────────────────────
  const handleOpenReject = (expense: ExpenseItem) => {
    setSelectedExpense(expense);
    setRejectionReason('');
    setShowRejectModal(true);
  };

  const handleConfirmReject = async () => {
    if (!selectedExpense) return;
    setStatusUpdating(true);
    try {
      await updateExpenseStatusApi(selectedExpense._id, 'Rejected', rejectionReason.trim());
      Alert.alert('Claim Rejected', 'The expense claim has been rejected.');
      setShowRejectModal(false);
      setShowDetailModal(false);
      setRejectionReason('');
      loadExpenses();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to reject expense claim');
    } finally {
      setStatusUpdating(false);
    }
  };

  const getStatusConfig = (status: string) => {
    const s = (status || 'pending').toLowerCase();
    if (s === 'approved') {
      return { bg: '#D1FAE5', text: '#059669', border: '#A7F3D0', icon: 'checkmark-circle' };
    }
    if (s === 'rejected') {
      return { bg: '#FEE2E2', text: '#DC2626', border: '#FECACA', icon: 'close-circle' };
    }
    return { bg: '#FEF3C7', text: '#D97706', border: '#FDE68A', icon: 'time-outline' };
  };

  if (authUser && !canViewModule('expenses')) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', padding: 24 }}>
        <StatusBar barStyle="dark-content" />
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
          <Ionicons name="lock-closed" size={40} color="#DC2626" />
        </View>
        <Text style={{ fontSize: 20, fontWeight: '700', color: Colors.gray900, marginBottom: 8 }}>Access Restricted</Text>
        <Text style={{ fontSize: 14, color: Colors.gray500, textAlign: 'center', lineHeight: 22, maxWidth: 300, marginBottom: 24 }}>
          You do not have permission to view the Expense Management module. Contact your administrator if you need access.
        </Text>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
          style={{ backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
          activeOpacity={0.85}
        >
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ── Modern App Header ── */}
      <LinearGradient colors={['#2b7eff', '#2b7eff']} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={styles.blob} />
        <View style={styles.headerTop}>
          <TouchableOpacity
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
            style={styles.backBtn}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={20} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Expense Management</Text>
          {canSubmit && (
            <TouchableOpacity
              style={styles.headerAddBtn}
              onPress={() => setShowModal(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={17} color={Colors.white} />
              <Text style={styles.headerAddBtnTxt}>Claim</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.curve} />
      </LinearGradient>

      {/* ── Scrollable Body ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* ── Admin Switch: Employee Requests vs My Claims (Admin / Privileged Only) ── */}
        {canViewAll && (
          <View style={styles.adminTabRow}>
            <TouchableOpacity
              style={[styles.adminTabBtn, adminTab === 'requests' && styles.adminTabBtnActive]}
              onPress={() => setAdminTab('requests')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="people-outline"
                size={16}
                color={adminTab === 'requests' ? Colors.white : Colors.gray600}
              />
              <Text style={[styles.adminTabTxt, adminTab === 'requests' && styles.adminTabTxtActive]}>
                Employee Requests
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.adminTabBtn, adminTab === 'my' && styles.adminTabBtnActive]}
              onPress={() => setAdminTab('my')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="person-outline"
                size={16}
                color={adminTab === 'my' ? Colors.white : Colors.gray600}
              />
              <Text style={[styles.adminTabTxt, adminTab === 'my' && styles.adminTabTxtActive]}>
                My Claims
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Stats Grid (Matching Dashboard & Attendance 2x2 layout) ── */}
        <View style={styles.statsGrid}>
          {stats.map((item, i) => {
            const isSelected = statusFilter === item.filter;
            return (
              <TouchableOpacity
                key={i}
                style={[
                  styles.statCard,
                  { width: CARD_W },
                  Shadow.sm,
                  isSelected && styles.statCardSelected,
                ]}
                onPress={() => setStatusFilter(isSelected && item.filter !== 'all' ? 'all' : item.filter)}
                activeOpacity={0.82}
              >
                <View style={[styles.statIconBox, { backgroundColor: item.bgColor }]}>
                  <Ionicons name={item.icon as any} size={20} color={item.color} />
                </View>
                <View style={styles.statContent}>
                  <Text style={styles.statLabel} numberOfLines={1}>{item.label}</Text>
                  <Text style={styles.statValue} numberOfLines={1}>{item.value}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Search Input ── */}
        <View style={[styles.searchBox, Shadow.sm]}>
          <Ionicons name="search-outline" size={18} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder={
              isAdmin && adminTab === 'requests'
                ? 'Search by employee, title, category...'
                : 'Search claims by title or category...'
            }
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Category Filter Chips ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll} contentContainerStyle={styles.categoryScrollContent}>
          <TouchableOpacity
            style={[styles.catChip, !selectedCategory && styles.catChipActive]}
            onPress={() => setSelectedCategory(null)}
            activeOpacity={0.8}
          >
            <Text style={[styles.catChipText, !selectedCategory && styles.catChipTextActive]}>All Categories</Text>
          </TouchableOpacity>
          {EXPENSE_CATEGORIES.map(cat => {
            const active = selectedCategory?.toLowerCase() === cat.label.toLowerCase();
            return (
              <TouchableOpacity
                key={cat.label}
                style={[styles.catChip, active && styles.catChipActive]}
                onPress={() => setSelectedCategory(active ? null : cat.label)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={cat.iconName}
                  size={13}
                  color={active ? '#fff' : cat.color}
                  style={{ marginRight: 5 }}
                />
                <Text style={[styles.catChipText, active && styles.catChipTextActive]}>{cat.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Expense Items List Header ── */}
        <View style={styles.listHeaderRow}>
          <Text style={styles.listSectionTitle}>
            {selectedCategory
              ? `${selectedCategory} Claims`
              : isAdmin && adminTab === 'requests'
                ? statusFilter !== 'all'
                  ? `Employee ${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)} Requests`
                  : 'Employee Expense Requests'
                : statusFilter !== 'all'
                  ? `${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)} Claims`
                  : 'Recent Claims'}
          </Text>
          <Text style={styles.listCountText}>{filteredExpenses.length} records</Text>
        </View>

        {loading ? (
          <View style={styles.emptyStateBox}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.emptyLoadingText}>Loading expenses...</Text>
          </View>
        ) : filteredExpenses.length === 0 ? (
          <View style={styles.emptyStateBox}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="receipt-outline" size={32} color="#94A3B8" />
            </View>
            <Text style={styles.emptyTitle}>No expense claims found</Text>
            <Text style={styles.emptySub}>
              {search || selectedCategory || statusFilter !== 'all'
                ? 'Try clearing active filters to view records'
                : 'No claims submitted yet'}
            </Text>
          </View>
        ) : (
          filteredExpenses.map(expense => {
            const cat = EXPENSE_CATEGORIES.find(
              c => c.label.toLowerCase() === (expense.category || '').toLowerCase()
            );
            const statusConfig = getStatusConfig(expense.status);
            const isPending = (expense.status || '').toLowerCase() === 'pending';

            return (
              <TouchableOpacity
                key={expense._id}
                style={[styles.expenseCard, Shadow.sm]}
                activeOpacity={0.85}
                onPress={() => {
                  setSelectedExpense(expense);
                  setShowDetailModal(true);
                }}
              >
                {/* Employee Tag for Admin View */}
                {isAdmin && adminTab === 'requests' && (() => {
                  const empInfo = resolveEmployeeInfo(expense);
                  return (
                    <View style={styles.cardEmployeeRow}>
                      <View style={styles.cardEmployeeAvatar}>
                        <Text style={styles.cardEmployeeAvatarTxt}>
                          {empInfo.initials}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardEmployeeName} numberOfLines={1}>
                          {empInfo.name}
                        </Text>
                        {empInfo.id ? (
                          <Text style={styles.cardEmployeeId}>ID: {empInfo.id}</Text>
                        ) : null}
                      </View>
                    </View>
                  );
                })()}

                <View style={styles.cardTopRow}>
                  <View style={[styles.cardIconBox, { backgroundColor: `${cat?.color || '#3B82F6'}15` }]}>
                    <Ionicons name={cat?.iconName || 'receipt-outline'} size={20} color={cat?.color || '#3B82F6'} />
                  </View>

                  <View style={styles.cardMainInfo}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{expense.title}</Text>
                    <View style={styles.cardMetaRow}>
                      <Text style={styles.cardCategory}>{expense.category || 'General'}</Text>
                      <Text style={styles.cardDot}>•</Text>
                      <Ionicons name="calendar-outline" size={12} color="#94A3B8" />
                      <Text style={styles.cardDate}>
                        {new Date(expense.date).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardAmountCol}>
                    <Text style={styles.cardAmount}>₹{Number(expense.amount).toLocaleString()}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg, borderColor: statusConfig.border }]}>
                      <Text style={[styles.statusBadgeText, { color: statusConfig.text }]}>
                        {(expense.status || 'Pending').toUpperCase()}
                      </Text>
                    </View>
                  </View>
                </View>

                {cleanDescription(expense.description) ? (
                  <Text style={styles.cardDesc} numberOfLines={1}>
                    {cleanDescription(expense.description)}
                  </Text>
                ) : null}

                {expense.rejectionReason && (expense.status || '').toLowerCase() === 'rejected' && (
                  <View style={styles.rejectionBanner}>
                    <Ionicons name="alert-circle-outline" size={13} color="#DC2626" />
                    <Text style={styles.rejectionText} numberOfLines={1}>
                      Reason: {expense.rejectionReason}
                    </Text>
                  </View>
                )}

                {expense.receiptUrl && (
                  <View style={styles.receiptRow}>
                    <Ionicons name="document-attach-outline" size={13} color="#10B981" />
                    <Text style={styles.receiptText}>Receipt document attached</Text>
                  </View>
                )}

                {/* Quick Inline Approve/Reject for Admin / Approver */}
                {canApprove && adminTab === 'requests' && isPending && (
                  <View style={styles.cardQuickActionsRow}>
                    <TouchableOpacity
                      style={styles.cardRejectBtn}
                      onPress={() => handleOpenReject(expense)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="close-circle-outline" size={15} color="#DC2626" />
                      <Text style={styles.cardRejectTxt}>Reject</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.cardApproveBtn}
                      onPress={() => handleApproveExpense(expense)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="checkmark-circle-outline" size={15} color="#fff" />
                      <Text style={styles.cardApproveTxt}>Approve</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}

        {/* Space for bottom navigation tabs */}
        <View style={{ height: 110 }} />
      </ScrollView>

      {/* ── Claim Details Bottom Sheet Modal ── */}
      <Modal
        visible={showDetailModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDetailModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{selectedExpense?.title || 'Claim Details'}</Text>
                <Text style={styles.modalSub}>
                  {isAdmin && selectedExpense
                    ? (() => {
                        const empInfo = resolveEmployeeInfo(selectedExpense);
                        return `Claim by ${empInfo.name} ${empInfo.id ? `(${empInfo.id})` : ''}`;
                      })()
                    : 'Expense reimbursement request'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowDetailModal(false)} style={styles.modalClose}>
                <Ionicons name="close" size={20} color={Colors.gray600} />
              </TouchableOpacity>
            </View>

            {selectedExpense && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
                {/* Amount & Status highlight */}
                <View style={styles.detailHighlight}>
                  <View>
                    <Text style={styles.detailHighlightLabel}>AMOUNT CLAIMED</Text>
                    <Text style={styles.detailHighlightAmount}>
                      ₹{Number(selectedExpense.amount).toLocaleString()}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadgeLarge,
                      {
                        backgroundColor: getStatusConfig(selectedExpense.status).bg,
                        borderColor: getStatusConfig(selectedExpense.status).border,
                      },
                    ]}
                  >
                    <Ionicons
                      name={getStatusConfig(selectedExpense.status).icon as any}
                      size={14}
                      color={getStatusConfig(selectedExpense.status).text}
                      style={{ marginRight: 4 }}
                    />
                    <Text style={[styles.statusBadgeLargeText, { color: getStatusConfig(selectedExpense.status).text }]}>
                      {(selectedExpense.status || 'Pending').toUpperCase()}
                    </Text>
                  </View>
                </View>

                {/* Details Grid */}
                <View style={styles.detailInfoGrid}>
                  <View style={styles.detailInfoItem}>
                    <Text style={styles.detailInfoLabel}>CATEGORY</Text>
                    <Text style={styles.detailInfoValue}>{selectedExpense.category}</Text>
                  </View>
                  <View style={styles.detailInfoItem}>
                    <Text style={styles.detailInfoLabel}>EXPENSE DATE</Text>
                    <Text style={styles.detailInfoValue}>
                      {new Date(selectedExpense.date).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </Text>
                  </View>
                </View>

                {selectedExpense && (() => {
                  const empInfo = resolveEmployeeInfo(selectedExpense);
                  return (
                    <View style={styles.detailSection}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={styles.detailInfoLabel}>EMPLOYEE</Text>
                        {isAdmin && (
                          <TouchableOpacity
                            onPress={() => {
                              setAssigningExpenseId(selectedExpense._id);
                              setShowEmployeePicker(true);
                            }}
                            style={styles.reassignBtn}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="swap-horizontal" size={13} color={Colors.primary} />
                            <Text style={styles.reassignBtnTxt}>Change</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      <Text style={styles.detailDescText}>
                        {empInfo.name} {empInfo.id ? `(${empInfo.id})` : ''}
                      </Text>
                    </View>
                  );
                })()}

                {cleanDescription(selectedExpense.description) ? (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailInfoLabel}>PURPOSE / DESCRIPTION</Text>
                    <Text style={styles.detailDescText}>{cleanDescription(selectedExpense.description)}</Text>
                  </View>
                ) : null}

                {selectedExpense.receiptUrl ? (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailInfoLabel}>ATTACHED RECEIPT</Text>
                    <View style={styles.receiptDetailBox}>
                      <Ionicons name="document-attach-outline" size={18} color={Colors.primary} />
                      <Text style={styles.receiptDetailText} numberOfLines={1}>
                        {selectedExpense.receiptUrl.split('/').pop() || 'Receipt Document'}
                      </Text>
                      <View style={styles.receiptDetailBadge}>
                        <Text style={styles.receiptDetailBadgeText}>Attached</Text>
                      </View>
                    </View>
                  </View>
                ) : null}

                {selectedExpense.rejectionReason && (selectedExpense.status || '').toLowerCase() === 'rejected' && (
                  <View style={styles.detailRejectionBox}>
                    <Ionicons name="alert-circle" size={16} color="#DC2626" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.detailRejectionTitle}>Rejection Reason</Text>
                      <Text style={styles.detailRejectionMsg}>{selectedExpense.rejectionReason}</Text>
                    </View>
                  </View>
                )}

                {/* Approve / Reject actions in Detail modal */}
                {canApprove && (selectedExpense.status || '').toLowerCase() === 'pending' ? (
                  <View style={styles.modalReviewRow}>
                    <TouchableOpacity
                      style={styles.modalRejectBtn}
                      onPress={() => {
                        setShowDetailModal(false);
                        handleOpenReject(selectedExpense);
                      }}
                      disabled={statusUpdating}
                    >
                      <Ionicons name="close-circle-outline" size={17} color="#DC2626" />
                      <Text style={styles.modalRejectTxt}>Reject Claim</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.modalApproveBtn}
                      onPress={() => handleApproveExpense(selectedExpense)}
                      disabled={statusUpdating}
                    >
                      {statusUpdating ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="checkmark-circle-outline" size={17} color="#fff" />
                          <Text style={styles.modalApproveTxt}>Approve Claim</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.modalCancelBtn}
                    onPress={() => setShowDetailModal(false)}
                  >
                    <Text style={styles.modalCancelTxt}>Close</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Admin Reject Reason Modal ── */}
      <Modal
        visible={showRejectModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRejectModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalCard, { maxHeight: '75%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Reject Expense Claim</Text>
                <Text style={styles.modalSub}>
                  {selectedExpense
                    ? `Claim by ${resolveEmployeeInfo(selectedExpense).name}`
                    : 'State reason for rejecting'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowRejectModal(false)} style={styles.modalClose}>
                <Ionicons name="close" size={20} color={Colors.gray600} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              <Text style={styles.fieldLabel}>Quick Reason Presets</Text>
              <View style={styles.modalCatRow}>
                {[
                  'Receipt missing or unclear',
                  'Exceeds company policy limit',
                  'Duplicate expense claim',
                  'Non-business expense',
                ].map(r => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.modalCatChip, rejectionReason === r && styles.modalCatChipActive]}
                    onPress={() => setRejectionReason(r)}
                  >
                    <Text style={[styles.modalCatChipText, rejectionReason === r && styles.modalCatChipTextActive]}>
                      {r}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Rejection Reason / Remarks *</Text>
              <TextInput
                style={[styles.textInput, { height: 80, textAlignVertical: 'top', paddingTop: 10 }]}
                value={rejectionReason}
                onChangeText={setRejectionReason}
                placeholder="Explain why this claim was rejected..."
                multiline
                numberOfLines={3}
                placeholderTextColor="#A4A4AD"
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setShowRejectModal(false)}
                >
                  <Text style={styles.modalCancelTxt}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSubmitBtn, { backgroundColor: '#DC2626' }]}
                  onPress={handleConfirmReject}
                  disabled={statusUpdating}
                >
                  {statusUpdating ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.modalSubmitTxt}>Confirm Reject</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Employee Picker Modal for Admin ── */}
      <Modal
        visible={showEmployeePicker}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowEmployeePicker(false);
          setAssigningExpenseId(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '82%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {assigningExpenseId ? 'Reassign Employee' : 'Select Employee'}
                </Text>
                <Text style={styles.modalSub}>
                  {assigningExpenseId
                    ? 'Update the employee associated with this claim'
                    : 'Assign this expense claim to an employee'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setShowEmployeePicker(false);
                  setAssigningExpenseId(null);
                }}
                style={styles.modalClose}
              >
                <Ionicons name="close" size={20} color={Colors.gray600} />
              </TouchableOpacity>
            </View>

            <View style={[styles.searchBox, { marginBottom: 12 }]}>
              <Ionicons name="search-outline" size={18} color="#94A3B8" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name or employee ID..."
                placeholderTextColor="#94A3B8"
                value={empSearch}
                onChangeText={setEmpSearch}
              />
              {empSearch.length > 0 && (
                <TouchableOpacity onPress={() => setEmpSearch('')}>
                  <Ionicons name="close-circle" size={16} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              {employees
                .filter(e => {
                  const q = empSearch.toLowerCase();
                  return (
                    (e.name || '').toLowerCase().includes(q) ||
                    (e.employeeId || '').toLowerCase().includes(q) ||
                    (e.employmentDetails?.department?.name || '').toLowerCase().includes(q)
                  );
                })
                .map(emp => {
                  const isCurrent = assigningExpenseId
                    ? expenseEmpMap[assigningExpenseId]?.employeeId === emp.employeeId ||
                      expenseEmpMap[assigningExpenseId]?._id === emp._id
                    : selectedEmployee?._id === emp._id;
                  return (
                    <TouchableOpacity
                      key={emp._id}
                      style={[styles.empPickerItem, isCurrent && styles.empPickerItemActive]}
                      onPress={async () => {
                        if (assigningExpenseId) {
                          const newMapping = {
                            ...expenseEmpMap,
                            [assigningExpenseId]: {
                              _id: emp._id,
                              employeeId: emp.employeeId,
                              name: emp.name,
                            },
                          };
                          setExpenseEmpMap(newMapping);
                          try {
                            await AsyncStorage.setItem('@hrms_expense_emp_map', JSON.stringify(newMapping));
                          } catch (e) {
                            console.warn('Failed to save mapping:', e);
                          }
                          setAssigningExpenseId(null);
                          setShowEmployeePicker(false);
                        } else {
                          setSelectedEmployee(emp);
                          setShowEmployeePicker(false);
                        }
                      }}
                      activeOpacity={0.8}
                    >
                      <View style={styles.empAvatarCircle}>
                        <Text style={styles.empAvatarTxt}>
                          {(emp.name || 'E').slice(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.empPickerName}>{emp.name}</Text>
                        <Text style={styles.empPickerMeta}>
                          {emp.employeeId} • {emp.employmentDetails?.department?.name || 'Staff'}
                        </Text>
                      </View>
                      {isCurrent ? (
                        <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
                      ) : (
                        <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
                      )}
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Submit / Generate Expense Bottom Sheet Modal ── */}
      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {isAdmin ? 'Generate Expense Claim' : 'New Expense Claim'}
                </Text>
                <Text style={styles.modalSub}>
                  {isAdmin
                    ? 'Submit claim on behalf of an employee or self'
                    : 'Submit reimbursement claim for approval'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setShowModal(false);
                  setReceiptFile(null);
                }}
                style={styles.modalClose}
              >
                <Ionicons name="close" size={20} color={Colors.gray600} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              {/* Admin Claim For Selection */}
              {isAdmin && (
                <View style={styles.claimForContainer}>
                  <Text style={styles.fieldLabel}>Generate For *</Text>
                  <View style={styles.claimForToggle}>
                    <TouchableOpacity
                      style={[styles.claimForBtn, claimFor === 'myself' && styles.claimForBtnActive]}
                      onPress={() => {
                        setClaimFor('myself');
                        setSelectedEmployee(null);
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name="person-outline"
                        size={14}
                        color={claimFor === 'myself' ? Colors.white : Colors.gray600}
                        style={{ marginRight: 6 }}
                      />
                      <Text style={[styles.claimForTxt, claimFor === 'myself' && styles.claimForTxtActive]}>
                        Myself
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.claimForBtn, claimFor === 'employee' && styles.claimForBtnActive]}
                      onPress={() => setClaimFor('employee')}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name="people-outline"
                        size={14}
                        color={claimFor === 'employee' ? Colors.white : Colors.gray600}
                        style={{ marginRight: 6 }}
                      />
                      <Text style={[styles.claimForTxt, claimFor === 'employee' && styles.claimForTxtActive]}>
                        Employee
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {claimFor === 'employee' && (
                    <View style={{ marginTop: 8 }}>
                      <Text style={styles.fieldLabel}>Select Employee *</Text>
                      <TouchableOpacity
                        style={styles.empSelectTrigger}
                        onPress={() => setShowEmployeePicker(true)}
                        activeOpacity={0.8}
                      >
                        {selectedEmployee ? (
                          <View style={styles.empSelectedRow}>
                            <View style={styles.empAvatarCircle}>
                              <Text style={styles.empAvatarTxt}>
                                {(selectedEmployee.name || 'E').slice(0, 2).toUpperCase()}
                              </Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.empSelectedName}>{selectedEmployee.name}</Text>
                              <Text style={styles.empSelectedId}>
                                {selectedEmployee.employeeId} •{' '}
                                {selectedEmployee.employmentDetails?.department?.name || 'Staff'}
                              </Text>
                            </View>
                            <Ionicons name="swap-horizontal" size={18} color={Colors.primary} />
                          </View>
                        ) : (
                          <View style={styles.empPlaceholderRow}>
                            <Ionicons name="person-add-outline" size={18} color="#94A3B8" />
                            <Text style={styles.empPlaceholderTxt}>Tap to select employee...</Text>
                            <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                          </View>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}

              <Text style={styles.fieldLabel}>Title *</Text>
              <TextInput
                style={styles.textInput}
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Client Dinner, Travel Cab Fare"
                placeholderTextColor="#A4A4AD"
              />

              <Text style={styles.fieldLabel}>Category *</Text>
              <View style={styles.modalCatRow}>
                {EXPENSE_CATEGORIES.map(c => {
                  const active = category === c.label;
                  return (
                    <TouchableOpacity
                      key={c.label}
                      style={[styles.modalCatChip, active && styles.modalCatChipActive]}
                      onPress={() => setCategory(c.label)}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={c.iconName}
                        size={13}
                        color={active ? '#fff' : c.color}
                        style={{ marginRight: 4 }}
                      />
                      <Text style={[styles.modalCatChipText, active && styles.modalCatChipTextActive]}>
                        {c.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>Amount (₹) *</Text>
              <View style={styles.amountInputRow}>
                <Text style={styles.currencyPrefix}>₹</Text>
                <TextInput
                  style={styles.amountInput}
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0.00"
                  keyboardType="numeric"
                  placeholderTextColor="#A4A4AD"
                />
              </View>

              <Text style={styles.fieldLabel}>Date (YYYY-MM-DD) *</Text>
              <TextInput
                style={styles.textInput}
                value={date}
                onChangeText={setDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#A4A4AD"
              />

              <Text style={styles.fieldLabel}>Description (Optional)</Text>
              <TextInput
                style={[styles.textInput, { height: 76, textAlignVertical: 'top', paddingTop: 10 }]}
                value={description}
                onChangeText={setDescription}
                placeholder="Business reason or notes..."
                multiline
                numberOfLines={3}
                placeholderTextColor="#A4A4AD"
              />

              {/* Receipt File Upload Field */}
              <Text style={styles.fieldLabel}>Receipt (JPG, JPEG, PNG, DOCX, PDF)</Text>
              {receiptFile ? (
                <View style={styles.receiptPreviewBox}>
                  <View
                    style={[
                      styles.receiptIconBadge,
                      { backgroundColor: getFileIconAndBadge(receiptFile.name).bg },
                    ]}
                  >
                    <Ionicons
                      name={getFileIconAndBadge(receiptFile.name).icon}
                      size={20}
                      color={getFileIconAndBadge(receiptFile.name).color}
                    />
                  </View>
                  <View style={styles.receiptInfoCol}>
                    <Text style={styles.receiptFileName} numberOfLines={1}>
                      {receiptFile.name}
                    </Text>
                    <View style={styles.receiptMetaRow}>
                      <View
                        style={[
                          styles.receiptFormatTag,
                          { backgroundColor: getFileIconAndBadge(receiptFile.name).bg },
                        ]}
                      >
                        <Text
                          style={[
                            styles.receiptFormatText,
                            { color: getFileIconAndBadge(receiptFile.name).color },
                          ]}
                        >
                          {getFileIconAndBadge(receiptFile.name).badge}
                        </Text>
                      </View>
                      {receiptFile.size ? (
                        <Text style={styles.receiptFileSize}>
                          {formatFileSize(receiptFile.size)}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.receiptRemoveBtn}
                    onPress={() => setReceiptFile(null)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="close-circle" size={22} color="#94A3B8" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.receiptUploadBox}
                  onPress={handlePickReceipt}
                  activeOpacity={0.7}
                >
                  <View style={styles.receiptUploadIconCircle}>
                    <Ionicons name="cloud-upload-outline" size={20} color={Colors.primary} />
                  </View>
                  <View style={styles.receiptUploadTxtCol}>
                    <Text style={styles.receiptUploadTitle}>Tap to upload receipt document</Text>
                    <Text style={styles.receiptUploadHint}>Supports JPG, JPEG, PNG, DOCX, PDF</Text>
                  </View>
                  <Ionicons name="attach-outline" size={18} color="#94A3B8" />
                </TouchableOpacity>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => {
                    setShowModal(false);
                    setReceiptFile(null);
                  }}
                >
                  <Text style={styles.modalCancelTxt}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalSubmitBtn}
                  onPress={handleCreateExpense}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color={Colors.white} />
                  ) : (
                    <Text style={styles.modalSubmitTxt}>
                      {isAdmin && claimFor === 'employee' ? 'Generate Claim' : 'Submit Claim'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Floating Action Button (FAB) ── */}
      {canSubmit && (
        <TouchableOpacity
          style={styles.fab}
          activeOpacity={0.85}
          onPress={() => setShowModal(true)}
        >
          <Ionicons name="add" size={26} color={Colors.white} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F3F4F6' },

  // Header
  header: {
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : 52,
    paddingHorizontal: Spacing[4],
    paddingBottom: 46,
    overflow: 'hidden',
  },
  blob: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.10)',
    top: -70,
    right: -40,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: -0.2,
  },
  headerAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  headerAddBtnTxt: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
    color: Colors.white,
  },
  curve: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: 36,
    backgroundColor: '#F3F4F6',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },

  // Scroll Container
  scroll: { flex: 1, marginTop: -24 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },

  // Admin Tab Switch (Requests vs My Claims)
  adminTabRow: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: 4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    ...Shadow.sm,
  },
  adminTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: Radius.md,
  },
  adminTabBtnActive: {
    backgroundColor: Colors.primary,
  },
  adminTabTxt: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.gray600,
  },
  adminTabTxtActive: {
    color: Colors.white,
    fontWeight: '700',
  },

  // Stats Grid (Matching Dashboard & Attendance 2x2 layout)
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
    fontSize: 10,
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

  // Search Box
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    marginBottom: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
    color: Colors.gray900,
  },

  // Category Filter Chips
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
  },
  catChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  catChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.gray600,
  },
  catChipTextActive: {
    color: Colors.white,
    fontWeight: '700',
  },

  // List Header Row
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

  // Expense Card
  expenseCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    width: '100%',
    alignSelf: 'stretch',
  },
  cardEmployeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 8,
  },
  cardEmployeeAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.overlayLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardEmployeeAvatarTxt: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primary,
  },
  cardEmployeeName: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.gray900,
  },
  cardEmployeeId: {
    fontSize: 10,
    color: Colors.gray500,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardMainInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.gray900,
    marginBottom: 3,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardCategory: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  cardDot: {
    fontSize: 10,
    color: '#94A3B8',
  },
  cardDate: {
    fontSize: 11,
    color: '#94A3B8',
  },
  cardAmountCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  cardAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.gray900,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  cardDesc: {
    fontSize: 12,
    color: Colors.gray500,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  rejectionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  rejectionText: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '500',
    flex: 1,
  },
  receiptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  receiptText: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '500',
  },
  cardQuickActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cardRejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  cardRejectTxt: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
  cardApproveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#10B981',
  },
  cardApproveTxt: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },

  // Empty State
  emptyStateBox: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    paddingVertical: 56,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E4E4E7',
    marginTop: 6,
    width: '100%',
    alignSelf: 'stretch',
    minHeight: 280,
  },
  emptyIconCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.gray900,
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    color: Colors.gray500,
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 18,
    marginTop: 2,
  },
  emptyLoadingText: {
    fontSize: 12,
    color: Colors.gray500,
    marginTop: 8,
  },

  // Modal / Bottom Sheet
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.gray900,
  },
  modalSub: {
    fontSize: 12,
    color: Colors.gray400,
    marginTop: 2,
  },
  modalClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Detail Modal specifics
  detailHighlight: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  detailHighlightLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  detailHighlightAmount: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.gray900,
  },
  statusBadgeLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  statusBadgeLargeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  detailInfoGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  detailInfoItem: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  detailInfoLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  detailInfoValue: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.gray900,
  },
  detailSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  detailDescText: {
    fontSize: 13,
    color: Colors.gray700,
    lineHeight: 18,
    marginTop: 2,
  },
  reassignBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  reassignBtnTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
  },
  detailRejectionBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  detailRejectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
    marginBottom: 2,
  },
  detailRejectionMsg: {
    fontSize: 12,
    color: '#B91C1C',
  },
  modalReviewRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  modalRejectBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#FECACA',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  modalRejectTxt: {
    fontSize: 14,
    fontWeight: '700',
    color: '#DC2626',
  },
  modalApproveBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  modalApproveTxt: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
  },

  // Admin Claim For Toggle & Employee Selector
  claimForContainer: {
    marginBottom: 6,
  },
  claimForToggle: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
  },
  claimForBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  claimForBtnActive: {
    backgroundColor: Colors.primary,
  },
  claimForTxt: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.gray600,
  },
  claimForTxtActive: {
    color: Colors.white,
    fontWeight: '700',
  },
  empSelectTrigger: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E4E4E7',
    padding: 10,
  },
  empSelectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  empAvatarCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.overlayLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empAvatarTxt: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
  },
  empSelectedName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.gray900,
  },
  empSelectedId: {
    fontSize: 11,
    color: Colors.gray500,
    marginTop: 1,
  },
  empPlaceholderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  empPlaceholderTxt: {
    flex: 1,
    fontSize: 13,
    color: '#94A3B8',
  },

  // Employee Picker Modal
  empPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  empPickerItemActive: {
    backgroundColor: '#F0F7FF',
  },
  empPickerName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.gray900,
  },
  empPickerMeta: {
    fontSize: 11,
    color: Colors.gray500,
    marginTop: 2,
  },

  // Form Fields
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.gray700,
    marginTop: 12,
    marginBottom: 6,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  textInput: {
    height: 46,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E4E4E7',
    paddingHorizontal: 14,
    fontSize: 13,
    color: Colors.gray900,
  },
  modalCatRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 4,
  },
  modalCatChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E4E4E7',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  modalCatChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  modalCatChipText: {
    fontSize: 11,
    color: Colors.gray700,
    fontWeight: '600',
  },
  modalCatChipTextActive: {
    color: Colors.white,
    fontWeight: '700',
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E4E4E7',
    paddingHorizontal: 14,
  },
  currencyPrefix: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.gray600,
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    height: '100%',
    fontSize: 14,
    fontWeight: '700',
    color: Colors.gray900,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
    marginBottom: 20,
  },
  modalCancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E4E4E7',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  modalCancelTxt: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.gray600,
  },
  modalSubmitBtn: {
    flex: 2,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubmitTxt: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
  },

  // Receipt Upload & Preview Styles
  receiptUploadBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
    marginBottom: 8,
    gap: 10,
  },
  receiptUploadIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(43, 127, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptUploadTxtCol: {
    flex: 1,
  },
  receiptUploadTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  receiptUploadHint: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  receiptPreviewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 10,
    marginTop: 4,
    marginBottom: 8,
    gap: 10,
  },
  receiptIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptInfoCol: {
    flex: 1,
  },
  receiptFileName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  receiptMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  receiptFormatTag: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  receiptFormatText: {
    fontSize: 9,
    fontWeight: '800',
  },
  receiptFileSize: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '500',
  },
  receiptRemoveBtn: {
    padding: 4,
  },
  receiptDetailBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 10,
    gap: 8,
    marginTop: 4,
  },
  receiptDetailText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
  },
  receiptDetailBadge: {
    backgroundColor: '#E8F8EE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  receiptDetailBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10B981',
  },

  // FAB
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 84,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.lg,
  },
});
