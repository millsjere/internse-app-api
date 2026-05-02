import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { Company } from '../models/Company';
import { generateToken } from '../utils/jwt';
import {
  validateEmail,
  generateVerificationToken,
  generateResetToken,
} from '../utils/validators';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { ResendService } from '../services/index';

// Helper to get token expiry time in milliseconds
const getTokenExpiry = (token: string): number => {
  try {
    const decoded: any = jwt.decode(token);
    if (decoded?.exp) {
      return decoded.exp * 1000; // Convert from seconds to milliseconds
    }
  } catch (error) {
    // Return default 7 days from now if can't decode
    return Date.now() + 7 * 24 * 60 * 60 * 1000;
  }
  return Date.now() + 7 * 24 * 60 * 60 * 1000;
};

// User Sign Up
export const userSignUp = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { firstname, lastname, email, password, confirmPassword } = req.body;

  if (!firstname || !lastname || !email || !password) {
    throw new AppError('Please provide all required fields', 400);
  }

  if (password !== confirmPassword) {
    throw new AppError('Passwords do not match', 400);
  }

  if (!validateEmail(email)) {
    throw new AppError('Invalid email format', 400);
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new AppError('User already exists', 409);
  }

  const verificationToken = generateVerificationToken();

  const user = await User.create({
    firstname,
    lastname,
    email,
    password,
    verificationToken,
  });

  await ResendService.sendVerificationEmail(email, verificationToken, 'user');

  res.status(201).json({
    success: true,
    message: 'User created successfully. Please verify your email.',
    data: {
      _id: user._id,
      email: user.email,
      firstname: user.firstname,
      lastname: user.lastname,
    },
  });
});

// User Login
export const userLogin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new AppError('Please provide email and password', 400);
  }

  const user = await User.findOne({ email });
  if (!user) {
    throw new AppError('Invalid credentials', 401);
  }

  const isPasswordCorrect = await user.comparePassword(password);
  if (!isPasswordCorrect) {
    throw new AppError('Invalid credentials', 401);
  }

  if (!user.verified) {
    throw new AppError('Please verify your email first. Check your inbox for the verification email.', 403);
  }

  if (user.suspended) {
    throw new AppError('Your account has been suspended. Please contact support.', 403);
  }

  const token = generateToken({
    _id: user._id.toString(),
    email: user.email,
    type: 'user',
  });

  res.cookie('uid_jwt', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  const tokenExpiry = getTokenExpiry(token);

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      _id: user._id,
      email: user.email,
      firstname: user.firstname,
      lastname: user.lastname,
      verified: user.verified,
      tokenExpiry,
    },
  });
});

// Verify Email
export const verifyEmail = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { email, token } = req.body;

  if (!email || !token) {
    throw new AppError('Email and verification token are required', 400);
  }

  const user = await User.findOne({ email });
  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (user.verificationToken !== token) {
    throw new AppError('Invalid verification token', 400);
  }

  user.verified = true;
  user.verificationToken = undefined;
  await user.save();

  res.json({
    success: true,
    message: 'Email verified successfully',
  });
});

// Company Sign Up
export const companySignUp = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { companyName, email, password, confirmPassword } = req.body;

  if (!companyName || !email || !password) {
    throw new AppError('Please provide all required fields', 400);
  }

  if (password !== confirmPassword) {
    throw new AppError('Passwords do not match', 400);
  }

  if (!validateEmail(email)) {
    throw new AppError('Invalid email format', 400);
  }

  const existingCompany = await Company.findOne({ email });
  if (existingCompany) {
    throw new AppError('Company already exists', 409);
  }

  const verificationToken = generateVerificationToken();

  const company = await Company.create({
    companyName,
    email,
    password,
    verificationToken,
    onboardingStep: 'profile',
  });

  await ResendService.sendVerificationEmail(email, verificationToken, 'company');

  res.status(201).json({
    success: true,
    message: 'Company created successfully. Please verify your email.',
    data: {
      _id: company._id,
      email: company.email,
      companyName: company.companyName,
    },
  });
});

// Company Login
export const companyLogin = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new AppError('Please provide email and password', 400);
  }

  const company = await Company.findOne({ email });
  if (!company) {
    throw new AppError('Invalid credentials', 401);
  }

  const isPasswordCorrect = await company.comparePassword(password);
  if (!isPasswordCorrect) {
    throw new AppError('Invalid credentials', 401);
  }

  if (!company.verified) {
    throw new AppError('Please verify your email first. Check your inbox for the verification email.', 403);
  }

  if (company.suspended) {
    throw new AppError('Your account has been suspended. Please contact support.', 403);
  }

  const token = generateToken({
    _id: company._id.toString(),
    email: company.email,
    type: 'company',
  });

  res.cookie('cid_jwt', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  const tokenExpiry = getTokenExpiry(token);

  const companyData = await Company.findById(company._id).select('-password -verificationToken -resetPasswordToken -pendingPlanType -pendingBillingCycle');

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      ...companyData!.toObject(),
      type: 'company',
      tokenExpiry,
    },
  });
});

// Verify Company Email
export const verifyCompanyEmail = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { email, token } = req.body;

    if (!email || !token) {
      throw new AppError('Email and verification token are required', 400);
    }

    const company = await Company.findOne({ email });
    if (!company) {
      throw new AppError('Company not found', 404);
    }

    if (company.verificationToken !== token) {
      throw new AppError('Invalid verification token', 400);
    }

    company.verified = true;
    company.verificationToken = undefined;
    await company.save();

    res.json({
      success: true,
      message: 'Email verified successfully',
    });
  }
); 

// Forgot Password (User & Company)
export const forgotPassword = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body;

  if (!email) {
    throw new AppError('Email is required', 400);
  }

  const user = await User.findOne({ email });
  const company = await Company.findOne({ email });

  if (!user && !company) {
    throw new AppError('No account found with this email', 404);
  }

  const { token, expiresAt } = generateResetToken();

  if (user) {
    user.resetPasswordToken = token;
    user.resetPasswordExpires = expiresAt;
    await user.save();
  } else {
    (company as any).resetPasswordToken = token;
    (company as any).resetPasswordExpires = expiresAt;
    await company?.save();
  }

  await ResendService.sendPasswordResetEmail(email, token);

  res.json({
    success: true,
    message: 'Password reset link sent to your email',
  });
});

// Reset Password (User & Company)
export const resetPassword = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { email, token, newPassword, confirmPassword } = req.body;

  if (!email || !token || !newPassword) {
    throw new AppError('All fields are required', 400);
  }

  if (newPassword !== confirmPassword) {
    throw new AppError('Passwords do not match', 400);
  }

  const user = await User.findOne({ email });
  const company = await Company.findOne({ email });

  if (!user && !company) {
    throw new AppError('No account found with this email', 404);
  }

  const account = user || company;
  if ((account as any).resetPasswordToken !== token) {
    throw new AppError('Invalid reset token', 400);
  }

  if (new Date() > (account as any).resetPasswordExpires) {
    throw new AppError('Reset token has expired', 400);
  }

  (account as any).password = newPassword;
  (account as any).resetPasswordToken = undefined;
  (account as any).resetPasswordExpires = undefined;
  await (account as any).save();

  res.json({
    success: true,
    message: 'Password reset successfully',
  });
});

// Logout
export const logout = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  res.clearCookie('uid_jwt');
  res.clearCookie('cid_jwt');
  res.json({ success: true, message: 'Logout successful' });
});

// Get current user from token
export const getCurrentUser = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError('Not authenticated', 401);
  }

  const { _id, type } = req.user;

  let user;
  if (type === 'company') {
    user = await Company.findById(_id).select('-password');
  } else {
    user = await User.findById(_id).select('-password');
  }

  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Get token expiry from the current token
  let tokenExpiry = Date.now() + 7 * 24 * 60 * 60 * 1000; // Default 7 days
  if (req.token) {
    tokenExpiry = getTokenExpiry(req.token);
  }

  res.json({
    success: true,
    data: {
      ...user.toObject(),
      type, // Include type so frontend knows if it's a company or user
      tokenExpiry,
    },
  });
});

// Refresh token
export const refreshToken = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError('Not authenticated', 401);
  }

  const { _id, type, email } = req.user;

  // Generate new token
  const token = generateToken({
    _id: _id.toString(),
    email,
    type,
  });

  // Set appropriate cookie based on type
  const cookieName = type === 'company' ? 'cid_jwt' : 'uid_jwt';
  res.cookie(cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  const tokenExpiry = getTokenExpiry(token);

  res.json({
    success: true,
    message: 'Token refreshed successfully',
    data: {
      tokenExpiry,
    },
  });
});
