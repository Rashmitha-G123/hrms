import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// TODO: replace with your actual base URL
const BASE_URL = 'https://workspace-api.genmindz.in/api';

const ensureBaseUrl = () => {
  if (__DEV__ && BASE_URL.includes('your-api')) {
    throw new Error('Set BASE_URL in authService.ts before testing API calls.');
  }
};

const TOKEN_KEY = 'hrms_jwt';
const TENANT_KEY = 'hrms_tenant';
const USER_KEY = 'hrms_cached_user';

export const saveCachedUser = async (user: any) => {
  try {
    const str = JSON.stringify(user);
    if (Platform.OS === 'web') {
      localStorage.setItem(USER_KEY, str);
    } else {
      await SecureStore.setItemAsync(USER_KEY, str);
    }
  } catch (e) {
    console.warn('Failed to cache user profile:', e);
  }
};

export const getCachedUser = async () => {
  try {
    let str: string | null = null;
    if (Platform.OS === 'web') {
      str = localStorage.getItem(USER_KEY);
    } else {
      str = await SecureStore.getItemAsync(USER_KEY);
    }
    return str ? JSON.parse(str) : null;
  } catch (e) {
    return null;
  }
};

export const clearCachedUser = async () => {
  try {
    if (Platform.OS === 'web') {
      localStorage.removeItem(USER_KEY);
    } else {
      await SecureStore.deleteItemAsync(USER_KEY);
    }
  } catch (e) { }
};

// ── Token storage (expo-secure-store: native = Keychain/Keystore, web = localStorage fallback) ──
export const saveToken = async (token: string) => {
  if (Platform.OS === 'web') {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  }
};

export const getToken = async () => {
  if (Platform.OS === 'web') {
    return localStorage.getItem(TOKEN_KEY);
  } else {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  }
};

export const clearToken = async () => {
  if (Platform.OS === 'web') {
    localStorage.removeItem(TOKEN_KEY);
  } else {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
};

export const saveTenantId = async (tenantId: string) => {
  if (Platform.OS === 'web') {
    localStorage.setItem(TENANT_KEY, tenantId);
  } else {
    await SecureStore.setItemAsync(TENANT_KEY, tenantId);
  }
};

export const getTenantId = async () => {
  if (Platform.OS === 'web') {
    return localStorage.getItem(TENANT_KEY) || 'company';
  } else {
    return (await SecureStore.getItemAsync(TENANT_KEY)) || 'company';
  }
};

export const clearTenantId = async () => {
  if (Platform.OS === 'web') {
    localStorage.removeItem(TENANT_KEY);
  } else {
    await SecureStore.deleteItemAsync(TENANT_KEY);
  }
};

// ── CAPTCHA ──
export interface CaptchaResponse {
  success: boolean;
  image: string;       // SVG string
  captchaToken: string;
}

export const fetchCaptcha = async (): Promise<CaptchaResponse> => {
  ensureBaseUrl();
  const res = await fetch(`${BASE_URL}/auth/captcha`, {
    headers: { 'X-Tenant-Id': 'company' }
  });
  if (!res.ok) throw new Error('Failed to fetch CAPTCHA');
  return res.json();
};

// ── Login ──
export interface LoginPayload {
  password: string;
  captcha: string;
  captchaToken: string;
  email?: string;
  employeeId?: string;
}

export interface LoginSuccess {
  success: true;
  message: string;
  token: string;
  user: {
    _id: string;
    name: string;
    role: string;
    permissions?: string[];
    company?: { tenantId: string };
  };
}

export interface LoginError {
  message: string;
  captchaInvalid?: boolean;
  locked?: boolean;
  lockoutUntil?: string;
  remainingMinutes?: number;
  warned?: boolean;
  failedAttempts?: number;
  attemptsLeft?: number;
}

export const loginApi = async (
  payload: LoginPayload,
): Promise<{ ok: boolean; status: number; data: LoginSuccess | LoginError }> => {
  ensureBaseUrl();
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Id': 'company',
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
};

// ── Register Superadmin ──
export interface RegisterSuperadminPayload {
  name: string;
  email: string;
  password: string;
}

export const registerSuperadminApi = async (
  payload: RegisterSuperadminPayload,
): Promise<{ ok: boolean; status: number; data: any }> => {
  ensureBaseUrl();
  const res = await fetch(`${BASE_URL}/auth/register-superadmin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Id': 'company',
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
};

// ── Profile ──
export interface UpdateProfilePayload {
  employeePersonal?: {
    maritalStatus?: string;
    contactNumber?: string;
    currentAddress?: string;
    fullName?: string;
    dateOfBirth?: string;
    gender?: string;
    fatherOrSpouseName?: string;
    emailAddress?: string;
    permanentAddress?: string;
    emergencyContactName?: string;
    emergencyContactNumber?: string;
  };
}

export const fetchProfile = async () => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/auth/profile`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Tenant-Id': tenantId,
    },
  });
  if (!res.ok) throw new Error('Unauthorized');
  const data = await res.json();
  if (data && data.user) {
    if (data.permissions && !data.user.permissions) {
      data.user.permissions = data.permissions;
    }
    saveCachedUser(data.user);
  }
  return data;
};

export const updateProfileApi = async (
  payload: UpdateProfilePayload,
): Promise<{ success: boolean; message: string }> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/auth/profile`, {
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
    throw new Error(data.message || 'Failed to update profile');
  }
  return data;
};

// ── Logout ──
export const logoutApi = async () => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  await fetch(`${BASE_URL}/auth/logout`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Tenant-Id': tenantId,
    },
  }).catch(() => { });
  await clearToken();
  await clearTenantId();
  await clearCachedUser();
};
