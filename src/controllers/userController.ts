import crypto from 'crypto';
import { Request, Response } from 'express';
import { User } from '../models/User';
import { Company, PLAN_LIMITS } from '../models/Company';
import { PlanConfig } from '../models/PlanConfig';
import { Payment } from '../models/Payment';
import { TeamMember } from '../models/TeamMember';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { calculateProfileCompletion, calculateCompanyProfileCompletion } from '../utils/profile';
import { getTokenExpiry } from '../utils/jwt';
import { PaystackService, ResendService } from '../services/index';

async function generateInvoiceNumber(): Promise<string> {
  const count = await Payment.countDocuments();
  return `INV-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
}

// Get user profile
export const getUserProfile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError('Unauthorized', 401);
  }

  const user = await User.findById(req.user._id);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  const profileCompletion = calculateProfileCompletion(user);
  user.profileCompletion = profileCompletion;
  await user.save();

  res.json({ success: true, data: user });
});

// Update user profile
export const updateUserProfile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError('Unauthorized', 401);
  }

  const allowedFields = [
    'firstname',
    'lastname',
    'phone',
    'country',
    'bio',
    'profilePhoto',
    'coverPhoto',
    'skills',
  ];
  const updates: any = {};

  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  });

  const user = await User.findByIdAndUpdate(req.user._id, updates, {
    new: true,
    runValidators: true,
  });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  const profileCompletion = calculateProfileCompletion(user);
  user.profileCompletion = profileCompletion;
  await user.save();

  res.json({ success: true, data: user });
});

// Add experience
export const addExperience = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError('Unauthorized', 401);
  }

  const { company, position, startDate, endDate, currentlyWorking, description } = req.body;

  if (!company || !position || !startDate) {
    throw new AppError('Company, position, and start date are required', 400);
  }

  const user = await User.findById(req.user._id);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  user.experience.push({
    company,
    position,
    startDate: new Date(startDate),
    endDate: endDate ? new Date(endDate) : undefined,
    currentlyWorking: currentlyWorking || false,
    description,
  });

  await user.save();

  const profileCompletion = calculateProfileCompletion(user);
  user.profileCompletion = profileCompletion;
  await user.save();

  res.status(201).json({ success: true, data: user });
});

// Update experience
export const updateExperience = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError('Unauthorized', 401);
  }

  const { experienceId } = req.params;
  const updates = req.body;

  const user = await User.findById(req.user._id);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  const experience = user.experience.find((exp) => exp._id?.toString() === experienceId);
  if (!experience) {
    throw new AppError('Experience not found', 404);
  }

  Object.assign(experience, updates);
  await user.save();

  res.json({ success: true, data: user });
});

// Delete experience
export const deleteExperience = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError('Unauthorized', 401);
  }

  const { experienceId } = req.params;

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $pull: { experience: { _id: experienceId } } },
    { new: true }
  );

  if (!user) {
    throw new AppError('User not found', 404);
  }

  res.json({ success: true, data: user });
});

// Add education
export const addEducation = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError('Unauthorized', 401);
  }

  const { school, degree, field, startDate, endDate, description } = req.body;

  if (!school || !degree || !field || !startDate) {
    throw new AppError('School, degree, field, and start date are required', 400);
  }

  const user = await User.findById(req.user._id);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  user.education.push({
    school,
    degree,
    field,
    startDate: new Date(startDate),
    endDate: endDate ? new Date(endDate) : undefined,
    description,
  });

  await user.save();

  const profileCompletion = calculateProfileCompletion(user);
  user.profileCompletion = profileCompletion;
  await user.save();

  res.status(201).json({ success: true, data: user });
});

// Update education
export const updateEducation = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError('Unauthorized', 401);
  }

  const { educationId } = req.params;
  const updates = req.body;

  const user = await User.findById(req.user._id);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  const education = user.education.find((edu) => edu._id?.toString() === educationId);
  if (!education) {
    throw new AppError('Education not found', 404);
  }

  Object.assign(education, updates);
  await user.save();

  res.json({ success: true, data: user });
});

// Delete education
export const deleteEducation = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError('Unauthorized', 401);
  }

  const { educationId } = req.params;

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $pull: { education: { _id: educationId } } },
    { new: true }
  );

  if (!user) {
    throw new AppError('User not found', 404);
  }

  res.json({ success: true, data: user });
});

// Get company profile
export const getCompanyProfile = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AppError('Unauthorized', 401);
    }

    const company = await Company.findById(req.user._id);
    if (!company) {
      throw new AppError('Company not found', 404);
    }

    const profileCompletion = calculateCompanyProfileCompletion(company);

    res.json({ success: true, data: { ...company.toObject(), profileCompletion } });
  }
);

// Update company profile
export const updateCompanyProfile = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AppError('Unauthorized', 401);
    }

    const allowedFields = [
      'companyName',
      'phone',
      'address',
      'city',
      'state',
      'country',
      'website',
      'industry',
      'companySize',
      'description',
      'logo',
      'coverPhoto',
    ];
    const updates: any = {};

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const company = await Company.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    });

    if (!company) {
      throw new AppError('Company not found', 404);
    }

    res.json({ success: true, data: company });
  }
);

// Save onboarding profile (stage 1)
export const saveOnboardingProfile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) throw new AppError('Unauthorized', 401);

  const allowedFields = ['phone', 'companySize', 'industry', 'address', 'city', 'state', 'country', 'website', 'description'];
  const updates: any = {};
  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });
  // Skip subscription step — all accounts default to enterprise
  updates.onboardingStep = 'complete';

  const company = await Company.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
  if (!company) throw new AppError('Company not found', 404);

  res.json({ success: true, data: company });
});

// Select subscription plan (stage 2)
export const selectPlan = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) throw new AppError('Unauthorized', 401);

  const { planType, billingCycle = 'monthly', callbackUrl: clientCallbackUrl } = req.body;
  if (!planType) throw new AppError('planType is required', 400);

  const company = await Company.findById(req.user._id);
  if (!company) throw new AppError('Company not found', 404);

  // Look up plan from admin-configured PlanConfig, fall back to PLAN_LIMITS
  const planConfig = await PlanConfig.findOne({ planType });

  const isFree = planConfig ? planConfig.monthlyPrice === 0 : planType === 'starter';

  if (isFree) {
    const credits = planConfig?.credits ?? PLAN_LIMITS[planType as keyof typeof PLAN_LIMITS]?.credits ?? 2;
    company.paymentPlan.planType = planType;
    company.paymentPlan.credits = credits;
    company.paymentPlan.used = 0;
    company.paymentPlan.billingCycle = 'monthly';
    (company as any).onboardingStep = 'complete';
    await company.save();
    const updatedFree = await Company.findById(company._id).select('-password -verificationToken -resetPasswordToken -pendingPlanType -pendingBillingCycle');
    return res.json({ success: true, data: updatedFree }) as any;
  }

  // Paid plan — init Paystack transaction
  // Amount must be in smallest currency unit (e.g. pesewas for GHS, kobo for NGN)
  if (!planConfig) throw new AppError('Plan not found. Please contact support.', 400);
  const price = planConfig.monthlyPrice;
  if (!price || price <= 0) throw new AppError('Plan price not configured', 400);

  const amount = price * 100; // convert to smallest unit
  const currency = planConfig?.currency ?? 'GHS';
  const reference = `internse_${company._id}_${Date.now()}`;
  const callbackUrl = (typeof clientCallbackUrl === 'string' && clientCallbackUrl.startsWith(process.env.CLIENT_URL ?? ''))
    ? clientCallbackUrl
    : `${process.env.CLIENT_URL}/employer/onboarding/success`;

  const result = await PaystackService.initializeTransaction(company.email, amount, reference, currency, callbackUrl);

  // Store reference + pending plan so webhook or verify endpoint can fulfil it
  company.paymentPlan.paystackSubscriptionId = reference;
  company.pendingPlanType = planType;
  company.pendingBillingCycle = billingCycle;
  await company.save();

  res.json({ success: true, data: { authorizationUrl: result.authorizationUrl, reference } });
});

// Verify Paystack payment (called after redirect)
export const verifyPayment = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) throw new AppError('Unauthorized', 401);

  const { reference } = req.query as { reference: string };
  if (!reference) throw new AppError('Payment reference required', 400);

  console.log(`[verifyPayment] Verifying reference: ${reference} for user: ${req.user._id}`);

  const company = await Company.findById(req.user._id) as any;
  if (!company) throw new AppError('Company not found', 404);

  // If already verified (no pending plan but payment exists), just return company
  if (!company.pendingPlanType) {
    console.log(`[verifyPayment] Already verified for ${company._id}, returning existing company`);
    const updated = await Company.findById(company._id).select('-password -verificationToken -resetPasswordToken -pendingPlanType -pendingBillingCycle');
    return res.json({ success: true, data: updated }) as any;
  }

  try {
    const verified = await PaystackService.verifyTransaction(reference);
    console.log(`[verifyPayment] PayStack verification result: ${verified}`);
    if (!verified) throw new AppError('Payment verification failed', 400);
  } catch (error: any) {
    console.error(`[verifyPayment] PayStack verification error:`, error.message);
    throw error;
  }

  const planType = company.pendingPlanType;
  const billingCycle = company.pendingBillingCycle ?? 'monthly';

  // Use PlanConfig if available, fall back to PLAN_LIMITS
  const planConfig = await PlanConfig.findOne({ planType });
  const credits = planConfig?.credits ?? PLAN_LIMITS[planType as keyof typeof PLAN_LIMITS]?.credits ?? 0;

  const periodStart = new Date();
  const periodEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);

  company.paymentPlan.planType = planType;
  company.paymentPlan.credits = credits;
  company.paymentPlan.used = 0;
  company.paymentPlan.billingCycle = billingCycle;
  company.paymentPlan.currentPeriodStart = periodStart;
  company.paymentPlan.currentPeriodEnd = periodEnd;
  company.onboardingStep = 'complete';
  company.pendingPlanType = undefined;
  company.pendingBillingCycle = undefined;
  await company.save();

  console.log(`[verifyPayment] Plan updated for ${company._id}: ${planType}`);

  // Record payment (upsert by reference so webhook + verify don't double-record)
  const invoiceNumber = await generateInvoiceNumber();
  await Payment.findOneAndUpdate(
    { reference },
    {
      $setOnInsert: { invoiceNumber },
      $set: {
        company: company._id,
        reference,
        planType,
        planDisplayName: planConfig?.displayName ?? planType,
        amount: planConfig?.monthlyPrice ?? 0,
        currency: planConfig?.currency ?? 'GHS',
        billingCycle,
        status: 'success',
        paidAt: new Date(),
        periodStart,
        periodEnd,
      },
    },
    { upsert: true, new: true }
  );

  const updated = await Company.findById(company._id).select('-password -verificationToken -resetPasswordToken -pendingPlanType -pendingBillingCycle');
  res.json({ success: true, data: updated });
});

// Paystack webhook
export const paystackWebhook = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const secret = process.env.PAYSTACK_SECRET_KEY ?? '';
  const hash = crypto.createHmac('sha512', secret).update(JSON.stringify(req.body)).digest('hex');

  if (hash !== req.headers['x-paystack-signature']) {
    res.status(400).json({ success: false, message: 'Invalid signature' });
    return;
  }

  const { event, data } = req.body;
  if (event === 'charge.success') {
    const reference = data?.reference as string;
    const company = await Company.findOne({ 'paymentPlan.paystackSubscriptionId': reference }) as any;
    if (company && company.pendingPlanType) {
      const planType = company.pendingPlanType;
      const planConfig = await PlanConfig.findOne({ planType });
      const credits = planConfig?.credits ?? PLAN_LIMITS[planType as keyof typeof PLAN_LIMITS]?.credits ?? 0;
      company.paymentPlan.planType = planType;
      company.paymentPlan.credits = credits;
      company.paymentPlan.used = 0;
      const wPeriodStart = new Date();
      const wPeriodEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
      company.paymentPlan.currentPeriodStart = wPeriodStart;
      company.paymentPlan.currentPeriodEnd = wPeriodEnd;
      company.onboardingStep = 'complete';
      const wBillingCycle = company.pendingBillingCycle ?? 'monthly';
      company.pendingPlanType = undefined;
      company.pendingBillingCycle = undefined;
      await company.save();

      const wInvoiceNumber = await generateInvoiceNumber();
      await Payment.findOneAndUpdate(
        { reference },
        {
          $setOnInsert: { invoiceNumber: wInvoiceNumber },
          $set: {
            company: company._id,
            planType,
            planDisplayName: planConfig?.displayName ?? planType,
            amount: planConfig?.monthlyPrice ?? 0,
            currency: planConfig?.currency ?? 'GHS',
            billingCycle: wBillingCycle,
            status: 'success',
            paidAt: new Date(),
            periodStart: wPeriodStart,
            periodEnd: wPeriodEnd,
          },
        },
        { upsert: true, new: true }
      );
    }
  }

  res.json({ received: true });
});

// Billing history
export const getBillingHistory = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) throw new AppError('Unauthorized', 401);
  const payments = await Payment.find({ company: req.user._id }).sort({ createdAt: -1 }).limit(50);
  res.json({ success: true, data: payments });
});

// Invite team member
export const inviteTeamMember = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) throw new AppError('Unauthorized', 401);

  const { email, role } = req.body;
  if (!email || !role) throw new AppError('Email and role are required', 400);
  if (!['admin', 'recruiter', 'viewer'].includes(role)) throw new AppError('Invalid role', 400);

  const company = await Company.findById(req.user._id);
  if (!company) throw new AppError('Company not found', 404);

  // Check if email is already company owner
  if (email.toLowerCase() === company.email.toLowerCase()) throw new AppError('Cannot invite yourself', 400);

  // Check if already invited or member
  const existing = await TeamMember.findOne({ company: company._id, email: email.toLowerCase() });
  if (existing) throw new AppError('This email is already invited or a team member', 400);

  // Get plan config to check team seats
  const planConfig = await PlanConfig.findOne({ planType: company.paymentPlan.planType });
  const maxSeats = planConfig?.teamSeats ?? PLAN_LIMITS[company.paymentPlan.planType as keyof typeof PLAN_LIMITS]?.teamSeats ?? 1;

  // Count current team members (accepted + invited)
  const currentMembers = await TeamMember.countDocuments({ company: company._id });
  
  if (currentMembers >= maxSeats) {
    throw new AppError(`Your plan allows maximum ${maxSeats} team member${maxSeats !== 1 ? 's' : ''}. Upgrade your plan to add more.`, 400);
  }

  // Generate unique invite token (valid for 7 days)
  const inviteToken = crypto.randomBytes(32).toString('hex');
  const inviteTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  // Create team member invitation
  const teamMember = new TeamMember({
    company: company._id,
    email: email.toLowerCase(),
    role,
    status: 'invited',
    inviteToken,
    inviteTokenExpires,
  });
  await teamMember.save();

  const inviteLink = `${process.env.CLIENT_URL}/employer/join-team?token=${inviteToken}&email=${encodeURIComponent(email)}`;

  // Send invite email
  try {
    await ResendService.sendTeamInviteEmail(email, company.companyName, role, inviteLink);
    console.log(`[inviteTeamMember] Invite sent to ${email} for company ${company._id}`);
    res.json({ success: true, message: 'Invitation sent successfully', data: { email, role } });
  } catch (error) {
    console.error('Failed to send invite email:', error);
    // Delete the team member record if email fails
    await TeamMember.deleteOne({ _id: teamMember._id });
    throw new AppError('Failed to send invitation email', 500);
  }
});

// Get team members
export const getTeamMembers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) throw new AppError('Unauthorized', 401);

  const members = await TeamMember.find({ company: req.user._id }).select('-inviteToken -inviteTokenExpires').sort({ createdAt: -1 });
  res.json({ success: true, data: members });
});

// Accept team invitation
export const acceptTeamInvite = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { token } = req.query;
  
  if (!token || typeof token !== 'string') {
    throw new AppError('Invalid or missing invitation token', 400);
  }

  // Find the team member invitation
  const teamMember = await TeamMember.findOne({ inviteToken: token });
  
  if (!teamMember) {
    throw new AppError('Invitation not found', 404);
  }

  // Check if token is expired
  if (!teamMember.inviteTokenExpires || teamMember.inviteTokenExpires < new Date()) {
    throw new AppError('Invitation has expired', 400);
  }

  // Find the company
  const company = await Company.findById(teamMember.company);
  if (!company) {
    throw new AppError('Company not found', 404);
  }

  // Check if a sub-account for this email already exists
  let subAccount = await Company.findOne({ 
    email: teamMember.email, 
    _id: { $ne: company._id } 
  });

  // If already accepted, re-issue a token if the sub-account still needs a password set
  // (idempotent: handles browser double-requests and re-clicking the link)
  if (teamMember.status === 'accepted') {
    if (!subAccount) {
      throw new AppError('Invitation already accepted. Please log in.', 400);
    }
    if (!subAccount.mustSetPassword) {
      throw new AppError('Invitation already accepted. Please log in.', 400);
    }
    // Sub-account exists but hasn't set password yet — re-issue JWT
    const { generateToken } = await import('../utils/jwt');
    const jwtToken = generateToken({
      _id: subAccount._id.toString(),
      email: subAccount.email,
      type: 'company',
      mustSetPassword: true,
      teamRole: teamMember.role,
    });
    const expiry = getTokenExpiry(jwtToken);
    res.json({
      success: true,
      message: 'Invitation accepted successfully',
      data: {
        token: jwtToken,
        company: {
          _id: subAccount._id,
          companyName: subAccount.companyName,
          email: subAccount.email,
          onboardingStep: subAccount.onboardingStep,
          mustSetPassword: true,
          verified: subAccount.verified,
          teamRole: teamMember.role,
        },
        role: teamMember.role,
        mustSetPassword: true,
        tokenExpiry: expiry,
      },
    });
    return;
  }

  // If not, create a new sub-account (or link existing one)
  if (!subAccount) {
    // Generate a temporary random password
    const tempPassword = crypto.randomBytes(16).toString('hex');
    
    subAccount = await Company.create({
      companyName: company.companyName,
      email: teamMember.email,
      password: tempPassword,
      mustSetPassword: true,
      verified: true, // Already verified via invitation
      onboardingStep: 'complete',
      paymentPlan: company.paymentPlan,
    });
    
    console.log(`[acceptTeamInvite] Created sub-account ${subAccount._id} for ${teamMember.email}`);
  } else {
    // Update existing sub-account — team members never go through onboarding
    subAccount.mustSetPassword = true;
    subAccount.onboardingStep = 'complete';
    await subAccount.save();
  }

  // Mark team member as accepted
  teamMember.status = 'accepted';
  teamMember.acceptedAt = new Date();
  await teamMember.save();

  // Generate JWT with mustSetPassword flag and team role
  const { generateToken } = await import('../utils/jwt');
  const jwtToken = generateToken({
    _id: subAccount._id.toString(),
    email: subAccount.email,
    type: 'company',
    mustSetPassword: true,
    teamRole: teamMember.role,
  });

  // Get JWT expiry for frontend
  const expiry = getTokenExpiry(jwtToken);

  res.json({
    success: true,
    message: 'Invitation accepted successfully',
    data: {
      token: jwtToken,
      company: {
        _id: subAccount._id,
        companyName: subAccount.companyName,
        email: subAccount.email,
        onboardingStep: subAccount.onboardingStep,
        mustSetPassword: true,
        verified: subAccount.verified,
        teamRole: teamMember.role,
      },
      role: teamMember.role,
      mustSetPassword: true,
      tokenExpiry: expiry,
    },
  });
});

// Set password (for team members who haven't set password yet)
export const setPassword = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError('Unauthorized', 401);
  }

  const { newPassword, confirmPassword } = req.body;

  if (!newPassword || !confirmPassword) {
    throw new AppError('New password and confirmation are required', 400);
  }

  if (newPassword !== confirmPassword) {
    throw new AppError('Passwords do not match', 400);
  }

  if (newPassword.length < 8) {
    throw new AppError('Password must be at least 8 characters', 400);
  }

  // Find the company (for teams) or user (for individuals)
  const company = await Company.findById(req.user._id);
  if (!company) {
    throw new AppError('Company not found', 401);
  }

  // Check if they need to set password
  if (!company.mustSetPassword) {
    throw new AppError('Password has already been set', 400);
  }

  // Update password and clear flag
  company.password = newPassword;
  company.mustSetPassword = false;
  await company.save();

  console.log(`[setPassword] Password set for company ${company._id}`);

  res.json({
    success: true,
    message: 'Password set successfully. You can now log in normally.',
    data: { email: company.email },
  });
});

// Remove team member
export const removeTeamMember = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) throw new AppError('Unauthorized', 401);

  const { memberId } = req.params;

  // Find the team member
  const teamMember = await TeamMember.findById(memberId);
  if (!teamMember) {
    throw new AppError('Team member not found', 404);
  }

  // Verify team member belongs to the current company
  if (teamMember.company.toString() !== req.user._id.toString()) {
    throw new AppError('Not authorized to remove this team member', 403);
  }

  // If the team member accepted the invitation, delete their sub-account
  if (teamMember.status === 'accepted') {
    const subAccount = await Company.findOne({ email: teamMember.email });
    if (subAccount) {
      await Company.deleteOne({ _id: subAccount._id });
      console.log(`[removeTeamMember] Deleted sub-account ${subAccount._id}`);
    }
  }

  // Delete the team member record
  await TeamMember.deleteOne({ _id: teamMember._id });
  console.log(`[removeTeamMember] Removed team member ${memberId} from company ${req.user._id}`);

  res.json({ success: true, message: 'Team member removed successfully' });
});

// Upload resume
export const uploadResume = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError('Unauthorized', 401);
  }

  if (!req.file) {
    throw new AppError('No file provided', 400);
  }

  const { CloudinaryService } = await import('../services');
  const resumeUrl = await CloudinaryService.uploadFile(req.file, 'resumes', req.file.originalname);

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { resume: resumeUrl },
    { new: true }
  ).select('-password');

  res.json({ success: true, data: user });
});

// Change password
export const changePassword = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError('Unauthorized', 401);
  }

  const { currentPassword, newPassword, confirmPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new AppError('Current password and new password are required', 400);
  }

  if (newPassword !== confirmPassword) {
    throw new AppError('Passwords do not match', 400);
  }

  const user = await User.findById(req.user._id) || (await Company.findById(req.user._id));
  if (!user) {
    throw new AppError('User not found', 404);
  }

  const isPasswordCorrect = await (user as any).comparePassword(currentPassword);
  if (!isPasswordCorrect) {
    throw new AppError('Current password is incorrect', 401);
  }

  (user as any).password = newPassword;
  await (user as any).save();

  res.json({ success: true, message: 'Password changed successfully' });
});
