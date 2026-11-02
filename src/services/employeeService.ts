import { getToken, getTenantId } from './authService';

const BASE_URL = 'https://workspace-api.genmindz.in/api';

const ensureBaseUrl = () => {
  if (__DEV__ && BASE_URL.includes('your-api')) {
    throw new Error('Set BASE_URL in employeeService.ts before testing API calls.');
  }
};

export interface Employee {
  _id: string;
  name: string;
  employeeId: string;
  role: string;
  status: 'active' | 'inactive';
  email?: string;
  permissions?: string[];
  employeePersonal?: {
    fullName?: string;
    gender?: string;
    dateOfBirth?: string;
    contactNumber?: string;
    emailAddress?: string;
    permanentAddress?: string;
  };
  employmentDetails?: {
    employeeId?: string;
    department?: { id?: string; name: string };
    designation?: { id?: string; name: string };
    employmentType?: string;
    workLocation?: string;
    shift?: {
      id?: string;
      name: string;
      startTime: string;
      endTime: string;
    };
    weekOff?: string[];
  };
}

export interface CreateEmployeePayload {
  name: string;
  email: string;
  employeeId: string;
  role: string;
  permissions?: string[];
  employeePersonal?: {
    fullName: string;
    gender: string;
    dateOfBirth: string;
    contactNumber: string;
    emailAddress: string;
    permanentAddress: string;
  };
  employmentDetails?: {
    employeeId?: string;
    department?: { id?: string; name: string };
    designation?: { id?: string; name: string };
    employmentType?: string;
    workLocation?: string;
    shift?: {
      id?: string;
      name: string;
      startTime: string;
      endTime: string;
    };
    weekOff?: string[];
  };
}

export const fetchEmployees = async (): Promise<Employee[]> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/hr/employees`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch employees');
  }
  const json = await res.json();
  // Unwrap common API envelope shapes
  if (Array.isArray(json)) return json;
  if (json && Array.isArray(json.data)) return json.data;
  if (json && Array.isArray(json.employees)) return json.employees;
  if (json && Array.isArray(json.users)) return json.users;
  if (json && Array.isArray(json.items)) return json.items;
  return [];
};

export const createEmployee = async (
  payload: CreateEmployeePayload,
): Promise<{ success: boolean; message: string; user?: any }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/hr/employees`, {
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
    throw new Error(data.message || 'Failed to create employee');
  }
  return data;
};

export const updateEmployeeStatus = async (
  id: string,
  status: 'active' | 'inactive',
): Promise<{ success: boolean; message: string; user?: any }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/hr/updateStatus`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
    body: JSON.stringify({ id, status }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to update employee status');
  }
  return data;
};

export const editEmployeeProfile = async (
  id: string,
  payload: Partial<CreateEmployeePayload>,
): Promise<{ success: boolean; message: string }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/hr/employees/${id}`, {
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
    throw new Error(data.message || 'Failed to update employee profile');
  }
  return data;
};

export const fetchEmployeeById = async (id: string): Promise<{ success: boolean; employee: Employee }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/hr/employees/${id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch employee details');
  }
  return res.json();
};

export const fetchEmployeesSelectionApi = async (page: number = 1, limit: number = 100): Promise<{ success: boolean; employees: Employee[] }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/hr/employees-selection?page=${page}&limit=${limit}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch employees selection');
  }
  return res.json();
};
