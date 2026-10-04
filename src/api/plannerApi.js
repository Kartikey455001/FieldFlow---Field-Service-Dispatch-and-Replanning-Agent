import apiClient from './apiClient';

/**
 * AI Planner API Service
 */

export const plannerApi = {
  /**
   * Retrieve the latest persisted AI plan proposal from MongoDB
   */
  async getLatestPlan(params = {}) {
    const query = new URLSearchParams(params).toString();
    const url = query ? `/planner/latest?${query}` : '/planner/latest';
    const res = await apiClient(url);
    return res.data || res;
  },

  /**
   * Retrieve all AI plan proposals
   */
  async getProposals() {
    const res = await apiClient('/planner/proposals');
    return res.data || res;
  },

  /**
   * Retrieve a specific AI plan proposal by ID
   */
  async getPlan(planId) {
    const res = await apiClient(`/planner/${planId}`);
    return res.data || res;
  },

  /**
   * Generate AI schedule proposal using Gemini API
   */
  async generatePlan(payload = {}) {
    const res = await apiClient('/planner/generate', {
      method: 'POST',
      body: payload,
    });
    return res.data || res;
  },

  /**
   * Generate Revised AI schedule proposal
   */
  async generateRevisedPlan(payload = {}) {
    const res = await apiClient('/planner/generate-revised', {
      method: 'POST',
      body: { ...payload, isRevision: true },
    });
    return res.data || res;
  },

  /**
   * Modify a proposed assignment manually in pending proposal
   */
  async modifyProposedAssignment(planId, requestId, payload = {}) {
    const res = await apiClient(`/planner/${planId}/assignments/${requestId}`, {
      method: 'PATCH',
      body: payload,
    });
    return res.data || res;
  },

  /**
   * Atomically approve AI plan proposal with MongoDB transaction & stale protection
   */
  async approvePlan(planId, payload = {}) {
    const res = await apiClient(`/planner/${planId}/approve`, {
      method: 'POST',
      body: payload,
    });
    return res.data || res;
  },

  /**
   * Reject proposed AI plan
   */
  async rejectPlan(planId, payload = {}) {
    const res = await apiClient(`/planner/${planId}/reject`, {
      method: 'POST',
      body: payload,
    });
    return res.data || res;
  },

  /**
   * Mark technician unavailable and identify affected future requests
   */
  async technicianUnavailable(payload = {}) {
    const res = await apiClient('/planner/technician-unavailable', {
      method: 'POST',
      body: payload,
    });
    return res.data || res;
  },

  /**
   * Log emergency service request
   */
  async emergencyRequest(payload = {}) {
    const res = await apiClient('/planner/emergency-request', {
      method: 'POST',
      body: payload,
    });
    return res.data || res;
  },
};

export default plannerApi;
