import { Router } from 'express';
import { protect, protectCompany, requireCompanyRole } from '../middleware/auth';
import { upload } from '../middleware/upload';
import {
  getUserProfile,
  updateUserProfile,
  addExperience,
  updateExperience,
  deleteExperience,
  addEducation,
  updateEducation,
  deleteEducation,
  getCompanyProfile,
  updateCompanyProfile,
  changePassword,
  saveOnboardingProfile,
  selectPlan,
  verifyPayment,
  paystackWebhook,
  getBillingHistory,
  inviteTeamMember,
  getTeamMembers,
  removeTeamMember,
  acceptTeamInvite,
  setPassword,
  uploadResume,
  deleteResume,
  uploadBusinessDocument,
  submitBusinessVerification,
  getVerificationStatus,
} from '../controllers/userController';

const router = Router();

// User routes (protected)
router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, updateUserProfile);
router.post('/profile/password', protect, changePassword);
router.patch('/profile/resume', protect, upload.single('resume'), uploadResume);
router.delete('/profile/resume', protect, deleteResume);

// Experience routes
router.post('/profile/experience', protect, addExperience);
router.put('/profile/experience/:experienceId', protect, updateExperience);
router.delete('/profile/experience/:experienceId', protect, deleteExperience);

// Education routes
router.post('/profile/education', protect, addEducation);
router.put('/profile/education/:educationId', protect, updateEducation);
router.delete('/profile/education/:educationId', protect, deleteEducation);

// Company routes (protected) — Settings pages are admin-only for team members
router.get('/company/profile', protectCompany, requireCompanyRole(['admin']), getCompanyProfile);
router.put('/company/profile', protectCompany, requireCompanyRole(['admin']), updateCompanyProfile);
router.post('/company/password', protectCompany, requireCompanyRole(['admin']), changePassword);

// Onboarding routes
router.put('/company/onboarding/profile', protectCompany, saveOnboardingProfile);
router.post('/company/onboarding/plan', protectCompany, selectPlan);
router.get('/company/onboarding/verify', protectCompany, verifyPayment);

// Billing history
router.get('/company/billing', protectCompany, requireCompanyRole(['admin']), getBillingHistory);

// Invite team member
router.post('/company/invite-team-member', protectCompany, requireCompanyRole(['admin']), inviteTeamMember);
router.get('/company/team-members', protectCompany, requireCompanyRole(['admin']), getTeamMembers);
router.delete('/company/team-members/:memberId', protectCompany, requireCompanyRole(['admin']), removeTeamMember);
router.get('/team-invite/accept', acceptTeamInvite);
router.post('/company/set-password', protectCompany, setPassword);

// Paystack webhook (no auth — verified by signature)
router.post('/company/webhook/paystack', paystackWebhook);

// Business verification routes
router.post('/company/verification/upload', protectCompany, requireCompanyRole(['admin']), upload.single('document'), uploadBusinessDocument);
router.post('/company/verification/submit', protectCompany, requireCompanyRole(['admin']), submitBusinessVerification);
router.get('/company/verification/status', protectCompany, requireCompanyRole(['admin']), getVerificationStatus);

export default router;
