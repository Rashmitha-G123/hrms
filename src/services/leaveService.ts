import { getToken, getTenantId } from './authService';

const BASE_URL = 'https://hrms-api.genmindz.in/api';

const ensureBaseUrl = () => {
  if (__DEV__ && BASE_URL.includes('your-api')) {
    throw new Error('Set BASE_URL in leaveService.ts before testing API calls.');
  }
};

export interface SubmitAndProcessPayload {
  empId: string;
  leaveId: string;
  fromDate: string;
  toDate: string;
  reason: string;
}

export interface ApproveOrRejectPayload {
  empId: string;
  leaveId: string;
  fromDate: string;
  toDate: string;
  status: 'approved' | 'rejected';
}

export interface ManualUpdatePayload {
  empId: string;
  leaveId: string;
  yearlyCount: number;
  carryForward: number;
}

export interface ApplyLeavePayload {
  empId: string;
  leaveId: string;
  fromDate: string;
  toDate: string;
  reason: string;
  dailyBreakdown: { date: string; status: string }[];
}

export interface LeaveApplication {
  fromDate: string;
  toDate: string;
  numberOfDays: number;
  status: 'pending' | 'approved' | 'rejected' | string;
  reason?: string;
  appliedOn?: string;
}

export interface LeaveTypeHistory {
  leaveName: string;
  applications: LeaveApplication[];
}

export interface LeaveHistoryResponse {
  employeeId: string;
  leaveTypes: LeaveTypeHistory[];
}

export const submitAndProcessLeave = async (
  payload: SubmitAndProcessPayload,
): Promise<{ success: boolean; message: string }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/leave-requests/submit-and-process`, {
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
    throw new Error(data.message || 'Failed to submit and process leave request');
  }
  return data;
};

export const approveOrRejectLeave = async (
  payload: ApproveOrRejectPayload,
): Promise<{ success: boolean; message: string }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/leave-requests/approve`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to update leave request status');
  }
  return data;
};

export const manualUpdateBalance = async (
  payload: ManualUpdatePayload,
): Promise<{ success: boolean; message: string }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/leave-requests/manual-update`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to override leave balance');
  }
  return data;
};

export const applyLeaveApi = async (
  payload: ApplyLeavePayload,
): Promise<{ success: boolean; message: string }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/leave-requests/batch`, {
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
    throw new Error(data.message || 'Failed to submit leave request');
  }
  return data;
};

export const fetchMyLeaveHistoryApi = async (): Promise<LeaveHistoryResponse> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/leave-requests/employee`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch leave history');
  }
  return res.json();
};

// ── Superadmin Administrative Leave APIs ──

export interface LeaveRequestRecord {
  _id: string;
  employeeId: string;
  name: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected' | string;
  appliedOn: string;
}

export const fetchAllLeaveRequests = async (
  page = 1,
  limit = 10,
): Promise<{ success: boolean; data: LeaveRequestRecord[]; pagination: { totalRecords: number; currentPage: number; totalPages: number } }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/leave-requests/all?page=${page}&limit=${limit}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch all leave requests');
  }
  return res.json();
};

export interface LeaveStatistics {
  totalPending: number;
  totalApproved: number;
  totalRejected: number;
  todayOnLeave: number;
}

export const fetchLeaveStatisticsCounts = async (): Promise<{ success: boolean; data: LeaveStatistics }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/statistics/counts/leave`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch leave statistics');
  }
  return res.json();
};

export interface HolidayRecord {
  _id: string;
  date: string;
  name: string;
  type: string;
}

export const fetchHolidays = async (): Promise<{ success: boolean; data: HolidayRecord[] }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/holiday/getAllholidays`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch holidays list');
  }
  return res.json();
};

export const updateLeaveRequestStatus = async (
  requestId: string,
  status: 'APPROVED' | 'REJECTED',
  remarks?: string,
): Promise<{ success: boolean; message: string }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/leave-requests/${requestId}/status`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
    body: JSON.stringify({ status, remarks }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to update leave request status');
  }
  return data;
};

