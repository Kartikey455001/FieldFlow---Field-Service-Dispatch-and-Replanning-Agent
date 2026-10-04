import Notification from '../models/Notification.js';

export async function getNotifications(req, res, next) {
  try {
    const { category, type, unread } = req.query;
    const filter = {};

    if (category && category !== 'All') {
      filter.category = category.toLowerCase();
    }
    if (type && type !== 'All') {
      filter.type = new RegExp(`^${type}$`, 'i');
    }
    if (unread !== undefined) {
      filter.unread = unread === 'true';
    }

    const notifications = await Notification.find(filter).sort({ createdAt: -1 });
    const unreadCount = await Notification.countDocuments({ unread: true });

    res.json({
      success: true,
      unreadCount,
      count: notifications.length,
      data: notifications,
    });
  } catch (error) {
    next(error);
  }
}

export async function markAsRead(req, res, next) {
  try {
    const { id } = req.params;
    const notification = await Notification.findOneAndUpdate(
      { $or: [{ notificationId: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }] },
      { read: true, unread: false },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: `Notification ${id} not found.`, code: 'NOT_FOUND' });
    }

    const unreadCount = await Notification.countDocuments({ unread: true });
    res.json({ success: true, data: notification, unreadCount });
  } catch (error) {
    next(error);
  }
}

export async function markAsUnread(req, res, next) {
  try {
    const { id } = req.params;
    const notification = await Notification.findOneAndUpdate(
      { $or: [{ notificationId: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }] },
      { read: false, unread: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: `Notification ${id} not found.`, code: 'NOT_FOUND' });
    }

    const unreadCount = await Notification.countDocuments({ unread: true });
    res.json({ success: true, data: notification, unreadCount });
  } catch (error) {
    next(error);
  }
}

export async function markAllAsRead(req, res, next) {
  try {
    await Notification.updateMany({ unread: true }, { read: true, unread: false });
    res.json({ success: true, unreadCount: 0, message: 'All notifications marked as read.' });
  } catch (error) {
    next(error);
  }
}
