import apiClient from './apiClient';

/**
 * Assignment API Service
 */

export const assignmentsApi = {
  /**
   * Fetch all active assignments
   */
  async getAssignments() {
    const res = await apiClient('/assignments');
    return res.data || [];
  },

  /**
   * Create an assignment (with server-side Phase 3 validation)
   */
  async createAssignment(assignmentData) {
    const res = await apiClient('/assignments', {
      method: 'POST',
      body: assignmentData,
    });
    return res.data;
  },

  /**
   * Update an assignment (with server-side Phase 3 validation)
   */
  async updateAssignment(assignmentId, assignmentData) {
    const res = await apiClient(`/assignments/${assignmentId}`, {
      method: 'PUT',
      body: assignmentData,
    });
    return res.data;
  },

  /**
   * Delete / Unassign an assignment
   */
  async deleteAssignment(assignmentId) {
    const res = await apiClient(`/assignments/${assignmentId}`, {
      method: 'DELETE',
    });
    return res.data;
  },
};

export default assignmentsApi;
