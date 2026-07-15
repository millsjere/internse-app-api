import { Schema, model } from 'mongoose';
import bcrypt from 'bcryptjs';
import { ICompany } from '../types';

// Plan limits configuration
export const PLAN_LIMITS = {
  starter: {
    credits: 2,        // 2 lifetime posts, no monthly reset
    resetsMonthly: false,
    teamSeats: 1,
    featuredListings: 0,
  },
  growth: {
    credits: 15,       // 15 credits per month
    resetsMonthly: true,
    teamSeats: 5,
    featuredListings: 2,
  },
  enterprise: {
    credits: -1,       // -1 = unlimited
    resetsMonthly: true,
    teamSeats: -1,     // unlimited
    featuredListings: -1,
  },
} as const;

const now = new Date();
const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

const companySchema = new Schema<ICompany>(
  {
    companyName: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    phone: String,
    address: String,
    city: String,
    state: String,
    country: String,
    website: String,
    industry: String,
    companySize: String,
    description: String,
    logo: String,
    coverPhoto: String,
    verified: { type: Boolean, default: false },
    suspended: { type: Boolean, default: false },
    onboardingStep: {
      type: String,
      enum: ['profile', 'subscription', 'complete'],
      default: 'profile',
    },
    verificationToken: String,
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    mustSetPassword: { type: Boolean, default: false },
    paymentPlan: {
      planType: { type: String, default: 'enterprise' },
      credits: { type: Number, default: -1 }, // -1 = unlimited
      used: { type: Number, default: 0 },
      billingCycle: { type: String, default: 'monthly' },
      currentPeriodStart: { type: Date, default: () => new Date() },
      currentPeriodEnd: {
        type: Date,
        default: () => new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
      },
      paystackCustomerId: String,
      paystackSubscriptionId: String,
    },
    pendingPlanType: { type: String },
    pendingBillingCycle: { type: String },
    businessVerification: {
      status: {
        type: String,
        enum: ['not_submitted', 'pending', 'approved', 'rejected'],
        default: 'not_submitted',
      },
      registrationDocument: String, // URL to uploaded document
      registrationNumber: String,
      verifiedAt: Date,
      rejectionReason: String,
      submittedAt: Date,
      reviewedBy: { type: Schema.Types.ObjectId, ref: 'Admin' },
      reviewedAt: Date,
      adminNotes: String,
    },
    canPostJobs: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Hash password before saving
companySchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Compare password method
companySchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

export const Company = model<ICompany>('Company', companySchema);
