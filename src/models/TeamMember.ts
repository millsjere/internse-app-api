import { Schema, model, Document } from 'mongoose';

export interface ITeamMember extends Document {
  company: any; // Reference to Company
  email: string;
  fullName?: string;
  role: 'admin' | 'recruiter' | 'viewer';
  status: 'invited' | 'accepted' | 'rejected'; // pending or accepted
  inviteToken?: string;
  inviteTokenExpires?: Date;
  acceptedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const teamMemberSchema = new Schema<ITeamMember>(
  {
    company: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
    },
    fullName: String,
    role: {
      type: String,
      enum: ['admin', 'recruiter', 'viewer'],
      default: 'recruiter',
    },
    status: {
      type: String,
      enum: ['invited', 'accepted', 'rejected'],
      default: 'invited',
    },
    inviteToken: String,
    inviteTokenExpires: Date,
    acceptedAt: Date,
  },
  { timestamps: true }
);

// Ensure company + email is unique (can't invite same person twice to same company)
teamMemberSchema.index({ company: 1, email: 1 }, { unique: true });

export const TeamMember = model<ITeamMember>('TeamMember', teamMemberSchema);
