import { getToken, getTenantId } from './authService';

const BASE_URL = 'https://hrms-api.genmindz.in/api';

const ensureBaseUrl = () => {
  if (__DEV__ && BASE_URL.includes('your-api')) {
    throw new Error('Set BASE_URL in chatService.ts before testing API calls.');
  }
};

export const fetchConversations = async (): Promise<any> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/chat/conversations`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to fetch conversations');
  }
  return data;
};

export const getOrCreateDirectChat = async (targetUserId: string): Promise<any> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/chat/conversations/direct`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
    body: JSON.stringify({ targetUserId }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to get or create direct conversation');
  }
  return data;
};

export const fetchMessages = async (conversationId: string): Promise<any> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/chat/messages/${conversationId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to fetch messages');
  }
  return data;
};

export const sendMessage = async (payload: FormData | object): Promise<any> => {
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

  const res = await fetch(`${BASE_URL}/chat/send`, {
    method: 'POST',
    headers,
    body: isFormData ? (payload as FormData) : JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to send message');
  }
  return data;
};

export const markConversationAsRead = async (conversationId: string): Promise<any> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/chat/messages/${conversationId}/read`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to mark conversation as read');
  }
  return data;
};

export const reactToMessage = async (messageId: string, emoji: string): Promise<any> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/chat/messages/${messageId}/react`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
    body: JSON.stringify({ emoji }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to react to message');
  }
  return data;
};

export const deleteMessage = async (messageId: string): Promise<any> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/chat/messages/${messageId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to delete message');
  }
  return data;
};

export const clearConversationHistory = async (conversationId: string): Promise<any> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/chat/conversations/${conversationId}/messages`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Failed to clear conversation history');
  }
  return data;
};

// ── Superadmin Administrative Chat APIs ──

export const fetchChatContacts = async (params?: { search?: string; departmentId?: string }): Promise<any> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  let query = '';
  if (params) {
    const qps = [];
    if (params.search) qps.push(`search=${encodeURIComponent(params.search)}`);
    if (params.departmentId) qps.push(`departmentId=${encodeURIComponent(params.departmentId)}`);
    if (qps.length > 0) query = `?${qps.join('&')}`;
  }
  const res = await fetch(`${BASE_URL}/chat/contacts${query}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch chat contacts');
  }
  return res.json();
};

export const fetchConversationMessages = async (chatId: string, page = 1, limit = 20): Promise<any> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/chat/conversations/${chatId}/messages?page=${page}&limit=${limit}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
  });
  if (!res.ok) {
    throw new Error('Failed to fetch conversation messages');
  }
  return res.json();
};

export interface SendMessagePayload {
  chatId?: string;
  receiverId?: string;
  content: string;
  attachments?: string[];
}

export const sendMessageAdmin = async (payload: SendMessagePayload): Promise<any> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/chat/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error('Failed to send message via admin API');
  }
  return res.json();
};

export interface CreateGroupChatPayload {
  name: string;
  participants: string[];
  description?: string;
}

export const createGroupChat = async (payload: CreateGroupChatPayload): Promise<any> => {
  ensureBaseUrl();
  const token = await getToken();
  const tenantId = await getTenantId();
  const res = await fetch(`${BASE_URL}/chat/group`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error('Failed to create group chat');
  }
  return res.json();
};

