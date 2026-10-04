import apiClient from './apiClient';

/**
 * Audit Log API Service
 */

export const auditApi = {
  /**
   * Fetch audit logs with optional filters
   */
  async getLogs(filters = {}) {
    const params = new URLSearchParams();
    if (filters.entityType && filters.entityType !== 'All') params.append('entityType', filters.entityType);
    if (filters.entityId) params.append('entityId', filters.entityId);
    if (filters.action && filters.action !== 'All') params.append('action', filters.action);

    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await apiClient(`/audit${query}`);
    return res.data || [];
  },
};

export default auditApi;
