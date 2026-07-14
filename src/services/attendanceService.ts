import { getToken, getTenantId } from './authService';

const BASE_URL = 'https://hrms-api.genmindz.in/api';

const ensureBaseUrl = () => {
  if (__DEV__ && BASE_URL.includes('your-api')) {
    throw new Error('Set BASE_URL in attendanceService.ts before testing API calls.');
  }
};

export interface DailyAttendanceRecord {
  _id: string;
  name: string;
  employeeId: string;
  designation: string;
  department: string;
  checkIn: string;
  checkOut: string;
  status: 'present' | 'Absent' | 'late' | 'weekend' | 'holiday' | 'weeklyOff';
}

export interface MonthlyAttendanceRecord {
  _id: string;
  employee: {
    _id: string;
    name: string;
    employeeId: string;
    employmentDetails?: {
      department?: { name: string };
      designation?: { name: string };
    };
  };
  date: string;
  inTime: string;
  outTime: string;
  workingMinutes: number;
  status: 'present' | 'Absent' | 'late' | 'weekend' | 'holiday' | 'weeklyOff';
}

export interface EmployeeAttendanceDetail {
  date: string;
  inTime?: string;
  outTime?: string;
  workingMinutes?: number;
  status: 'present' | 'Absent' | 'late' | 'weekend' | 'holiday' | 'weeklyOff';
}

export interface MarkAttendancePayload {
  employeeId: string;
  date: string; // YYYY-MM-DD
  inTime: string; // HH:MM
  outTime: string; // HH:MM
  status: 'present' | 'Absent' | 'late';
}

export const fetchDailyAttendance = async (date: string): Promise<DailyAttendanceRecord[]> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/attendance/daily?date=${date}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch daily attendance report');
  }
  return res.json();
};

export const fetchMonthlyAttendance = async (
  month: number,
  year: number,
): Promise<{ success: boolean; attendance: MonthlyAttendanceRecord[] }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/attendance/monthly?month=${month}&year=${year}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch monthly attendance records');
  }
  const data = await res.json();
  if (Array.isArray(data)) {
    return { success: true, attendance: data };
  }
  return data;
};

export const fetchEmployeeAttendance = async (
  employeeId: string,
  month: number,
  year: number,
  fullMonth = true,
): Promise<{ employee: any; attendance: EmployeeAttendanceDetail[] }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(
    `${BASE_URL}/attendance/employee/${employeeId}?month=${month}&year=${year}&fullMonth=${fullMonth}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Tenant-Id': tenantId,
      },
    },
  );
  if (!res.ok) {
    throw new Error('Failed to fetch employee monthly attendance');
  }
  const data = await res.json();
  if (Array.isArray(data)) {
    return { employee: null, attendance: data };
  }
  return data;
};

export const markAttendanceManually = async (
  payload: MarkAttendancePayload,
): Promise<{ success: boolean; message: string }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/attendance/mark`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to mark attendance manually');
  }
  return data;
};

export const uploadAttendanceExcel = async (
  formData: FormData,
): Promise<{ message: string; inserted: number; updated: number }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/attendance/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Tenant-Id': tenantId,
      // Note: fetch automatically sets the correct multipart boundary header when body is FormData
    },
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to upload bulk attendance excel');
  }
  return data;
};

// ── Check-In, Check-Out, and Today Status ──
export interface CheckInResponse {
  success: boolean;
  message: string;
  attendance: {
    _id: string;
    date: string;
    inTime: string;
    status: string;
    checkInLocation?: string;
  };
}

export interface CheckOutResponse {
  success: boolean;
  message: string;
  attendance: {
    _id: string;
    outTime: string;
    workingMinutes: number;
    status: string;
  };
}

export interface TodayStatusResponse {
  success: boolean;
  attendance?: {
    inTime?: string | null;
    outTime?: string | null;
    status?: string;
    checkInLocation?: string;
    checkOutLocation?: string;
  };
}

export interface CheckLocationPayload {
  location?: string;
  latitude?: number;
  longitude?: number;
  locationSource?: 'gps' | 'ip' | 'manual';
}

export interface IpLocationResponse {
  success: boolean;
  location: {
    address: string;
    latitude: number;
    longitude: number;
    ipAddress: string;
    source: 'ip';
  };
}

export const fetchIpLocation = async (): Promise<IpLocationResponse> => {
  ensureBaseUrl();
  const res = await fetch(`${BASE_URL}/attendance/ip-location`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch IP location');
  }
  return res.json();
};

export const checkInApi = async (payload?: string | CheckLocationPayload): Promise<CheckInResponse> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  let bodyObj = {};
  if (typeof payload === 'string') {
    bodyObj = { location: payload };
  } else if (payload && typeof payload === 'object') {
    bodyObj = payload;
  }
  const res = await fetch(`${BASE_URL}/attendance/check-in`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
    body: JSON.stringify(bodyObj),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to check in');
  }
  return data;
};

export const checkOutApi = async (payload?: string | CheckLocationPayload): Promise<CheckOutResponse> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  let bodyObj = {};
  if (typeof payload === 'string') {
    bodyObj = { location: payload };
  } else if (payload && typeof payload === 'object') {
    bodyObj = payload;
  }
  const res = await fetch(`${BASE_URL}/attendance/check-out`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
    body: JSON.stringify(bodyObj),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to check out');
  }
  return data;
};

export const fetchTodayStatus = async (): Promise<TodayStatusResponse> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/attendance/today`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to fetch today\'s attendance status');
  }
  return data;
};

// ── Superadmin Administrative APIs ──

export interface AdminDashboardSummary {
  date: string;
  totalEmployees: number;
  present: number;
  Absent: number;
  onLeave: number;
  late: number;
}

export const fetchAdminDashboardSummary = async (): Promise<{ success: boolean; data: AdminDashboardSummary }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/admin/attendance/dashboard/summary`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch admin dashboard summary');
  }
  return res.json();
};

export interface AttendanceLogFilter {
  startDate: string;
  endDate: string;
  departmentId?: string;
  status?: string;
}

export interface AttendanceLogRecord {
  recordId: string;
  employeeId: string;
  name: string;
  punchInTime: string;
  punchOutTime: string | null;
  status: string;
  location?: {
    lat: number;
    lng: number;
  };
}

export const fetchAttendanceLogs = async (
  filter: AttendanceLogFilter,
): Promise<{ success: boolean; data: AttendanceLogRecord[] }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  let query = `?startDate=${filter.startDate}&endDate=${filter.endDate}`;
  if (filter.departmentId) query += `&departmentId=${filter.departmentId}`;
  if (filter.status) query += `&status=${filter.status}`;
  const res = await fetch(`${BASE_URL}/admin/attendance/logs${query}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch attendance logs');
  }
  return res.json();
};

export const processRegularizationRequest = async (
  requestId: string,
  action: 'APPROVE' | 'REJECT',
  remarks?: string,
): Promise<{ success: boolean; message: string }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/admin/attendance/regularization/${requestId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
    body: JSON.stringify({ action, remarks }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to process regularization request');
  }
  return data;
};

export interface ManualOverridePayload {
  employeeId: string;
  date: string;
  inTime: string;
  outTime?: string;
  status: string;
  remarks?: string;
}

export const manualAttendanceOverride = async (
  payload: ManualOverridePayload,
): Promise<{ success: boolean; message: string }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/admin/attendance/manual-update`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to override attendance manually');
  }
  return data;
};


