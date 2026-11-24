import { getToken, getTenantId } from './authService';

const BASE_URL = 'https://workspace-api.genmindz.in/api';

const ensureBaseUrl = () => {
  if (__DEV__ && BASE_URL.includes('your-api')) {
    throw new Error('Set BASE_URL in expenseService.ts before testing API calls.');
  }
};

export interface ExpenseItem {
  _id: string;
  employee?: {
    _id: string;
    name: string;
    email?: string;
    employeeId?: string;
  };
  employeeId?: string;
  title: string;
  category: 'Travel' | 'Food' | 'Accommodation' | 'Office Supplies' | 'Communication' | 'Others' | string;
  amount: number;
  date: string;
  description?: string;
  receiptUrl?: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  reimbursementStatus?: 'Pending' | 'Processed';
  rejectionReason?: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const fetchMyExpenses = async (): Promise<{ success: boolean; data: ExpenseItem[] }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/expenses/my`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch my expenses');
  }
  return res.json();
};

export const fetchAllExpenses = async (): Promise<{ success: boolean; data: ExpenseItem[] }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/expenses`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch all expenses');
  }
  return res.json();
};

export const submitExpenseApi = async (
  formDataOrJson: FormData | any,
  isMultipart = false,
): Promise<{ success: boolean; data: ExpenseItem }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();

  if (isMultipart) {
    // In React Native / Expo SDK 56, global fetch uses expo/fetch (WinterCG) which throws
    // "Unsupported FormDataPart implementation" when passed React Native file parts.
    // XMLHttpRequest directly uses the native Android/iOS networking layer to stream multipart file data.
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${BASE_URL}/expenses`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      if (tenantId) {
        xhr.setRequestHeader('X-Tenant-Id', tenantId);
      }
      xhr.onload = () => {
        try {
          const json = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(json);
          } else {
            reject(new Error(json.message || `Server returned status ${xhr.status}: ${xhr.responseText}`));
          }
        } catch (_) {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve({ success: true, data: xhr.responseText as any });
          } else {
            reject(new Error(`Server error (${xhr.status}): ${xhr.responseText || 'Upload failed'}`));
          }
        }
      };
      xhr.onerror = () => {
        reject(new Error('Network connection failed during file upload. Please check your network and try again.'));
      };
      xhr.ontimeout = () => {
        reject(new Error('File upload timed out. The file may be too large.'));
      };
      xhr.timeout = 60000;
      xhr.send(formDataOrJson);
    });
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'X-Tenant-Id': tenantId,
    'Content-Type': 'application/json',
  };
  const res = await fetch(`${BASE_URL}/expenses`, {
    method: 'POST',
    headers,
    body: JSON.stringify(formDataOrJson),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to submit expense');
  }
  return data;
};

export const updateExpenseStatusApi = async (
  id: string,
  status: 'Approved' | 'Rejected',
  rejectionReason?: string,
): Promise<{ success: boolean; data: any }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  let res = await fetch(`${BASE_URL}/expenses/${id}/status`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
    body: JSON.stringify({ status, ...(rejectionReason ? { rejectionReason } : {}) }),
  });

  if (res.status === 404 || res.status === 405) {
    res = await fetch(`${BASE_URL}/expenses/${id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Tenant-Id': tenantId,
      },
      body: JSON.stringify({ status, ...(rejectionReason ? { rejectionReason } : {}) }),
    });
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to update expense status');
  }
  return data;
};

export const deleteExpenseApi = async (id: string): Promise<{ success: boolean; message: string }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/expenses/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Tenant-Id': tenantId,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to delete expense');
  }
  return data;
};
