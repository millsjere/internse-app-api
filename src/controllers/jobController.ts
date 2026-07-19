import { Request, Response } from 'express';
import axios from 'axios';
import { Job } from '../models/Job';
import { Company, PLAN_LIMITS } from '../models/Company';
import { Application } from '../models/Application';
import { Favourite } from '../models/Favourite';
import { CompanyNotification } from '../models/CompanyNotification';
import { UserNotification } from '../models/UserNotification';
import { User } from '../models/User';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { createSlug } from '../utils/validators';
import { ResendService, CloudinaryService } from '../services';

const QUESTION_TYPES = ['text', 'paragraph', 'single_choice', 'multi_choice', 'dropdown', 'date'];
const MAX_LENGTH_UNITS = ['words', 'characters'];

// Validates and normalizes a raw `questions` payload from a create/update job request.
// Throws AppError on malformed input so bad data never reaches the Job schema.
function validateQuestions(questions: unknown): Array<{ question: string; required: boolean; type: string; options: string[]; maxLength?: number; maxLengthUnit?: string }> {
  if (!Array.isArray(questions)) {
    throw new AppError('Questions must be an array', 400);
  }

  return questions.map((q) => {
    if (!q || typeof q.question !== 'string' || !q.question.trim()) {
      throw new AppError('Each question must have non-empty text', 400);
    }

    const type = q.type || 'text';
    if (!QUESTION_TYPES.includes(type)) {
      throw new AppError(`Invalid question type: ${type}`, 400);
    }

    let options: string[] = [];
    if (type === 'single_choice' || type === 'multi_choice' || type === 'dropdown') {
      options = Array.isArray(q.options) ? q.options.map((o: unknown) => String(o).trim()).filter(Boolean) : [];
      if (options.length < 2) {
        throw new AppError(`${type} questions require at least 2 options`, 400);
      }
    }

    let maxLength: number | undefined;
    let maxLengthUnit: string | undefined;
    if ((type === 'text' || type === 'paragraph') && q.maxLength != null && q.maxLength !== '') {
      maxLength = Number(q.maxLength);
      if (!Number.isFinite(maxLength) || maxLength <= 0 || !Number.isInteger(maxLength)) {
        throw new AppError('Max length must be a positive whole number', 400);
      }
      maxLengthUnit = MAX_LENGTH_UNITS.includes(q.maxLengthUnit) ? q.maxLengthUnit : 'words';
    }

    return {
      question: q.question.trim(),
      required: Boolean(q.required),
      type,
      options,
      ...(maxLength != null ? { maxLength, maxLengthUnit } : {}),
    };
  });
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// Get all published jobs with pagination and filters
export const getAllJobs = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { page = 1, limit = 10, industry, jobType, level, category, search } = req.query;
  const pageNum = parseInt(page as string) || 1;
  const limitNum = parseInt(limit as string) || 10;
  const skip = (pageNum - 1) * limitNum;

  const filter: any = { status: 'published' };
  if (industry) filter.industry = industry;
  // Support comma-separated values for OR filtering (e.g. "full-time,contract")
  if (jobType) {
    const types = (jobType as string).split(',').map(t => t.trim()).filter(Boolean);
    filter.jobType = types.length === 1 ? types[0] : { $in: types };
  }
  if (category) {
    const categories = (category as string).split(',').map(c => c.trim()).filter(Boolean);
    filter.category = categories.length === 1 ? categories[0] : { $in: categories };
  }
  if (level) {
    const levels = (level as string).split(',').map(l => l.trim()).filter(Boolean);
    filter.level = levels.length === 1 ? levels[0] : { $in: levels };
  }
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

  // Check company verification status
  const company = await Company.findById(req.user._id);
  if (!company) {
    throw new AppError('Company not found', 404);
  }

  if (company.businessVerification.status !== 'approved') {
    throw new AppError(
      company.businessVerification.status === 'pending'
        ? 'Your company is pending verification. Please wait for admin approval before posting jobs.'
        : company.businessVerification.status === 'rejected'
        ? `Your company verification was rejected: ${company.businessVerification.rejectionReason || 'Please contact support.'}`
        : 'Please submit your business registration for verification before posting jobs.',
      403
    );
  }

  if (!company.canPostJobs) {
    throw new AppError('You are not authorized to post jobs. Please complete verification.', 403);
  }

  const { title, description, requirements, responsibilities, benefits, tags, industry, jobType, category, level, salary, location, remote, questions } =
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
    category: category || 'internship',
    level: level || 'entry',
    salary: salary || undefined,
    location,
    remote: remote || false,
    questions: questions ? validateQuestions(questions) : [],
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

  const updates = { ...req.body };
  if (updates.questions) {
    updates.questions = validateQuestions(updates.questions);
  }

  const updatedJob = await Job.findByIdAndUpdate(jobId, updates, { new: true });

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

  // Check company verification status
  const company = await Company.findById(req.user._id);
  if (!company) {
    throw new AppError('Company not found', 404);
  }

  if (company.businessVerification.status !== 'approved') {
    throw new AppError(
      company.businessVerification.status === 'pending'
        ? 'Your company is pending verification. Please wait for admin approval before publishing jobs.'
        : company.businessVerification.status === 'rejected'
        ? `Your company verification was rejected: ${company.businessVerification.rejectionReason || 'Please contact support.'}`
        : 'Please submit your business registration for verification before publishing jobs.',
      403
    );
  }

  if (!company.canPostJobs) {
    throw new AppError('You are not authorized to publish jobs. Please complete verification.', 403);
  }

  // Deduct a credit only when publishing from drafted for the first time.
  // Re-publishing a closed job does not cost another credit.
  if (job.status === 'drafted') {
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
  const { coverLetter } = req.body;

  let submittedAnswers: Array<{ questionId: string; question: string; answer: string | string[] }> = [];
  if (req.body.answers) {
    try {
      submittedAnswers = typeof req.body.answers === 'string' ? JSON.parse(req.body.answers) : req.body.answers;
    } catch {
      submittedAnswers = [];
    }
  }

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

  // Validate answers: required questions must be answered, and choice answers must match defined options
  for (const q of job.questions) {
    const found = submittedAnswers.find((a) => a.questionId === q._id?.toString());
    const type = q.type || 'text';

    if (type === 'multi_choice') {
      const selected = Array.isArray(found?.answer) ? found!.answer : [];
      if (q.required && selected.length === 0) {
        throw new AppError(`Answer required: "${q.question}"`, 400);
      }
      if (selected.some((a) => !(q.options ?? []).includes(a))) {
        throw new AppError(`Invalid option submitted for: "${q.question}"`, 400);
      }
    } else if (type === 'single_choice') {
      const selected = typeof found?.answer === 'string' ? found.answer : '';
      if (q.required && !selected) {
        throw new AppError(`Answer required: "${q.question}"`, 400);
      }
      if (selected && !(q.options ?? []).includes(selected)) {
        throw new AppError(`Invalid option submitted for: "${q.question}"`, 400);
      }
    } else {
      const text = typeof found?.answer === 'string' ? found.answer : '';
      if (q.required && !text.trim()) {
        throw new AppError(`Answer required: "${q.question}"`, 400);
      }
      if (q.maxLength && text.trim()) {
        const count = q.maxLengthUnit === 'characters' ? text.length : countWords(text);
        if (count > q.maxLength) {
          throw new AppError(`"${q.question}" exceeds the ${q.maxLength}-${q.maxLengthUnit === 'characters' ? 'character' : 'word'} limit`, 400);
        }
      }
    }
  }

  // resumeUrl is used when the applicant is reusing their existing profile resume;
  // req.file (via multer) is used when they upload a new document for this application.
  // Resolved last, after all validation, so we don't burn a Cloudinary upload on a request
  // that's about to be rejected anyway (duplicate application, closed job, missing answers).
  let resume: string | undefined = req.body.resumeUrl;
  if (req.file) {
    resume = await CloudinaryService.uploadFile(req.file, 'resumes', req.file.originalname);
  }

  if (!resume) {
    throw new AppError('Resume is required', 400);
  }

  // Build answer snapshots (capture question text, type, and options at time of apply)
  const answersWithSnapshot = job.questions.map((q) => {
    const submitted = submittedAnswers.find((a) => a.questionId === q._id?.toString());
    const type = q.type || 'text';
    const answer: string | string[] = type === 'multi_choice'
      ? (Array.isArray(submitted?.answer) ? submitted!.answer : [])
      : (typeof submitted?.answer === 'string' ? submitted.answer : '');

    return {
      questionId: q._id?.toString() ?? '',
      question: q.question,
      type,
      options: q.options,
      answer,
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

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Builds the Mongo filter for an employer's job applications from query params.
// `includeStatus: false` omits the status clause, used for computing tab counts
// that should reflect search/date/answer filters but not the currently selected tab.
async function buildApplicationFilter(
  jobId: unknown,
  query: Record<string, unknown>,
  options: { includeStatus?: boolean } = {}
): Promise<Record<string, unknown>> {
  const filter: Record<string, unknown> = { job: jobId };

  if (options.includeStatus !== false) {
    const status = query.status as string | undefined;
    if (status && status !== 'all') {
      filter.status = status;
    }
  }

  const search = (query.search as string | undefined)?.trim();
  if (search) {
    const tokens = search.split(/\s+/).filter(Boolean).slice(0, 5);
    const matchingUsers = await User.find({
      $and: tokens.map((token) => ({
        $or: [
          { firstname: { $regex: escapeRegex(token), $options: 'i' } },
          { lastname: { $regex: escapeRegex(token), $options: 'i' } },
          { email: { $regex: escapeRegex(token), $options: 'i' } },
        ],
      })),
    }).select('_id');
    filter.applicant = { $in: matchingUsers.map((u) => u._id) };
  }

  const dateFrom = query.dateFrom as string | undefined;
  const dateTo = query.dateTo as string | undefined;
  if (dateFrom || dateTo) {
    const appliedAt: Record<string, Date> = {};
    if (dateFrom) appliedAt.$gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      appliedAt.$lte = end;
    }
    filter.appliedAt = appliedAt;
  }

  // `questions` is a JSON-encoded array of {questionId, answer} pairs — an applicant must
  // match ALL of them (AND) to be included, letting employers narrow by multiple questions at once.
  const questionsRaw = query.questions as string | undefined;
  if (questionsRaw) {
    let pairs: unknown;
    try {
      pairs = JSON.parse(questionsRaw);
    } catch {
      pairs = [];
    }
    if (Array.isArray(pairs)) {
      const clauses = pairs
        .filter(
          (p): p is { questionId: string; answer: string } =>
            !!p && typeof p.questionId === 'string' && typeof p.answer === 'string' && p.questionId && p.answer
        )
        .slice(0, 10)
        .map((p) => ({ answers: { $elemMatch: { questionId: p.questionId, answer: { $in: [p.answer] } } } }));
      if (clauses.length > 0) {
        filter.$and = clauses;
      }
    }
  }

  return filter;
}

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

    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
    const status = req.query.status as string | undefined;

    const baseFilter = await buildApplicationFilter(job._id, req.query as Record<string, unknown>, { includeStatus: false });
    const filter: Record<string, unknown> = { ...baseFilter };
    if (status && status !== 'all') {
      filter.status = status;
    }

    const [applications, total, statusCounts] = await Promise.all([
      Application.find(filter)
        .populate('applicant', 'firstname lastname email phone profilePhoto')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Application.countDocuments(filter),
      Application.aggregate([
        { $match: baseFilter },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ]);

    const counts = { all: 0, pending: 0, reviewing: 0, accepted: 0, rejected: 0 };
    statusCounts.forEach((s: { _id: string; count: number }) => {
      counts.all += s.count;
      if (s._id in counts) counts[s._id as keyof typeof counts] = s.count;
    });

    res.json({
      success: true,
      data: applications,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
      counts,
      job: { _id: job._id, title: job.title, questions: job.questions },
    });
  }
);

// Export job applications as CSV (for employer)
export const exportJobApplications = asyncHandler(
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

    const filter = await buildApplicationFilter(job._id, req.query as Record<string, unknown>);

    const page = req.query.page ? Math.max(1, parseInt(req.query.page as string, 10) || 1) : undefined;
    const limit = req.query.limit ? Math.min(1000, Math.max(1, parseInt(req.query.limit as string, 10) || 1000)) : undefined;

    let applicationsQuery = Application.find(filter)
      .populate('applicant', 'firstname lastname email phone')
      .sort({ createdAt: -1 });
    if (page && limit) {
      applicationsQuery = applicationsQuery.skip((page - 1) * limit).limit(limit);
    }
    const applications = await applicationsQuery;

    const escapeCsv = (value: unknown): string => {
      const str = value === null || value === undefined ? '' : String(value);
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };

    const questionColumns = job.questions.map((q) => ({ id: String(q._id), label: q.question }));

    const headers = [
      'Name', 'Email', 'Phone', 'Status', 'Applied Date', 'Resume', 'Cover Letter',
      ...questionColumns.map((q) => q.label),
    ];

    const rows = applications.map((app) => {
      const applicant = app.applicant as unknown as { firstname?: string; lastname?: string; email?: string; phone?: string } | undefined;
      const answerByQuestionId = new Map(
        (app.answers || []).map((a) => [a.questionId, Array.isArray(a.answer) ? a.answer.join('; ') : a.answer])
      );
      return [
        applicant ? `${applicant.firstname ?? ''} ${applicant.lastname ?? ''}`.trim() : '',
        applicant?.email ?? '',
        applicant?.phone ?? '',
        app.status,
        app.appliedAt ? new Date(app.appliedAt).toISOString() : '',
        app.resume ?? '',
        app.coverLetter ?? '',
        ...questionColumns.map((q) => answerByQuestionId.get(q.id) ?? ''),
      ]
        .map(escapeCsv)
        .join(',');
    });

    const csv = [headers.map(escapeCsv).join(','), ...rows].join('\n');
    const filename = `applicants-${createSlug(job.title)}-${Date.now()}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(`﻿${csv}`);
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

// Download applicant resume (company only) — proxied through the backend so we
// control the Content-Disposition filename instead of relying on the raw Cloudinary URL
export const downloadApplicationResume = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AppError('Unauthorized', 401);
    }

    const { applicationId } = req.params;

    const application = await Application.findById(applicationId)
      .populate<{ job: { company: string } }>('job', 'company')
      .populate<{ applicant: { firstname: string; lastname: string } }>('applicant', 'firstname lastname');

    if (!application) {
      throw new AppError('Application not found', 404);
    }

    if ((application.job as unknown as { company: string }).company.toString() !== req.user._id) {
      throw new AppError('Not authorized', 403);
    }

    if (!application.resume) {
      throw new AppError('No resume on file for this application', 404);
    }

    const applicant = application.applicant as unknown as { firstname?: string; lastname?: string };
    const safeName = `${applicant?.firstname ?? ''}_${applicant?.lastname ?? ''}`
      .trim()
      .replace(/^_+|_+$/g, '')
      .replace(/[^a-zA-Z0-9_-]/g, '') || 'Applicant';

    const upstream = await axios.get(application.resume, { responseType: 'stream' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}-Resume.pdf"`);
    upstream.data.pipe(res);
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
