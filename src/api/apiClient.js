/**
 * Centralized API Client for FieldFlow Backend
 */

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export class ApiError extends Error {
  constructor(message, status, code, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code || 'API_ERROR';
    this.details = details || [];
  }
}

export async function apiClient(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const defaultHeaders = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
    config.body = JSON.stringify(config.body);
  }

  try {
    const res = await fetch(url, config);
    let data = null;
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await res.json();
    } else {
      const text = await res.text();
      data = { message: text };
    }

    if (!res.ok || data.success === false) {
      const errMsg =
        (data && (typeof data.error === 'string' ? data.error : data.error?.message || data.message)) ||
        `Request failed with status ${res.status}`;
      const errCode = (data && (data.error?.code || data.code)) || `HTTP_${res.status}`;
      const errDetails = (data && (data.error?.details || data.details)) || [];
      throw new ApiError(errMsg, res.status, errCode, errDetails);
    }

    return data;
  } catch (err) {
    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError(err.message || 'Network error', 0, 'NETWORK_ERROR');
  }
}

export default apiClient;
