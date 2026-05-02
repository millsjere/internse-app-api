import { Schema, model } from 'mongoose';
import { IApplication } from '../types';

const applicationSchema = new Schema<IApplication>(
  {
    job: { type: Schema.Types.ObjectId, ref: 'Job', required: true },
    applicant: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    resume: String,
    coverLetter: String,
    status: {
      type: String,
      enum: ['pending', 'reviewing', 'rejected', 'accepted'],
      default: 'pending',
    },
    appliedAt: { type: Date, default: Date.now },
    answers: {
      type: [
        {
          questionId: { type: String, required: true },
          question: { type: String, required: true },
          answer: { type: String, default: '' },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

// Unique index: one application per user per job
applicationSchema.index({ job: 1, applicant: 1 }, { unique: true });
applicationSchema.index({ applicant: 1, status: 1 });

export const Application = model<IApplication>('Application', applicationSchema);
