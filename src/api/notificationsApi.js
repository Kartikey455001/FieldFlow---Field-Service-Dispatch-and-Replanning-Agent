import apiClient from './apiClient';

/**
 * Notifications API Service
 */

export const notificationsApi = {
  /**
   * Fetch all notifications
   */
  async getNotifications() {
    const res = await apiClient('/notifications');
    return res.data || [];
  },

  /**
   * Mark a notification as read
   */
  async markRead(notificationId) {
    const res = await apiClient(`/notifications/${notificationId}/read`, {
      method: 'PATCH',
    });
    return res.data;
  },

  /**
   * Mark a notification as unread
   */
  async markUnread(notificationId) {
    const res = await apiClient(`/notifications/${notificationId}/unread`, {
      method: 'PATCH',
    });
    return res.data;
  },

  /**
   * Mark all notifications as read
   */
  async markAllRead() {
    const res = await apiClient('/notifications/read-all', {
      method: 'PATCH',
    });
    return res.data;
  },
};

export default notificationsApi;
