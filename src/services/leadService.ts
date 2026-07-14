import { getToken, getTenantId } from './authService';

const BASE_URL = 'https://hrms-api.genmindz.in/api';

const ensureBaseUrl = () => {
  if (__DEV__ && BASE_URL.includes('your-api')) {
    throw new Error('Set BASE_URL in leadService.ts before testing API calls.');
  }
};

export interface FetchLeadsParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  source?: string;
  assignedTo?: string;
  followUpFilter?: string;
}

export interface BulkAssignPayload {
  leadIds: string[];
  assignedTo: string; // employee ID
}

export interface UpdateLeadStatusPayload {
  status: string;
  subStatus?: string;
  notes?: string;
  nextFollowUp?: string; // ISO String
}

export const fetchLeads = async (params: FetchLeadsParams = {}): Promise<any> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();

  const queryParts: string[] = [];
  if (params.page !== undefined) queryParts.push(`page=${params.page}`);
  if (params.limit !== undefined) queryParts.push(`limit=${params.limit}`);
  if (params.search) queryParts.push(`search=${encodeURIComponent(params.search)}`);
  if (params.status) queryParts.push(`status=${encodeURIComponent(params.status)}`);
  if (params.source) queryParts.push(`source=${encodeURIComponent(params.source)}`);
  if (params.assignedTo) queryParts.push(`assignedTo=${encodeURIComponent(params.assignedTo)}`);
  if (params.followUpFilter) queryParts.push(`followUpFilter=${encodeURIComponent(params.followUpFilter)}`);

  const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';

  const res = await fetch(`${BASE_URL}/leads${queryString}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to fetch leads');
  }
  return data;
};

export const bulkAssignLeads = async (payload: BulkAssignPayload): Promise<{ success: boolean; message: string }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/leads/bulk-assign`, {
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
    throw new Error(data.message || 'Failed to bulk assign leads');
  }
  return data;
};

export const importLeads = async (formData: FormData): Promise<{ success: boolean; message: string; count?: number }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/leads/import`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Tenant-Id': tenantId,
    },
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to import leads');
  }
  return data;
};

export const updateLeadStatusApi = async (
  id: string,
  payload: UpdateLeadStatusPayload,
): Promise<{ success: boolean; lead: any }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/leads/${id}/status`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to update lead status');
  }
  return data;
};

export const createLeadApi = async (
  payload: any,
): Promise<{ success: boolean; lead: any }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/leads`, {
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
    throw new Error(data.message || 'Failed to create lead');
  }
  return data;
};

export const updateLeadApi = async (
  id: string,
  payload: any,
): Promise<{ success: boolean; lead: any }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/leads/${id}`, {
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
    throw new Error(data.message || 'Failed to update lead details');
  }
  return data;
};

export const deleteLeadApi = async (
  id: string,
): Promise<{ success: boolean }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/leads/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to delete lead');
  }
  return data;
};

// ── Superadmin Administrative Lead APIs ──

export interface LeadRequestRecord {
  _id: string;
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  source: string;
  status: string;
  assignedTo: string;
  createdAt: string;
}

export const fetchAllLeads = async (params: {
  page: number;
  limit: number;
  status?: string;
  assignedTo?: string;
}): Promise<{ success: boolean; data: LeadRequestRecord[]; pagination: { totalRecords: number; currentPage: number; totalPages: number } }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  let query = `?page=${params.page}&limit=${params.limit}`;
  if (params.status) query += `&status=${encodeURIComponent(params.status)}`;
  if (params.assignedTo) query += `&assignedTo=${encodeURIComponent(params.assignedTo)}`;
  const res = await fetch(`${BASE_URL}/leads/all${query}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch all leads');
  }
  return res.json();
};

export const fetchLeadDetails = async (leadId: string): Promise<{ success: boolean; data: any }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/leads/${leadId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch lead details');
  }
  return res.json();
};

export interface LeadStatistics {
  totalLeads: number;
  new: number;
  contacted: number;
  qualified: number;
  converted: number;
  lost: number;
}

export const fetchLeadStatisticsCounts = async (): Promise<{ success: boolean; data: LeadStatistics }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/statistics/counts/leads`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch lead statistics');
  }
  return res.json();
};

