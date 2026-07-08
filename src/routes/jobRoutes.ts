import { Router } from 'express';
import { protect, protectCompany } from '../middleware/auth';
import { upload } from '../middleware/upload';
import {
  getAllJobs,
  getJobBySlug,
  trackJobView,
  getCompanyJobs,
  createJob,
  updateJob,
  publishJob,
  closeJob,
  archiveJob,
  deleteJob,
  applyToJob,
  getUserApplications,
  getJobApplications,
  toggleFavourite,
  getUserFavourites,
  updateApplicationStatus,
} from '../controllers/jobController';

const router = Router();

// Public job routes
router.get('/', getAllJobs);
router.get('/:slug', getJobBySlug);
router.post('/:slug/view', trackJobView);

// User job routes (protected)
router.post('/:jobId/apply', protect, upload.single('resume'), applyToJob);
router.post('/:jobId/favourite/toggle', protect, toggleFavourite);
router.get('/user/applications', protect, getUserApplications);
router.get('/user/favourites', protect, getUserFavourites);

// Company job routes (protected)
router.get('/company/jobs', protectCompany, getCompanyJobs);
router.post('/company/create', protectCompany, createJob);
router.put('/:jobId', protectCompany, updateJob);
router.post('/:jobId/publish', protectCompany, publishJob);
router.post('/:jobId/close', protectCompany, closeJob);
router.post('/:jobId/archive', protectCompany, archiveJob);
router.delete('/:jobId', protectCompany, deleteJob);
router.get('/:jobId/applications', protectCompany, getJobApplications);
router.patch('/company/applications/:applicationId/status', protectCompany, updateApplicationStatus);

export default router;
