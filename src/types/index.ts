import { Document, ObjectId } from 'mongoose';

// User Types
export interface IUser extends Document {
  _id: ObjectId;
  firstname: string;
  lastname: string;
  email: string;
  password: string;
  phone?: string;
  country?: string;
  profilePhoto?: string;
  coverPhoto?: string;
  bio?: string;
  skills: string[];
  experience: IExperience[];
  education: IEducation[];
  resume?: string;
  profileCompletion: number;
  verified: boolean;
  suspended: boolean;
  verificationToken?: string;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

export interface IExperience {
  _id?: ObjectId;
  company: string;
  position: string;
  startDate: Date;
  endDate?: Date;
  currentlyWorking: boolean;
  description?: string;
}

export interface IEducation {
  _id?: ObjectId;
  school: string;
  degree: string;
  field: string;
  startDate: Date;
  endDate?: Date;
  description?: string;
}

// Company Types
export interface ICompany extends Document {
  _id: ObjectId;
  companyName: string;
  email: string;
  password: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  website?: string;
  industry?: string;
  companySize?: string;
  description?: string;
  logo?: string;
  coverPhoto?: string;
  verified: boolean;
  suspended: boolean;
  onboardingStep: 'profile' | 'subscription' | 'complete';
  verificationToken?: string;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  mustSetPassword?: boolean;
  paymentPlan: {
    planType: string;
    credits: number;
    used: number;
    billingCycle: string;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    paystackCustomerId?: string;
    paystackSubscriptionId?: string;
  };
  pendingPlanType?: string;
  pendingBillingCycle?: string;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

// Job Types
export interface IJob extends Document {
  _id: ObjectId;
  company: ObjectId;
  title: string;
  description: string;
  requirements: string[];
  responsibilities: string[];
  benefits: string[];
  tags: string[];
  industry: string;
  jobType: 'full-time' | 'part-time' | 'contract' | 'internship';
  category: 'internship' | 'volunteer' | 'fellowship';
  level: 'entry' | 'mid' | 'senior';
  salary?: {
    min?: number;
    max?: number;
    currency?: string;
  };
  location?: string;
  remote: boolean;
  status: 'drafted' | 'published' | 'closed' | 'archived';
  slug: string;
  views: number;
  applicationCount: number;
  featured: boolean;
  featuredUntil?: Date;
  questions: Array<{
    _id?: ObjectId;
    question: string;
    required: boolean;
    type?: 'text' | 'single_choice' | 'multi_choice';
    options?: string[];
    maxLength?: number;
    maxLengthUnit?: 'words' | 'characters';
  }>;
  createdAt: Date;
  updatedAt: Date;
}

// Application Types
export interface IApplication extends Document {
  _id: ObjectId;
  job: ObjectId;
  applicant: ObjectId;
  resume?: string;
  coverLetter?: string;
  status: 'pending' | 'reviewing' | 'rejected' | 'accepted';
  answers: Array<{
    questionId: string;
    question: string;
    type?: 'text' | 'single_choice' | 'multi_choice';
    options?: string[];
    answer: string | string[];
  }>;
  appliedAt: Date;
  updatedAt: Date;
}

// Favourite Types
export interface IFavourite extends Document {
  _id: ObjectId;
  user: ObjectId;
  job: ObjectId;
  createdAt: Date;
}

// Notification Types
export interface IUserNotification extends Document {
  _id: ObjectId;
  user: ObjectId;
  type: 'job_match' | 'application_update' | 'message' | 'system';
  title: string;
  message: string;
  read: boolean;
  link?: string;
  createdAt: Date;
}

export interface ICompanyNotification extends Document {
  _id: ObjectId;
  company: ObjectId;
  type: 'new_application' | 'profile_update' | 'job_status' | 'system';
  title: string;
  message: string;
  read: boolean;
  link?: string;
  relatedApplication?: ObjectId;
  createdAt: Date;
}


// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  status: number;
  message: string;
  data?: T;
  error?: string;
}

// Auth Types
export interface IAuthPayload {
  _id: string;
  email: string;
  type: 'user' | 'company' | 'admin';
  mustSetPassword?: boolean;
  teamRole?: 'admin' | 'recruiter' | 'viewer';
}

// Admin Types
export interface IAdmin extends Document {
  _id: ObjectId;
  name: string;
  email: string;
  password: string;
  role: 'super_admin';
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

// Plan Config Types
export interface IPlanConfig extends Document {
  planType: 'starter' | 'growth' | 'enterprise';
  displayName: string;
  monthlyPrice: number;
  annualPrice: number;
  credits: number;
  resetsMonthly: boolean;
  teamSeats: number;
  featuredListings: number;
  features: string[];
  createdAt: Date;
  updatedAt: Date;
}

// Pagination Types
export interface PaginationOptions {
  page: number;
  limit: number;
  skip: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
}
