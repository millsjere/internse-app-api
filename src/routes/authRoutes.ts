import { Router } from 'express';
import {
  userSignUp,
  userLogin,
  verifyEmail,
  companySignUp,
  companyLogin,
  verifyCompanyEmail,
  forgotPassword,
  resetPassword,
  logout,
  getCurrentUser,
  refreshToken,
} from '../controllers/authController';
import { protect, protectCompany } from '../middleware/auth';

const router = Router();

// User routes
router.post('/signup', userSignUp);
router.post('/verify-email', verifyEmail);
router.post('/login', userLogin);

// Company routes
router.post('/company/signup', companySignUp);
router.post('/company/verify-email', verifyCompanyEmail);
router.post('/company/login', companyLogin);

// Password reset
router.post('/forgot-password', forgotPassword);
router.patch('/reset-password', resetPassword);

// Protected routes
router.get('/me', protect, getCurrentUser);
router.post('/refresh-token', protect, refreshToken);

// Logout
router.post('/logout', logout);

export default router;
