import apiClient from './apiClient';

/**
 * Service Request API Service
 */

export const requestsApi = {
  /**
   * Get all service requests with optional filters
   * @param {Object} filters { search, priority, region, status, skill }
   */
  async getRequests(filters = {}) {
    const params = new URLSearchParams();
    if (filters.search) params.append('search', filters.search);
    if (filters.priority && filters.priority !== 'All') params.append('priority', filters.priority);
    if (filters.region && filters.region !== 'All') params.append('region', filters.region);
    if (filters.status && filters.status !== 'All') params.append('status', filters.status);
    if (filters.skill && filters.skill !== 'All') params.append('skill', filters.skill);

    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await apiClient(`/requests${query}`);
    return res.data || [];
  },

  /**
   * Get a single service request by requestId
   */
  async getRequestById(requestId) {
    const res = await apiClient(`/requests/${requestId}`);
    return res.data;
  },

  /**
   * Create a standard service request
   */
  async createRequest(requestData) {
    const res = await apiClient('/requests', {
      method: 'POST',
      body: requestData,
    });
    return res.data;
  },

  /**
   * Create a critical emergency service request
   */
  async createEmergencyRequest(emergencyData) {
    const res = await apiClient('/requests/emergency', {
      method: 'POST',
      body: emergencyData,
    });
    return res.data;
  },

  /**
   * Update a service request
   */
  async updateRequest(requestId, requestData) {
    const res = await apiClient(`/requests/${requestId}`, {
      method: 'PUT',
      body: requestData,
    });
    return res.data;
  },

  /**
   * Update request status
   */
  async updateRequestStatus(requestId, status, reason = '') {
    const res = await apiClient(`/requests/${requestId}/status`, {
      method: 'PATCH',
      body: { status, reason },
    });
    return res.data;
  },

  /**
   * Delete a service request
   */
  async deleteRequest(requestId) {
    const res = await apiClient(`/requests/${requestId}`, {
      method: 'DELETE',
    });
    return res.data;
  },
};

export default requestsApi;
