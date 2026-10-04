import apiClient from './apiClient';

/**
 * Schedule & Versions API Service
 */

export const scheduleApi = {
  /**
   * Fetch all immutable schedule versions
   */
  async getVersions() {
    const res = await apiClient('/schedules/versions');
    return res.data || [];
  },

  /**
   * Fetch specific schedule version by ID
   */
  async getVersionById(versionId) {
    const res = await apiClient(`/schedules/versions/${versionId}`);
    return res.data;
  },

  /**
   * Compare two schedule versions
   */
  async compareVersions(from, to) {
    const res = await apiClient(`/schedules/compare/${encodeURIComponent(from)}/${encodeURIComponent(to)}`);
    return res.data;
  },

  /**
   * Rollback to a previous schedule version (creates a new immutable version)
   */
  async rollbackVersion(versionId, payload = {}) {
    const res = await apiClient(`/schedules/versions/${encodeURIComponent(versionId)}/rollback`, {
      method: 'POST',
      body: payload,
    });
    return res.data;
  },

  /**
   * Simulate cancellation and generate impact preview
   */
  async simulateCancellation(payload) {
    const res = await apiClient('/schedules/simulate-cancellation', {
      method: 'POST',
      body: payload,
    });
    return res.data;
  },
};

export default scheduleApi;
