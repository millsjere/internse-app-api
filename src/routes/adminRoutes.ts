import { Router } from 'express';
import { protectAdmin } from '../middleware/auth';
import {
  adminLogin, adminLogout, getAdminMe, updateAdminProfile, updateAdminPassword,
  getOverviewStats,
  listUsers, getUserDetail, adminCreateUser, suspendUser, activateUser, deleteUser,
  listCompanies, getCompanyDetail, adminCreateCompany, verifyCompany, suspendCompany, activateCompany, deleteCompany,
  listAllJobs, getJobDetail, forceCloseJob, toggleFeaturedJob, adminDeleteJob,
  listPlanConfigs, getPublicPlans, createPlanConfig, updatePlanConfig, deletePlanConfig,
} from '../controllers/adminController';

const router = Router();

// Auth
router.post('/auth/login', adminLogin);
router.post('/auth/logout', adminLogout);
router.get('/auth/me', protectAdmin, getAdminMe);
router.patch('/auth/profile', protectAdmin, updateAdminProfile);
router.patch('/auth/password', protectAdmin, updateAdminPassword);

// Stats
router.get('/stats', protectAdmin, getOverviewStats);

// Users
router.get('/users', protectAdmin, listUsers);
router.post('/users', protectAdmin, adminCreateUser);
router.get('/users/:id', protectAdmin, getUserDetail);
router.patch('/users/:id/suspend', protectAdmin, suspendUser);
router.patch('/users/:id/activate', protectAdmin, activateUser);
router.delete('/users/:id', protectAdmin, deleteUser);

// Companies
router.get('/companies', protectAdmin, listCompanies);
router.post('/companies', protectAdmin, adminCreateCompany);
router.get('/companies/:id', protectAdmin, getCompanyDetail);
router.patch('/companies/:id/verify', protectAdmin, verifyCompany);
router.patch('/companies/:id/suspend', protectAdmin, suspendCompany);
router.patch('/companies/:id/activate', protectAdmin, activateCompany);
router.delete('/companies/:id', protectAdmin, deleteCompany);

// Jobs
router.get('/jobs', protectAdmin, listAllJobs);
router.get('/jobs/:id', protectAdmin, getJobDetail);
router.patch('/jobs/:id/close', protectAdmin, forceCloseJob);
router.patch('/jobs/:id/featured', protectAdmin, toggleFeaturedJob);
router.delete('/jobs/:id', protectAdmin, adminDeleteJob);

// Pricing — public read, protected write
router.get('/plans/public', getPublicPlans);
router.get('/plans', protectAdmin, listPlanConfigs);
router.post('/plans', protectAdmin, createPlanConfig);
router.put('/plans/:id', protectAdmin, updatePlanConfig);
router.delete('/plans/:id', protectAdmin, deletePlanConfig);


export default router;
