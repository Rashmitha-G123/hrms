import { getToken, getTenantId } from './authService';

const BASE_URL = 'https://hrms-api.genmindz.in/api';

const ensureBaseUrl = () => {
  if (__DEV__ && BASE_URL.includes('your-api')) {
    throw new Error('Set BASE_URL in taskService.ts before testing API calls.');
  }
};

export interface Task {
  _id: string;
  projectId: string;
  project?: string;
  title: string;
  priority: 'low' | 'medium' | 'high' | 'urgent' | string;
  status: 'todo' | 'in-progress' | 'completed' | 'paused' | string;
  startDate?: string;
  dueDate?: string;
  assignees?: string[];
  team?: { initials: string; color: string }[];
  timeSpent?: { days: number; hours: number; minutes: number };
  timeSpentSeconds?: number;
  timerStartAt?: string;
  timerStartedBy?: string;
}

export const normalizeTask = (item: any): Task => {
  if (!item) return item;
  
  let projectName = '';
  let projectId = '';
  if (item.project && typeof item.project === 'object') {
    projectName = item.project.name || '';
    projectId = item.project._id || '';
  } else if (typeof item.project === 'string') {
    projectName = item.project;
    projectId = item.projectId || '';
  } else {
    projectName = 'General';
    projectId = item.projectId || '';
  }
  
  let team = item.team || [];
  if (Array.isArray(item.assignees)) {
    team = item.assignees.map((a: any) => {
      if (a && typeof a === 'object') {
        const name = a.name || '';
        const initials = name
          .split(' ')
          .map((n: string) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2);
        return {
          initials: initials || '??',
          color: '#3E8AFF',
        };
      }
      return { initials: '??', color: '#3E8AFF' };
    });
  }

  const formatApiDate = (dateStr?: string) => {
    if (!dateStr) return undefined;
    if (dateStr.includes('T')) {
      return dateStr.split('T')[0];
    }
    return dateStr;
  };

  const status = item.status === 'in_progress' ? 'in-progress' : item.status === 'done' ? 'completed' : item.status;

  let timeSpent = item.timeSpent;
  if (item.timeSpentSeconds !== undefined && item.timeSpentSeconds > 0) {
    const totalSeconds = item.timeSpentSeconds;
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    timeSpent = { days, hours, minutes };
  }

  return {
    ...item,
    _id: item._id || item.id || '',
    project: projectName,
    projectId: projectId || item.projectId || '',
    team: team,
    startDate: formatApiDate(item.startDate),
    dueDate: formatApiDate(item.dueDate),
    status: status,
    timeSpent: timeSpent || { days: 0, hours: 0, minutes: 0 },
  };
};

export const fetchTasks = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
  priority?: string;
  status?: string;
  projectId?: string;
}): Promise<{ success: boolean; items: Task[] }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  
  let url = `${BASE_URL}/tasks`;
  if (params) {
    const qps = [];
    if (params.page !== undefined) qps.push(`page=${params.page}`);
    if (params.limit !== undefined) qps.push(`limit=${params.limit}`);
    if (params.search !== undefined) qps.push(`search=${encodeURIComponent(params.search)}`);
    if (params.priority !== undefined) qps.push(`priority=${encodeURIComponent(params.priority)}`);
    if (params.status !== undefined) {
      const statusParam = params.status === 'in-progress' ? 'in_progress' : params.status;
      qps.push(`status=${statusParam}`);
    }
    if (params.projectId !== undefined) qps.push(`projectId=${encodeURIComponent(params.projectId)}`);
    if (qps.length > 0) {
      url += `?${qps.join('&')}`;
    }
  }

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch tasks list');
  }
  const data = await res.json();
  
  // Normalize status and items for UI
  if (data && Array.isArray(data.items)) {
    data.items = data.items.map((item: any) => normalizeTask(item));
  }
  return data;
};

export const createTask = async (
  payload: FormData | object,
): Promise<{ success: boolean; task: Task }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  
  const isFormData = payload instanceof FormData;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'X-Tenant-Id': tenantId,
  };
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${BASE_URL}/tasks`, {
    method: 'POST',
    headers,
    body: isFormData ? (payload as FormData) : JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to create task');
  }
  if (data && data.task) {
    data.task = normalizeTask(data.task);
  }
  return data;
};

export const deleteTask = async (
  id: string,
): Promise<{ success: boolean; message: string }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/tasks/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to delete task');
  }
  return data;
};

export const startTaskTimerApi = async (
  id: string,
): Promise<{ success: boolean; task: any }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/tasks/${id}/timer/start`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to start task timer');
  }
  if (data && data.task) {
    data.task = normalizeTask(data.task);
  }
  return data;
};

export const pauseTaskTimerApi = async (
  id: string,
): Promise<{ success: boolean; task: any }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/tasks/${id}/timer/pause`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to pause task timer');
  }
  if (data && data.task) {
    data.task = normalizeTask(data.task);
  }
  return data;
};

export const endTaskTimerApi = async (
  id: string,
): Promise<{ success: boolean; task: any }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/tasks/${id}/timer/end`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to end task timer');
  }
  if (data && data.task) {
    data.task = normalizeTask(data.task);
  }
  return data;
};

export const updateTaskStatusApi = async (
  id: string,
  status: string,
): Promise<{ success: boolean; status: string }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();

  let apiStatus = status;
  if (status === 'completed') apiStatus = 'done';
  if (status === 'in-progress') apiStatus = 'in_progress';

  const res = await fetch(`${BASE_URL}/tasks/${id}/status`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
    body: JSON.stringify({ status: apiStatus }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to update task status');
  }
  return data;
};

export const pauseAllTimersApi = async (): Promise<{ success: boolean; pausedCount: number }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/tasks/timer/pause-all`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to pause all timers');
  }
  return data;
};

// ── Superadmin Administrative Task APIs ──

export const fetchAllTasks = async (params: {
  page: number;
  limit: number;
  status?: string;
  assignedTo?: string;
}): Promise<{ success: boolean; data: Task[]; pagination: { totalRecords: number; currentPage: number; totalPages: number } }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  let query = `?page=${params.page}&limit=${params.limit}`;
  if (params.status) query += `&status=${encodeURIComponent(params.status)}`;
  if (params.assignedTo) query += `&assignedTo=${encodeURIComponent(params.assignedTo)}`;
  const res = await fetch(`${BASE_URL}/tasks/all${query}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch all tasks');
  }
  const data = await res.json();
  if (data && Array.isArray(data.data)) {
    data.data = data.data.map((item: any) => normalizeTask(item));
  }
  return data;
};

export const fetchTaskDetails = async (taskId: string): Promise<{ success: boolean; data: Task }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/tasks/${taskId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch task details');
  }
  const data = await res.json();
  if (data && data.data) {
    data.data = normalizeTask(data.data);
  }
  return data;
};

export interface TaskStatistics {
  totalTasks: number;
  completed: number;
  inProgress: number;
  pending: number;
  overdue: number;
}

export const fetchTaskStatisticsCounts = async (): Promise<{ success: boolean; data: TaskStatistics }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/statistics/counts/tasks`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch task statistics');
  }
  return res.json();
};

export const updateTaskStatusPatch = async (
  taskId: string,
  status: string,
): Promise<{ success: boolean; message: string }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/tasks/${taskId}/status`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
    body: JSON.stringify({ status }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to update task status');
  }
  return data;
};

