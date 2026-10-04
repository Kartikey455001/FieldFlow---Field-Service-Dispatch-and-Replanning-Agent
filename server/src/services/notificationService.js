import Notification from '../models/Notification.js';

export async function createNotification({
  title,
  description = '',
  message = '',
  category = 'system',
  type = 'System',
  severity = 'info',
  relatedEntity = null,
  session = null,
}) {
  const notif = new Notification({
    notificationId: `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    title,
    description: description || message,
    message: message || description,
    category: category.toLowerCase(),
    type,
    severity,
    relatedEntity,
    read: false,
    unread: true,
    timestamp: 'Just now',
  });

  if (session) {
    await notif.save({ session });
  } else {
    await notif.save();
  }

  return notif;
}
