import { Router } from 'express';
import { protect, protectCompany } from '../middleware/auth';
import {
  getUserNotifications,
  getCompanyNotifications,
  markUserNotificationAsRead,
  markCompanyNotificationAsRead,
  deleteUserNotification,
  deleteCompanyNotification,
} from '../controllers/notificationsController';

const router = Router();

// User notification routes
router.get('/user', protect, getUserNotifications);
router.put('/user/:notificationId/read', protect, markUserNotificationAsRead);
router.delete('/user/:notificationId', protect, deleteUserNotification);

// Company notification routes
router.get('/company', protectCompany, getCompanyNotifications);
router.put('/company/:notificationId/read', protectCompany, markCompanyNotificationAsRead);
router.delete('/company/:notificationId', protectCompany, deleteCompanyNotification);

export default router;
