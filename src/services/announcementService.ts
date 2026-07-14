import { getToken, getTenantId } from './authService';

const BASE_URL = 'https://hrms-api.genmindz.in/api';

const ensureBaseUrl = () => {
  if (__DEV__ && BASE_URL.includes('your-api')) {
    throw new Error('Set BASE_URL in announcementService.ts before testing API calls.');
  }
};

export interface Announcement {
  _id: string;
  title: string;
  description: string;
  category: 'Policy' | 'Event' | 'Holiday' | 'General' | 'Urgent';
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  targetAudience?: {
    type: 'All' | 'Department';
    department?: string;
  };
  attachments?: string[];
  createdAt?: string;
  author?: string;
  acknowledgedBy?: string[];
  reactions?: { user: string; type: string }[];
}

export const fetchAnnouncements = async (): Promise<{ success: boolean; data: Announcement[] }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/announcements/all?limit=1000`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch announcements');
  }
  return res.json();
};

export const createAnnouncement = async (
  formData: FormData,
): Promise<{ success: boolean; message: string; data?: any }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/announcements`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Tenant-Id': tenantId,
      // Multipart boundary is automatically set by fetch when FormData is passed
    },
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to create announcement');
  }
  return data;
};

export const deleteAnnouncement = async (
  id: string,
): Promise<{ success: boolean; message: string }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/announcements/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to delete announcement');
  }
  return data;
};

export const acknowledgeAnnouncementApi = async (
  id: string,
): Promise<{ success: boolean; message: string }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/announcements/${id}/acknowledge`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to acknowledge announcement');
  }
  return data;
};

export const reactToAnnouncementApi = async (
  id: string,
  type: string,
): Promise<{ success: boolean; data: { _id: string; reactions: { user: string; type: string }[] } }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/announcements/${id}/react`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
    body: JSON.stringify({ type }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to react to announcement');
  }
  return data;
};
