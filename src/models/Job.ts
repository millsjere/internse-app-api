import { Schema, model } from 'mongoose';
import { IJob } from '../types';

const jobSchema = new Schema<IJob>(
  {
    company: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    requirements: { type: [String], default: [] },
    responsibilities: { type: [String], default: [] },
    benefits: { type: [String], default: [] },
    tags: { type: [String], default: [] },
    industry: { type: String, required: true },
    jobType: {
      type: String,
      enum: ['full-time', 'part-time', 'contract', 'internship'],
      default: 'full-time',
    },
    category: {
      type: String,
      enum: ['internship', 'volunteer', 'fellowship'],
      default: 'internship',
    },
    level: {
      type: String,
      enum: ['entry', 'mid', 'senior'],
      default: 'entry',
    },
    salary: {
      min: Number,
      max: Number,
      currency: { type: String, default: 'USD' },
    },
    location: String,
    remote: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['drafted', 'published', 'closed', 'archived'],
      default: 'drafted',
    },
    slug: { type: String, unique: true },
    views: { type: Number, default: 0 },
    applicationCount: { type: Number, default: 0 },
    featured: { type: Boolean, default: false },
    featuredUntil: { type: Date },
    questions: {
      type: [
        {
          question: { type: String, required: true },
          required: { type: Boolean, default: false },
          type: {
            type: String,
            enum: ['text', 'paragraph', 'single_choice', 'multi_choice', 'dropdown', 'date'],
            default: 'text',
          },
          options: { type: [String], default: [] },
          maxLength: { type: Number },
          maxLengthUnit: {
            type: String,
            enum: ['words', 'characters'],
          },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

// Index for slug uniqueness and status
jobSchema.index({ company: 1, status: 1 });
jobSchema.index({ slug: 1 });
jobSchema.index({ industry: 1, status: 1 });
jobSchema.index({ featured: 1, status: 1, featuredUntil: 1 });

export const Job = model<IJob>('Job', jobSchema);
