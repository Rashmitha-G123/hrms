import { getToken, getTenantId } from './authService';

const BASE_URL = 'https://workspace-api.genmindz.in/api';

const ensureBaseUrl = () => {
  if (__DEV__ && BASE_URL.includes('your-api')) {
    throw new Error('Set BASE_URL in leadService.ts before testing API calls.');
  }
};

// ── Master Settings Colors (from spec section 4.3) ──────────────────────────
export const SETTING_COLORS: Record<string, { bg: string; text: string; border?: string }> = {
  Green: { bg: '#dcfce7', text: '#15803d', border: '#bbf7d0' },
  Red: { bg: '#fee2e2', text: '#b91c1c', border: '#fecaca' },
  Blue: { bg: '#dbeafe', text: '#1d4ed8', border: '#bfdbfe' },
  'Light Blue': { bg: '#e0f2fe', text: '#0369a1', border: '#bae6fd' },
  'Deep Purple': { bg: '#e0e7ff', text: '#4338ca', border: '#c7d2fe' },
  Purple: { bg: '#f3e8ff', text: '#7e22ce', border: '#e9d5ff' },
  Teal: { bg: '#ccfbf1', text: '#0f766e', border: '#99f6e4' },
  Orange: { bg: '#fef3c7', text: '#b45309', border: '#fde68a' },
  'Deep Orange': { bg: '#ffedd5', text: '#c2410c', border: '#fed7aa' },
  Yellow: { bg: '#fef9c3', text: '#a16207', border: '#fef08a' },
  Grey: { bg: '#f3f4f6', text: '#374151', border: '#e5e7eb' },
};

export const getBadgeColor = (colorName?: string): { bg: string; text: string; border?: string } => {
  if (!colorName) return SETTING_COLORS.Grey;
  const match = Object.keys(SETTING_COLORS).find(
    (k) => k.toLowerCase() === colorName.trim().toLowerCase()
  );
  return match ? SETTING_COLORS[match] : SETTING_COLORS.Grey;
};

// ── Common Settings Types ────────────────────────────────────────────────────
export interface CommonSettingItem {
  _id: string;
  type: string;
  name: string;
  status: string;
  data?: {
    color?: string;
    statuses?: string[];
    [key: string]: any;
  };
}

export const DEFAULT_LEAD_STATUSES: CommonSettingItem[] = [
  { _id: 'st_unattended', type: 'lead_status', name: 'Unattended', status: 'Active', data: { color: 'Red' } },
  { _id: 'st_new', type: 'lead_status', name: 'New', status: 'Active', data: { color: 'Blue' } },
  { _id: 'st_contacted', type: 'lead_status', name: 'Contacted', status: 'Active', data: { color: 'Light Blue' } },
  { _id: 'st_inprogress', type: 'lead_status', name: 'In Progress', status: 'Active', data: { color: 'Orange' } },
  { _id: 'st_qualified', type: 'lead_status', name: 'Qualified', status: 'Active', data: { color: 'Purple' } },
  { _id: 'st_proposal', type: 'lead_status', name: 'Proposal Sent', status: 'Active', data: { color: 'Deep Orange' } },
  { _id: 'st_negotiation', type: 'lead_status', name: 'Negotiation', status: 'Active', data: { color: 'Yellow' } },
  { _id: 'st_onhold', type: 'lead_status', name: 'On Hold', status: 'Active', data: { color: 'Grey' } },
  { _id: 'st_won', type: 'lead_status', name: 'Won', status: 'Active', data: { color: 'Green' } },
  { _id: 'st_booked', type: 'lead_status', name: 'Booked Lead', status: 'Active', data: { color: 'Green' } },
  { _id: 'st_lost', type: 'lead_status', name: 'Lost', status: 'Active', data: { color: 'Red' } },
  { _id: 'st_dead', type: 'lead_status', name: 'Dead Lead', status: 'Active', data: { color: 'Grey' } },
];

export const DEFAULT_LEAD_STAGES: CommonSettingItem[] = [
  { _id: 'stg_lost', type: 'lead_stage', name: 'Lost', status: 'Active', data: { color: 'Red' } },
  { _id: 'stg_unattended', type: 'lead_stage', name: 'Unattended', status: 'Active', data: { color: 'Red' } },
  { _id: 'stg_discovery', type: 'lead_stage', name: 'Discovery', status: 'Active', data: { color: 'Light Blue' } },
  { _id: 'stg_proposal', type: 'lead_stage', name: 'Proposal', status: 'Active', data: { color: 'Orange' } },
  { _id: 'stg_negotiation', type: 'lead_stage', name: 'Negotiation', status: 'Active', data: { color: 'Yellow' } },
  { _id: 'stg_won', type: 'lead_stage', name: 'Won', status: 'Active', data: { color: 'Green' } },
];

export const DEFAULT_LEAD_SOURCES: CommonSettingItem[] = [
  { _id: 'src_website', type: 'lead_source', name: 'Website', status: 'Active' },
  { _id: 'src_referral', type: 'lead_source', name: 'Referral', status: 'Active' },
  { _id: 'src_social', type: 'lead_source', name: 'Social Media', status: 'Active' },
  { _id: 'src_coldcall', type: 'lead_source', name: 'Cold Call', status: 'Active' },
  { _id: 'src_walkin', type: 'lead_source', name: 'Walk-in', status: 'Active' },
  { _id: 'src_google', type: 'lead_source', name: 'Google Ads', status: 'Active' },
  { _id: 'src_email', type: 'lead_source', name: 'Email Campaign', status: 'Active' },
  { _id: 'src_other', type: 'lead_source', name: 'Other', status: 'Active' },
];

export const fetchCommonSettings = async (type: string): Promise<CommonSettingItem[]> => {
  ensureBaseUrl();
  try {
    const token = await getToken();
    const tenantId = await getTenantId();
    const res = await fetch(`${BASE_URL}/common-settings/${type}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Tenant-Id': tenantId,
      },
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || `Failed to fetch settings for ${type}`);
    }
    const items = Array.isArray(data) ? data : data.items || data.data || [];
    if (items.length > 0) return items;
  } catch (err) {
    console.warn(`Error fetching common-settings/${type}, using fallback:`, err);
  }

  // Fallbacks if API returns empty array or fails
  if (type === 'lead_status') return DEFAULT_LEAD_STATUSES;
  if (type === 'lead_stage') return DEFAULT_LEAD_STAGES;
  if (type === 'lead_source') return DEFAULT_LEAD_SOURCES;
  return [];
};

// ── Data Interfaces ──────────────────────────────────────────────────────────
export interface LeadReceipt {
  receiptNo: string;
  amount: number;
  date: string;
  paymentMode: string;
  referenceNo?: string;
  notes?: string;
  addedBy?: any;
}

export interface LeadPaymentDetails {
  totalAgreedAmount: number;
  bookingAdvance?: number;
  paidAmount: number;
  balanceAmount: number;
  paymentMode?: string;
  receipts?: LeadReceipt[];
}

export interface LeadIndividualDetails {
  panNumber?: string;
  aadhaarNumber?: string;
  occupation?: string;
  currentAddress?: string;
  preferredLocation?: string;
}

export interface LeadCorporateDetails {
  companyName?: string;
  contactPersonName?: string;
  contactPersonDesignation?: string;
  gstNumber?: string;
  industryType?: string;
  registeredOfficeAddress?: string;
  website?: string;
}

export interface LeadFollowUp {
  stage: string;
  status: string;
  notes?: string;
  nextFollowUp?: string;
  nextFollowUpDate?: string;
  reminderNotifiedAt?: string;
  date?: string;
  createdAt?: string;
  updatedBy?: any;
}

export interface LeadItem {
  _id: string;
  leadId?: string;
  name: string;
  mobile: string;
  email?: string;
  leadType: 'individual' | 'company' | string;
  status: string;
  stage: string;
  assignedTo?: any;
  assignedExecutiveName?: string;
  estimatedPrice?: number;
  projectValue?: number | string;
  location?: string;
  companyName?: string;
  convertedCompany?: any;
  convertedProject?: any;
  convertedAt?: string;
  isUnattended?: boolean;
  paymentDetails?: LeadPaymentDetails;
  individualDetails?: LeadIndividualDetails;
  corporateDetails?: LeadCorporateDetails;
  blockDetails?: any;
  followUps?: LeadFollowUp[];
  source?: string;
  notes?: string;
  managersFeedback?: string;
  asmFeedback?: string;
  tlFeedback?: string;
  details?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface FetchLeadsParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  stage?: string;
  leadType?: string;
  assignedTo?: string;
  source?: string;
  followUpFilter?: string;
}

// ── Lead APIs ────────────────────────────────────────────────────────────────

export const fetchLeads = async (params: FetchLeadsParams = {}): Promise<{
  success: boolean;
  items?: LeadItem[];
  data?: any;
  leads?: LeadItem[];
  total?: number;
  page?: number;
  limit?: number;
  stats?: any;
}> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();

  const queryParts: string[] = [];
  if (params.page !== undefined) queryParts.push(`page=${params.page}`);
  if (params.limit !== undefined) queryParts.push(`limit=${params.limit}`);
  if (params.search) queryParts.push(`search=${encodeURIComponent(params.search)}`);
  if (params.status && params.status !== 'All') queryParts.push(`status=${encodeURIComponent(params.status)}`);
  if (params.stage && params.stage !== 'All') queryParts.push(`stage=${encodeURIComponent(params.stage)}`);
  if (params.leadType && params.leadType !== 'All') queryParts.push(`leadType=${encodeURIComponent(params.leadType)}`);
  if (params.assignedTo) queryParts.push(`assignedTo=${encodeURIComponent(params.assignedTo)}`);
  if (params.source) queryParts.push(`source=${encodeURIComponent(params.source)}`);
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

export const fetchLeadDetails = async (leadId: string): Promise<{ success: boolean; data: LeadItem }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  try {
    const res = await fetch(`${BASE_URL}/leads/${leadId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Tenant-Id': tenantId,
      },
    });
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch (err) {
    // If GET /leads/:id is not supported, fallback to list lookup below
  }

  // Fallback: fetch from /leads list
  try {
    const listRes = await fetchLeads({ limit: 100 });
    const items = listRes.leads || listRes.items || (listRes.data?.leads) || (Array.isArray(listRes.data) ? listRes.data : []);
    const found = items.find((l: any) => l._id === leadId || l.id === leadId || l.leadId === leadId);
    if (found) {
      return { success: true, data: found };
    }
  } catch (listErr) {
    console.warn('Fallback lead list fetch error:', listErr);
  }

  throw new Error('Failed to fetch lead details');
};

export const createLeadApi = async (
  payload: any,
): Promise<{ success: boolean; lead: LeadItem }> => {
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
): Promise<{ success: boolean; lead: LeadItem }> => {
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

export const patchLeadInline = async (
  id: string,
  payload: { field: string; value: any }
): Promise<{ success: boolean; lead: LeadItem }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/leads/${id}/inline-update`, {
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
    throw new Error(data.message || 'Failed to inline update lead');
  }
  return data;
};

export const addLeadFollowUp = async (
  id: string,
  payload: {
    status: string;
    stage: string;
    nextFollowUpDate?: string;
    notes?: string;
  }
): Promise<{ success: boolean; lead?: LeadItem; message?: string }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  // Scenario 3: PATCH /api/leads/:id/status
  const res = await fetch(`${BASE_URL}/leads/${id}/status`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
    body: JSON.stringify({
      status: payload.status?.toLowerCase().replace(/\s+/g, '_'),
      subStatus: payload.stage,
      notes: payload.notes || '',
      nextFollowUp: payload.nextFollowUpDate || null,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to add follow-up status');
  }
  return data;
};

export const recordLeadPayment = async (
  id: string,
  payload: {
    totalAgreedAmount?: number;
    amount: number;
    paymentMode: string;
    referenceNo?: string;
    notes?: string;
  }
): Promise<{ success: boolean; message: string; paymentDetails?: LeadPaymentDetails }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/leads/${id}/payments`, {
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
    throw new Error(data.message || 'Failed to record payment');
  }
  return data;
};

export const deleteLeadApi = async (id: string): Promise<{ success: boolean; message?: string }> => {
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

export const bulkAssignLeads = async (payload: {
  leadIds: string[];
  assignedTo: string;
}): Promise<{ success: boolean; message: string }> => {
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

export const importLeads = async (
  formData: FormData
): Promise<{ success: boolean; message: string; count?: number }> => {
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

export interface LeadStatistics {
  total?: number;
  totalLeads?: number;
  new?: number;
  contacted?: number;
  qualified?: number;
  converted?: number;
  lost?: number;
  categoryAllCount?: number;
  categoryActiveCount?: number;
  categoryBookedCount?: number;
  categoryDeadCount?: number;
  overdueCount?: number;
  todayCount?: number;
  pendingCount?: number;
  individualCount?: number;
  companyCount?: number;
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

export const fetchAllLeads = async (params: {
  page: number;
  limit: number;
  status?: string;
  assignedTo?: string;
}): Promise<{
  success: boolean;
  data: LeadItem[];
  pagination: { totalRecords: number; currentPage: number; totalPages: number };
}> => {
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
