import express from 'express';
import {
  getNotifications,
  markAsRead,
  markAsUnread,
  markAllAsRead,
} from '../controllers/notificationController.js';

const router = express.Router();

router.get('/', getNotifications);
router.patch('/read-all', markAllAsRead);
router.patch('/:id/read', markAsRead);
router.patch('/:id/unread', markAsUnread);

export default router;
