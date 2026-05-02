import { Schema, model } from 'mongoose';
import { ICompanyNotification } from '../types';

const companyNotificationSchema = new Schema<ICompanyNotification>(
  {
    company: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    type: {
      type: String,
      enum: ['new_application', 'profile_update', 'job_status', 'system'],
      default: 'system',
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
    link: String,
    relatedApplication: { type: Schema.Types.ObjectId, ref: 'Application' },
  },
  { timestamps: true }
);

companyNotificationSchema.index({ company: 1, read: 1 });
companyNotificationSchema.index({ createdAt: -1 });

export const CompanyNotification = model<ICompanyNotification>(
  'CompanyNotification',
  companyNotificationSchema
);
