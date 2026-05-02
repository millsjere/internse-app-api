import { Schema, model } from 'mongoose';
import { IUserNotification } from '../types';

const userNotificationSchema = new Schema<IUserNotification>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['job_match', 'application_update', 'message', 'system'],
      default: 'system',
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
    link: String,
  },
  { timestamps: true }
);

userNotificationSchema.index({ user: 1, read: 1 });
userNotificationSchema.index({ createdAt: -1 });

export const UserNotification = model<IUserNotification>(
  'UserNotification',
  userNotificationSchema
);
