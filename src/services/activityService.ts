import { getToken, getTenantId } from './authService';

const BASE_URL = 'https://workspace-api.genmindz.in/api';

const ensureBaseUrl = () => {
  if (__DEV__ && BASE_URL.includes('your-api')) {
    throw new Error('Set BASE_URL in activityService.ts before testing API calls.');
  }
};

export interface ActivityLog {
  id: string;
  _id?: string;
  title: string;
  action: 'login' | 'check_in' | string;
  createdAt: string;
}

export interface ActivityLogsResponse {
  success: boolean;
  logs: ActivityLog[];
  pagination: {
    total: number;
    currentPage: number;
    totalPages: number;
  };
}

export interface FetchActivityLogsParams {
  page?: number;
  limit?: number;
  userId?: string;
  action?: 'login' | 'check_in' | '';
  search?: string;
}

export const fetchActivityLogs = async (
  params: FetchActivityLogsParams,
): Promise<ActivityLogsResponse> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  
  const queryParts: string[] = [];
  if (params.page !== undefined) queryParts.push(`page=${params.page}`);
  if (params.limit !== undefined) queryParts.push(`limit=${params.limit}`);
  if (params.userId) queryParts.push(`userId=${params.userId}`);
  if (params.action) queryParts.push(`action=${params.action}`);
  if (params.search) queryParts.push(`search=${encodeURIComponent(params.search)}`);
  
  const queryStr = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
  const res = await fetch(`${BASE_URL}/activity-logs${queryStr}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch activity logs');
  }
  return res.json();
};
