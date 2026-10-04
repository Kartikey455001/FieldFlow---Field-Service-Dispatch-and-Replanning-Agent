import apiClient from './apiClient';

/**
 * Technician API Service
 */

export const techniciansApi = {
  /**
   * Fetch all technicians
   */
  async getTechnicians() {
    const res = await apiClient('/technicians');
    return res.data || [];
  },

  /**
   * Fetch technician by ID
   */
  async getTechnicianById(technicianId) {
    const res = await apiClient(`/technicians/${technicianId}`);
    return res.data;
  },

  /**
   * Create new technician
   */
  async createTechnician(techData) {
    const res = await apiClient('/technicians', {
      method: 'POST',
      body: techData,
    });
    return res.data;
  },

  /**
   * Update technician profile / properties
   */
  async updateTechnician(technicianId, techData) {
    const res = await apiClient(`/technicians/${technicianId}`, {
      method: 'PUT',
      body: techData,
    });
    return res.data;
  },

  /**
   * Update technician availability (e.g. mark UNAVAILABLE / ON_LEAVE)
   */
  async updateAvailability(technicianId, status, reason = '') {
    const res = await apiClient(`/technicians/${technicianId}/availability`, {
      method: 'PATCH',
      body: { status, reason },
    });
    return res.data; // { technician, affectedAssignments, affectedRequestIds, message }
  },
};

export default techniciansApi;
