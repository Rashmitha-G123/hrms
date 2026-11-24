import { getToken, getTenantId } from './authService';

const BASE_URL = 'https://workspace-api.genmindz.in/api';

const ensureBaseUrl = () => {
  if (__DEV__ && BASE_URL.includes('your-api')) {
    throw new Error('Set BASE_URL in projectService.ts before testing API calls.');
  }
};

export interface Project {
  _id: string;
  name: string;
  description?: string;
  status?: string;
  client?: string;
  progress?: number;
  tasksTotal?: number;
  tasksCompleted?: number;
  priority?: string;
  endDate?: string;
  team?: any[];
  [key: string]: any;
}

export const fetchProjectsApi = async (
  page: number = 1,
  limit: number = 100,
): Promise<{ success: boolean; items: Project[]; total?: number }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/projects?search=&page=${page}&limit=${limit}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch projects list');
  }
  const json = await res.json();
  let items: Project[] = [];
  if (Array.isArray(json)) {
    items = json;
  } else if (Array.isArray(json.items)) {
    items = json.items;
  } else if (Array.isArray(json.projects)) {
    items = json.projects;
  } else if (Array.isArray(json.data)) {
    items = json.data;
  }
  return { success: true, items, total: json.total || items.length };
};
