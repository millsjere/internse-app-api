import { Request, Response } from 'express';
import { Job } from '../models/Job';
import { Company, PLAN_LIMITS } from '../models/Company';
import { Application } from '../models/Application';
import { Favourite } from '../models/Favourite';
import { CompanyNotification } from '../models/CompanyNotification';
import { UserNotification } from '../models/UserNotification';
import { User } from '../models/User';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { createSlug } from '../utils/validators';
import { ResendService } from '../services';

// Get all published jobs with pagination and filters
export const getAllJobs = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { page = 1, limit = 10, industry, jobType, level, search } = req.query;
  const pageNum = parseInt(page as string) || 1;
  const limitNum = parseInt(limit as string) || 10;
  const skip = (pageNum - 1) * limitNum;

  const filter: any = { status: 'published' };
  if (industry) filter.industry = industry;
  if (jobType) filter.jobType = jobType;
  if (level) filter.level = level;
  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
  }

  const jobs = await Job.find(filter)
    .populate('company', 'companyName logo industry')
    .skip(skip)
    .limit(limitNum)
    .sort({ createdAt: -1 });

  const total = await Job.countDocuments(filter);

  res.json({
    success: true,
    data: {
      jobs,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      hasMore: pageNum < Math.ceil(total / limitNum),
    },
  });
});

// Get single job by slug or _id
export const getJobBySlug = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { slug } = req.params;

  let job = await Job.findOne({ slug }).populate('company');

  if (!job && /^[a-f\d]{24}$/i.test(slug)) {
    job = await Job.findById(slug).populate('company');
  }

  if (!job) {
    throw new AppError('Job not found', 404);
  }

  res.json({ success: true, data: job });
});

// Increment view count — called once by the client when a job page is rendered
export const trackJobView = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { slug } = req.params;

  let job = await Job.findOneAndUpdate({ slug }, { $inc: { views: 1 } }, { new: false });

  if (!job && /^[a-f\d]{24}$/i.test(slug)) {
    await Job.findByIdAndUpdate(slug, { $inc: { views: 1 } });
  }

  res.json({ success: true });
});

// Get company's jobs
export const getCompanyJobs = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError('Unauthorized', 401);
  }

  const jobs = await Job.find({ company: req.user._id }).sort({ createdAt: -1 });

  res.json({ success: true, data: jobs });
});

// Create job posting
export const createJob = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError('Unauthorized', 401);
  }

  const { title, description, requirements, responsibilities, benefits, tags, industry, jobType, level, salary, location, remote, questions } =
    req.body;

  if (!title || !description || !industry) {
    throw new AppError('Title, description, and industry are required', 400);
  }

  const slug = createSlug(`${title}-${Date.now()}`);

  const job = await Job.create({
    company: req.user._id,
    title,
    description,
    requirements: requirements || [],
    responsibilities: responsibilities || [],
    benefits: benefits || [],
    tags: tags || [],
    industry,
    jobType: jobType || 'full-time',
    level: level || 'entry',
    salary: salary || undefined,
    location,
    remote: remote || false,
    questions: questions || [],
    slug,
    status: 'drafted',
  });

  res.status(201).json({ success: true, data: job });
});

// Update job
export const updateJob = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError('Unauthorized', 401);
  }

  const { jobId } = req.params;

  const job = await Job.findById(jobId);
  if (!job) {
    throw new AppError('Job not found', 404);
  }

  if (job.company.toString() !== req.user._id) {
    throw new AppError('Not authorized to update this job', 403);
  }

  const updatedJob = await Job.findByIdAndUpdate(jobId, req.body, { new: true });

  res.json({ success: true, data: updatedJob });
});

// Publish job
export const publishJob = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError('Unauthorized', 401);
  }

  const { jobId } = req.params;

  const job = await Job.findById(jobId);
  if (!job) {
    throw new AppError('Job not found', 404);
  }

  if (job.company.toString() !== req.user._id) {
    throw new AppError('Not authorized to publish this job', 403);
  }

  // Deduct a credit only when publishing from drafted for the first time.
  // Re-publishing a closed job does not cost another credit.
  if (job.status === 'drafted') {
    const company = await Company.findById(req.user._id);
    if (!company) {
      throw new AppError('Company not found', 404);
    }

    const plan = company.paymentPlan;
    const planLimits = PLAN_LIMITS[plan.planType as keyof typeof PLAN_LIMITS];

    if (planLimits.credits !== -1) {
      // Reset monthly credits if the billing period has expired
      if (planLimits.resetsMonthly && plan.currentPeriodEnd && new Date() > plan.currentPeriodEnd) {
        plan.used = 0;
        plan.credits = planLimits.credits;
        plan.currentPeriodStart = new Date();
        plan.currentPeriodEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
      }

      const remaining = plan.credits - plan.used;
      if (remaining <= 0) {
        throw new AppError(
          'You have used all your job post credits. Upgrade your plan to post more jobs.',
          403
        );
      }

      plan.used += 1;
      await company.save();
    }
  }

  job.status = 'published';
  await job.save();

  res.json({ success: true, data: job, message: 'Job published successfully' });
});

// Close job
export const closeJob = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError('Unauthorized', 401);
  }

  const { jobId } = req.params;

  const job = await Job.findById(jobId);
  if (!job) {
    throw new AppError('Job not found', 404);
  }

  if (job.company.toString() !== req.user._id) {
    throw new AppError('Not authorized to close this job', 403);
  }

  job.status = 'closed';
  await job.save();

  res.json({ success: true, data: job, message: 'Job closed successfully' });
});

// Delete job (drafts and closed only — published jobs must be archived)
export const deleteJob = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError('Unauthorized', 401);
  }

  const { jobId } = req.params;

  const job = await Job.findById(jobId);
  if (!job) {
    throw new AppError('Job not found', 404);
  }

  if (job.company.toString() !== req.user._id) {
    throw new AppError('Not authorized to delete this job', 403);
  }

  if (job.status === 'published') {
    throw new AppError('Published jobs cannot be deleted. Archive the job instead.', 400);
  }

  await Job.findByIdAndDelete(jobId);

  res.json({ success: true, message: 'Job deleted successfully' });
});

// Archive job (published jobs only)
export const archiveJob = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError('Unauthorized', 401);
  }

  const { jobId } = req.params;

  const job = await Job.findById(jobId);
  if (!job) {
    throw new AppError('Job not found', 404);
  }

  if (job.company.toString() !== req.user._id) {
    throw new AppError('Not authorized to archive this job', 403);
  }

  job.status = 'archived';
  await job.save();

  res.json({ success: true, data: job, message: 'Job archived successfully' });
});

// Apply to job
export const applyToJob = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError('Unauthorized', 401);
  }

  const { jobId } = req.params;
  const { resume, coverLetter, answers } = req.body;

  const job = await Job.findById(jobId).populate<{ company: { _id: string; companyName: string; email: string } }>('company', 'companyName email');
  if (!job) {
    throw new AppError('Job not found', 404);
  }

  if (job.status !== 'published') {
    throw new AppError('Job is no longer available', 400);
  }

  const existingApplication = await Application.findOne({
    job: jobId,
    applicant: req.user._id,
  });

  if (existingApplication) {
    throw new AppError('You have already applied to this job', 409);
  }

  // Validate required questions are answered
  const submittedAnswers: Array<{ questionId: string; question: string; answer: string }> = answers || [];
  for (const q of job.questions) {
    if (q.required) {
      const found = submittedAnswers.find((a) => a.questionId === q._id?.toString());
      if (!found || !found.answer.trim()) {
        throw new AppError(`Answer required: "${q.question}"`, 400);
      }
    }
  }

  // Build answer snapshots (capture question text at time of apply)
  const answersWithSnapshot = job.questions.map((q) => {
    const submitted = submittedAnswers.find((a) => a.questionId === q._id?.toString());
    return {
      questionId: q._id?.toString() ?? '',
      question: q.question,
      answer: submitted?.answer ?? '',
    };
  });

  const application = await Application.create({
    job: jobId,
    applicant: req.user._id,
    resume,
    coverLetter,
    answers: answersWithSnapshot,
  });

  // Increment application count
  job.applicationCount += 1;
  await job.save();

  // Create notification for company
  const company = job.company;
  await CompanyNotification.create({
    company: company._id,
    type: 'new_application',
    title: 'New Job Application',
    message: `New application received for ${job.title}`,
    relatedApplication: application._id,
    link: `/employer/jobs/${jobId}/applicants`,
  });

  // Create notification for applicant
  await UserNotification.create({
    user: req.user._id,
    type: 'application_update',
    title: 'Application Submitted',
    message: `Your application for ${job.title} at ${company.companyName} has been submitted successfully.`,
    link: '/applications',
  });

  // Send confirmation email to applicant (non-fatal)
  const companyName = company.companyName ?? 'the company';
  User.findById(req.user._id).select('firstname').then((u) => {
    ResendService.sendApplicationConfirmation(
      req.user!.email,
      u?.firstname ?? 'there',
      job.title,
      companyName
    );
  }).catch(() => {/* ignore */});

  res.status(201).json({
    success: true,
    data: application,
    message: 'Application submitted successfully',
  });
});

// Get user's applications
export const getUserApplications = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AppError('Unauthorized', 401);
    }

    const applications = await Application.find({ applicant: req.user._id })
      .populate({
        path: 'job',
        populate: { path: 'company', select: 'companyName logo' },
      })
      .sort({ createdAt: -1 });

    res.json({ success: true, data: applications });
  }
);

// Get job applications (for employer)
export const getJobApplications = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AppError('Unauthorized', 401);
    }

    const { jobId } = req.params;

    const job = await Job.findById(jobId);
    if (!job) {
      throw new AppError('Job not found', 404);
    }

    if (job.company.toString() !== req.user._id) {
      throw new AppError('Not authorized to view applications', 403);
    }

    const applications = await Application.find({ job: jobId })
      .populate('applicant', 'firstname lastname email phone profilePhoto')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: applications });
  }
);

// Toggle favourite
export const toggleFavourite = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new AppError('Unauthorized', 401);
  }

  const { jobId } = req.params;

  const job = await Job.findById(jobId);
  if (!job) {
    throw new AppError('Job not found', 404);
  }

  const existingFavourite = await Favourite.findOne({
    user: req.user._id,
    job: jobId,
  });

  if (existingFavourite) {
    await Favourite.findByIdAndDelete(existingFavourite._id);
    res.json({ success: true, data: { isFavourite: false }, message: 'Removed from favourites' });
  } else {
    await Favourite.create({
      user: req.user._id,
      job: jobId,
    });
    res.json({ success: true, data: { isFavourite: true }, message: 'Added to favourites' });
  }
});

// Get user's favourites
export const getUserFavourites = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AppError('Unauthorized', 401);
    }

    const favourites = await Favourite.find({ user: req.user._id })
      .populate({
        path: 'job',
        populate: { path: 'company', select: 'companyName logo' },
      })
      .sort({ createdAt: -1 });

    res.json({ success: true, data: favourites });
  }
);

// Update application status (company only) — also notifies the applicant
export const updateApplicationStatus = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AppError('Unauthorized', 401);
    }

    const { applicationId } = req.params;
    const { status } = req.body as { status: 'reviewing' | 'accepted' | 'rejected' };

    if (!['reviewing', 'accepted', 'rejected'].includes(status)) {
      throw new AppError('Invalid status value', 400);
    }

    const application = await Application.findById(applicationId)
      .populate<{ job: { _id: string; title: string; company: string } }>('job', 'title company');

    if (!application) {
      throw new AppError('Application not found', 404);
    }

    // Verify this company owns the job
    if (application.job.company.toString() !== req.user._id) {
      throw new AppError('Not authorized', 403);
    }

    application.status = status;
    await application.save();

    // Notify the applicant
    const statusMessages: Record<string, string> = {
      reviewing: `Your application for ${application.job.title} is being reviewed.`,
      accepted:  `Congratulations! Your application for ${application.job.title} has been accepted.`,
      rejected:  `Your application for ${application.job.title} was not successful this time.`,
    };
    const statusTitles: Record<string, string> = {
      reviewing: 'Application Under Review',
      accepted:  'Application Accepted 🎉',
      rejected:  'Application Update',
    };

    await UserNotification.create({
      user: application.applicant,
      type: 'application_update',
      title: statusTitles[status],
      message: statusMessages[status],
      link: '/applications',
    });

    res.json({ success: true, data: application, message: 'Status updated' });
  }
);
