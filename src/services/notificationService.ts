import { getToken, getTenantId } from './authService';

const BASE_URL = 'https://hrms-api.genmindz.in/api';

const ensureBaseUrl = () => {
  if (__DEV__ && BASE_URL.includes('your-api')) {
    throw new Error('Set BASE_URL in notificationService.ts before testing.');
  }
};

export interface Notification {
  _id: string;
  type: 'info' | 'success' | 'warning' | 'danger';
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  time?: string;
}

export const fetchRecentNotificationsApi = async (): Promise<{ success: boolean; data: Notification[] }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/notifications/recent`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch recent notifications');
  }
  return res.json();
};

export const fetchAllNotificationsApi = async (page = 1, limit = 20, filter = 'all'): Promise<{ success: boolean; data: Notification[] }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/notifications/all?page=${page}&limit=${limit}&filter=${filter}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch all notifications');
  }
  return res.json();
};

export const markNotificationReadApi = async (id: string): Promise<{ success: boolean; message: string }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/notifications/read?notificationId=${id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to mark notification as read');
  }
  return data;
};

export const markAllNotificationsReadApi = async (): Promise<{ success: boolean; message: string }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/notifications/read-all`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to mark all notifications as read');
  }
  return data;
};

export const fetchUnreadCountApi = async (): Promise<{ success: boolean; count: number }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/notifications/unread-count`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch unread notifications count');
  }
  return res.json();
};
