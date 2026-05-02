import { Request, Response } from 'express';
import { UserNotification } from '../models/UserNotification';
import { CompanyNotification } from '../models/CompanyNotification';
import { AppError, asyncHandler } from '../middleware/errorHandler';

// Get user notifications
export const getUserNotifications = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AppError('Unauthorized', 401);
    }

    const notifications = await UserNotification.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ success: true, data: notifications });
  }
);

// Get company notifications
export const getCompanyNotifications = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AppError('Unauthorized', 401);
    }

    const notifications = await CompanyNotification.find({ company: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ success: true, data: notifications });
  }
);

// Mark user notification as read
export const markUserNotificationAsRead = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { notificationId } = req.params;

    const notification = await UserNotification.findByIdAndUpdate(
      notificationId,
      { read: true },
      { new: true }
    );

    if (!notification) {
      throw new AppError('Notification not found', 404);
    }

    res.json({ success: true, data: notification });
  }
);

// Mark company notification as read
export const markCompanyNotificationAsRead = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { notificationId } = req.params;

    const notification = await CompanyNotification.findByIdAndUpdate(
      notificationId,
      { read: true },
      { new: true }
    );

    if (!notification) {
      throw new AppError('Notification not found', 404);
    }

    res.json({ success: true, data: notification });
  }
);

// Delete user notification
export const deleteUserNotification = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { notificationId } = req.params;

    const notification = await UserNotification.findByIdAndDelete(notificationId);

    if (!notification) {
      throw new AppError('Notification not found', 404);
    }

    res.json({ success: true, message: 'Notification deleted' });
  }
);

// Delete company notification
export const deleteCompanyNotification = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { notificationId } = req.params;

    const notification = await CompanyNotification.findByIdAndDelete(notificationId);

    if (!notification) {
      throw new AppError('Notification not found', 404);
    }

    res.json({ success: true, message: 'Notification deleted' });
  }
);
