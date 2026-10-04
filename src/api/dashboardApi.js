import apiClient from './apiClient';

/**
 * Dashboard API Service
 */

export const dashboardApi = {
  /**
   * Fetch database-derived dashboard operational summary
   */
  async getSummary() {
    const res = await apiClient('/dashboard/summary');
    return res.data;
  },
};

export default dashboardApi;
