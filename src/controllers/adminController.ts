import { Request, Response } from 'express';
import { Admin } from '../models/Admin';
import { PlanConfig } from '../models/PlanConfig';
import { User } from '../models/User';
import { Company, PLAN_LIMITS } from '../models/Company';
import { Job } from '../models/Job';
import { Application } from '../models/Application';
import { Favourite } from '../models/Favourite';
import { TeamMember } from '../models/TeamMember';
import { CompanyNotification } from '../models/CompanyNotification';
import { Payment } from '../models/Payment';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { generateToken } from '../utils/jwt';
import { generateVerificationToken } from '../utils/validators';
import { ResendService } from '../services';

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  ...(process.env.COOKIE_DOMAIN && { domain: process.env.COOKIE_DOMAIN }),
};

// ─── Auth ────────────────────────────────────────────────────────────────────

export const adminLogin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;
  if (!email || !password) throw new AppError('Email and password required', 400);

  const admin = await Admin.findOne({ email });
  if (!admin) throw new AppError('Invalid credentials', 401);

  const valid = await admin.comparePassword(password);
  if (!valid) throw new AppError('Invalid credentials', 401);

  const token = generateToken({ _id: admin._id.toString(), email: admin.email, type: 'admin' });
  res.cookie('admin_jwt', token, COOKIE_OPTS);

  res.json({
    success: true,
    token,
    data: { _id: admin._id, name: admin.name, email: admin.email, role: admin.role },
  });
});

export const adminLogout = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  res.clearCookie('admin_jwt', process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {});
  res.json({ success: true, message: 'Logged out' });
});

export const getAdminMe = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const admin = await Admin.findById(req.user!._id).select('-password');
  if (!admin) throw new AppError('Admin not found', 404);
  res.json({ success: true, data: admin });
});

export const updateAdminProfile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { name, email } = req.body;
  if (!name && !email) throw new AppError('Provide name or email to update', 400);

  const admin = await Admin.findById(req.user!._id);
  if (!admin) throw new AppError('Admin not found', 404);

  if (email && email !== admin.email) {
    const taken = await Admin.findOne({ email, _id: { $ne: admin._id } });
    if (taken) throw new AppError('Email already in use', 409);
    admin.email = email;
  }
  if (name) admin.name = name;

  await admin.save();
  res.json({ success: true, data: { _id: admin._id, name: admin.name, email: admin.email, role: admin.role } });
});

export const updateAdminPassword = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) throw new AppError('currentPassword and newPassword are required', 400);
  if (newPassword.length < 8) throw new AppError('New password must be at least 8 characters', 400);

  const admin = await Admin.findById(req.user!._id);
  if (!admin) throw new AppError('Admin not found', 404);

  const valid = await admin.comparePassword(currentPassword);
  if (!valid) throw new AppError('Current password is incorrect', 401);

  admin.password = newPassword;
  await admin.save();
  res.json({ success: true, message: 'Password updated' });
});

// ─── Stats ───────────────────────────────────────────────────────────────────

export const getOverviewStats = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const [
    userCount, suspendedUserCount,
    companyCount, verifiedCompanyCount, suspendedCompanyCount,
    publishedJobCount, totalJobCount,
    applicationCount,
    recentUsers, recentCompanies, recentJobs,
    planRevenue,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ suspended: true }),
    Company.countDocuments(),
    Company.countDocuments({ verified: true }),
    Company.countDocuments({ suspended: true }),
    Job.countDocuments({ status: 'published' }),
    Job.countDocuments(),
    Application.countDocuments(),
    User.find().sort({ createdAt: -1 }).limit(8).select('firstname lastname email verified suspended createdAt'),
    Company.find().sort({ createdAt: -1 }).limit(8).select('companyName email verified suspended paymentPlan createdAt'),
    Job.find().sort({ createdAt: -1 }).limit(8).select('title status createdAt').populate('company', 'companyName'),
    Company.aggregate([{ $group: { _id: '$paymentPlan.planType', count: { $sum: 1 } } }]),
  ]);

  res.json({
    success: true,
    data: {
      counts: {
        users: userCount,
        suspendedUsers: suspendedUserCount,
        companies: companyCount,
        verifiedCompanies: verifiedCompanyCount,
        suspendedCompanies: suspendedCompanyCount,
        publishedJobs: publishedJobCount,
        totalJobs: totalJobCount,
        applications: applicationCount,
      },
      planRevenue,
      recentUsers,
      recentCompanies,
      recentJobs,
    },
  });
});

// ─── Users ───────────────────────────────────────────────────────────────────

export const listUsers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { page = 1, limit = 20, search, verified, suspended } = req.query;
  const pageNum = parseInt(page as string) || 1;
  const limitNum = parseInt(limit as string) || 20;
  const filter: any = {};
  if (search) filter.$or = [
    { firstname: { $regex: search, $options: 'i' } },
    { lastname: { $regex: search, $options: 'i' } },
    { email: { $regex: search, $options: 'i' } },
  ];
  if (verified !== undefined) filter.verified = verified === 'true';
  if (suspended !== undefined) filter.suspended = suspended === 'true';

  const [users, total] = await Promise.all([
    User.find(filter).select('-password -verificationToken -resetPasswordToken').sort({ createdAt: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum),
    User.countDocuments(filter),
  ]);

  res.json({ success: true, data: { users, total, page: pageNum, totalPages: Math.ceil(total / limitNum) } });
});

export const getUserDetail = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = await User.findById(req.params.id).select('-password -verificationToken -resetPasswordToken');
  if (!user) throw new AppError('User not found', 404);

  const [applicationCount, favouriteCount] = await Promise.all([
    Application.countDocuments({ applicant: user._id }),
    Favourite.countDocuments({ user: user._id }),
  ]);

  res.json({ success: true, data: { ...user.toObject(), applicationCount, favouriteCount } });
});

export const adminCreateUser = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { firstname, lastname, email, password } = req.body;
  if (!firstname || !lastname || !email || !password) {
    throw new AppError('firstname, lastname, email and password are required', 400);
  }
  const exists = await User.findOne({ email: email.toLowerCase() });
  if (exists) throw new AppError('A user with this email already exists', 409);

  const verificationToken = generateVerificationToken();
  await User.create({ firstname, lastname, email, password, verificationToken });
  await ResendService.sendVerificationEmail(email, verificationToken, 'user');

  res.status(201).json({
    success: true,
    message: 'User created. A verification email has been sent to their inbox.',
  });
});

export const suspendUser = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = await User.findByIdAndUpdate(req.params.id, { suspended: true }, { new: true }).select('-password');
  if (!user) throw new AppError('User not found', 404);
  res.json({ success: true, data: user });
});

export const activateUser = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = await User.findByIdAndUpdate(req.params.id, { suspended: false }, { new: true }).select('-password');
  if (!user) throw new AppError('User not found', 404);
  res.json({ success: true, data: user });
});

export const deleteUser = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError('User not found', 404);

  await Promise.all([
    Application.deleteMany({ applicant: user._id }),
    Favourite.deleteMany({ user: user._id }),
    User.deleteOne({ _id: user._id }),
  ]);

  res.json({ success: true, message: 'User deleted' });
});

// ─── Companies ───────────────────────────────────────────────────────────────

export const listCompanies = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { page = 1, limit = 20, search, planType, verified, suspended } = req.query;
  const pageNum = parseInt(page as string) || 1;
  const limitNum = parseInt(limit as string) || 20;
  const filter: any = {};
  if (search) filter.$or = [
    { companyName: { $regex: search, $options: 'i' } },
    { email: { $regex: search, $options: 'i' } },
  ];
  if (planType) filter['paymentPlan.planType'] = planType;
  if (verified !== undefined) filter.verified = verified === 'true';
  if (suspended !== undefined) filter.suspended = suspended === 'true';

  const [companies, total] = await Promise.all([
    Company.find(filter).select('-password -verificationToken -resetPasswordToken').sort({ createdAt: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum),
    Company.countDocuments(filter),
  ]);

  res.json({ success: true, data: { companies, total, page: pageNum, totalPages: Math.ceil(total / limitNum) } });
});

export const getCompanyDetail = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const company = await Company.findById(req.params.id).select('-password -verificationToken -resetPasswordToken');
  if (!company) throw new AppError('Company not found', 404);

  const [jobs, payments] = await Promise.all([
    Job.find({ company: company._id }).select('title status location views applicationCount createdAt').sort({ createdAt: -1 }).limit(20),
    Payment.find({ company: company._id }).sort({ createdAt: -1 }),
  ]);

  res.json({ success: true, data: { ...company.toObject(), jobs, payments } });
});

export const adminCreateCompany = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { companyName, email, password } = req.body;
  if (!companyName || !email || !password) {
    throw new AppError('companyName, email and password are required', 400);
  }
  const exists = await Company.findOne({ email: email.toLowerCase() });
  if (exists) throw new AppError('A company with this email already exists', 409);

  const verificationToken = generateVerificationToken();
  await Company.create({ companyName, email, password, verificationToken, onboardingStep: 'profile' });
  await ResendService.sendVerificationEmail(email, verificationToken, 'company');

  res.status(201).json({
    success: true,
    message: 'Company created. A verification email has been sent to their inbox.',
  });
});

export const verifyCompany = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const company = await Company.findByIdAndUpdate(
    req.params.id,
    { verified: true, onboardingStep: 'complete' },
    { new: true }
  ).select('-password');
  if (!company) throw new AppError('Company not found', 404);
  res.json({ success: true, data: company });
});

export const suspendCompany = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const company = await Company.findByIdAndUpdate(req.params.id, { suspended: true }, { new: true }).select('-password');
  if (!company) throw new AppError('Company not found', 404);
  res.json({ success: true, data: company });
});

export const activateCompany = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const company = await Company.findByIdAndUpdate(req.params.id, { suspended: false }, { new: true }).select('-password');
  if (!company) throw new AppError('Company not found', 404);
  res.json({ success: true, data: company });
});

export const deleteCompany = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const company = await Company.findById(req.params.id);
  if (!company) throw new AppError('Company not found', 404);

  const jobs = await Job.find({ company: company._id }).select('_id');
  const jobIds = jobs.map((j) => j._id);

  await Promise.all([
    Application.deleteMany({ job: { $in: jobIds } }),
    Favourite.deleteMany({ job: { $in: jobIds } }),
    Job.deleteMany({ company: company._id }),
    TeamMember.deleteMany({ company: company._id }),
    CompanyNotification.deleteMany({ company: company._id }),
    Payment.deleteMany({ company: company._id }),
    Company.deleteOne({ _id: company._id }),
  ]);

  res.json({ success: true, message: 'Company deleted' });
});

// ─── Jobs ────────────────────────────────────────────────────────────────────

export const listAllJobs = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { page = 1, limit = 20, search, status, featured, company } = req.query;
  const pageNum = parseInt(page as string) || 1;
  const limitNum = parseInt(limit as string) || 20;
  const filter: any = {};
  if (search) filter.$or = [{ title: { $regex: search, $options: 'i' } }];
  if (status) filter.status = status;
  if (featured !== undefined) filter.featured = featured === 'true';
  if (company) filter.company = company;

  const [jobs, total] = await Promise.all([
    Job.find(filter).populate('company', 'companyName logo').sort({ createdAt: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum),
    Job.countDocuments(filter),
  ]);

  res.json({ success: true, data: { jobs, total, page: pageNum, totalPages: Math.ceil(total / limitNum) } });
});

export const getJobDetail = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const job = await Job.findById(req.params.id).populate('company', 'companyName logo email');
  if (!job) throw new AppError('Job not found', 404);
  res.json({ success: true, data: job });
});

export const forceCloseJob = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const job = await Job.findByIdAndUpdate(req.params.id, { status: 'closed' }, { new: true });
  if (!job) throw new AppError('Job not found', 404);
  res.json({ success: true, data: job });
});

export const toggleFeaturedJob = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const job = await Job.findById(req.params.id);
  if (!job) throw new AppError('Job not found', 404);

  const nowFeatured = !job.featured;
  const { daysToFeature = 30 } = req.body;
  const featuredUntil = nowFeatured ? new Date(Date.now() + Number(daysToFeature) * 86400000) : undefined;

  job.featured = nowFeatured;
  job.featuredUntil = featuredUntil;
  await job.save();

  res.json({ success: true, data: job });
});

export const adminDeleteJob = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const job = await Job.findById(req.params.id);
  if (!job) throw new AppError('Job not found', 404);

  await Promise.all([
    Application.deleteMany({ job: job._id }),
    Job.deleteOne({ _id: job._id }),
  ]);

  res.json({ success: true, message: 'Job deleted' });
});

// ─── Pricing ─────────────────────────────────────────────────────────────────

export const listPlanConfigs = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const configs = await PlanConfig.find().sort({ order: 1, createdAt: 1 });
  res.json({ success: true, data: configs });
});

export const getPublicPlans = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const configs = await PlanConfig.find().sort({ order: 1, createdAt: 1 }).select('-__v');
  res.json({ success: true, data: configs });
});

export const createPlanConfig = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { planType } = req.body;
  if (!planType) throw new AppError('planType is required', 400);

  const exists = await PlanConfig.findOne({ planType });
  if (exists) throw new AppError('A plan with this type already exists', 409);

  const config = await PlanConfig.create(req.body);
  res.status(201).json({ success: true, data: config });
});

export const updatePlanConfig = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { _id, __v, createdAt, updatedAt, ...updates } = req.body;
  const config = await PlanConfig.findByIdAndUpdate(
    req.params.id,
    { $set: updates },
    { new: true, runValidators: true }
  );
  if (!config) throw new AppError('Plan not found', 404);
  res.json({ success: true, data: config });
});

export const deletePlanConfig = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const config = await PlanConfig.findByIdAndDelete(req.params.id);
  if (!config) throw new AppError('Plan not found', 404);
  res.json({ success: true, message: 'Plan deleted' });
});

// ─── Email ───────────────────────────────────────────────────────────────────

export const sendBroadcast = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { segment, subject, html } = req.body;
  if (!segment || !subject || !html) throw new AppError('segment, subject, and html are required', 400);

  let emails: string[] = [];

  if (segment === 'all_users') {
    const users = await User.find({ suspended: false }).select('email');
    emails = users.map((u) => u.email);
  } else if (segment === 'all_companies') {
    const companies = await Company.find({ suspended: false }).select('email');
    emails = companies.map((c) => c.email);
  } else {
    // segment is a company _id — send to all users who applied to that company's jobs
    const jobs = await Job.find({ company: segment }).select('_id');
    const jobIds = jobs.map((j) => j._id);
    const apps = await Application.find({ job: { $in: jobIds } }).populate('applicant', 'email').select('applicant');
    const seen = new Set<string>();
    for (const app of apps) {
      const email = (app.applicant as any)?.email;
      if (email && !seen.has(email)) { seen.add(email); emails.push(email); }
    }
  }

  if (emails.length === 0) {
    res.json({ success: true, message: 'No recipients found', sent: 0 });
    return;
  }

  // Send in batches of 50
  const BATCH = 50;
  let sent = 0;
  for (let i = 0; i < emails.length; i += BATCH) {
    const batch = emails.slice(i, i + BATCH);
    await Promise.all(batch.map((email) => ResendService.sendCustomEmail(email, subject, html).catch(() => {})));
    sent += batch.length;
  }

  res.json({ success: true, message: `Broadcast sent to ${sent} recipients`, sent });
});

export const sendDirectEmail = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { recipientId, recipientType, subject, html } = req.body;
  if (!recipientId || !recipientType || !subject || !html) {
    throw new AppError('recipientId, recipientType, subject, and html are required', 400);
  }

  let email: string | undefined;
  if (recipientType === 'user') {
    const user = await User.findById(recipientId).select('email');
    email = user?.email;
  } else {
    const company = await Company.findById(recipientId).select('email');
    email = company?.email;
  }

  if (!email) throw new AppError('Recipient not found', 404);

  await ResendService.sendCustomEmail(email, subject, html);
  res.json({ success: true, message: `Email sent to ${email}` });
});

// ─── Business Verification ──────────────────────────────────────────────────

// Get pending verifications
export const getPendingVerifications = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const companies = await Company.find({ 'businessVerification.status': 'pending' })
    .select('companyName email businessVerification createdAt')
    .sort({ 'businessVerification.submittedAt': -1 });

  res.json({
    success: true,
    data: companies,
    total: companies.length,
  });
});

// Approve company verification
export const approveCompanyVerification = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { companyId } = req.params;
  const { adminNotes } = req.body;

  const company = await Company.findById(companyId);
  if (!company) {
    throw new AppError('Company not found', 404);
  }

  company.businessVerification = {
    ...company.businessVerification,
    status: 'approved',
    verifiedAt: new Date(),
    reviewedBy: req.user!._id as any,
    reviewedAt: new Date(),
    adminNotes: adminNotes || '',
  };
  company.canPostJobs = true;

  await company.save();

  // Send approval email
  await ResendService.sendVerificationApprovedEmail(company.email, company.companyName);

  res.json({
    success: true,
    message: 'Company verified and approved',
    data: company.businessVerification,
  });
});

// Reject company verification
export const rejectCompanyVerification = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { companyId } = req.params;
  const { rejectionReason, adminNotes } = req.body;

  if (!rejectionReason) {
    throw new AppError('Rejection reason is required', 400);
  }

  const company = await Company.findById(companyId);
  if (!company) {
    throw new AppError('Company not found', 404);
  }

  company.businessVerification = {
    ...company.businessVerification,
    status: 'rejected',
    rejectionReason,
    reviewedBy: req.user!._id as any,
    reviewedAt: new Date(),
    adminNotes: adminNotes || '',
  };
  company.canPostJobs = false;

  await company.save();

  // Send rejection email
  await ResendService.sendVerificationRejectedEmail(
    company.email,
    company.companyName,
    rejectionReason,
    adminNotes || undefined
  );

  res.json({
    success: true,
    message: 'Company verification rejected',
    data: company.businessVerification,
  });
});

