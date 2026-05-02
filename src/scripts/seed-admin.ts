import 'dotenv/config';
import mongoose from 'mongoose';
import { Admin } from '../models/Admin';
import { PlanConfig } from '../models/PlanConfig';
import { PLAN_LIMITS } from '../models/Company';

async function seed() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is not set in environment');

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  // Create super admin if none exists
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@internse.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeMe123!';

  const existing = await Admin.findOne({ email: adminEmail });
  if (!existing) {
    await Admin.create({ name: 'Super Admin', email: adminEmail, password: adminPassword, role: 'super_admin' });
    console.log(`Admin created: ${adminEmail}`);
  } else {
    console.log(`Admin already exists: ${adminEmail}`);
  }

  // Seed PlanConfig from PLAN_LIMITS defaults
  const plans = [
    {
      planType: 'starter',
      displayName: 'Starter',
      monthlyPrice: 0,
      annualPrice: 0,
      credits: PLAN_LIMITS.starter.credits,
      resetsMonthly: PLAN_LIMITS.starter.resetsMonthly,
      teamSeats: PLAN_LIMITS.starter.teamSeats,
      featuredListings: PLAN_LIMITS.starter.featuredListings,
      features: ['2 lifetime job posts', 'Basic company profile', 'Applicant tracking'],
    },
    {
      planType: 'growth',
      displayName: 'Growth',
      monthlyPrice: 4900,
      annualPrice: 49900,
      credits: PLAN_LIMITS.growth.credits,
      resetsMonthly: PLAN_LIMITS.growth.resetsMonthly,
      teamSeats: PLAN_LIMITS.growth.teamSeats,
      featuredListings: PLAN_LIMITS.growth.featuredListings,
      features: ['15 job posts/month', 'Up to 5 team seats', '2 featured listings/month', 'Priority support'],
    },
    {
      planType: 'enterprise',
      displayName: 'Enterprise',
      monthlyPrice: 19900,
      annualPrice: 199900,
      credits: PLAN_LIMITS.enterprise.credits,
      resetsMonthly: PLAN_LIMITS.enterprise.resetsMonthly,
      teamSeats: PLAN_LIMITS.enterprise.teamSeats,
      featuredListings: PLAN_LIMITS.enterprise.featuredListings,
      features: ['Unlimited job posts', 'Unlimited team seats', 'Unlimited featured listings', 'Dedicated account manager'],
    },
  ];

  for (const plan of plans) {
    await PlanConfig.findOneAndUpdate({ planType: plan.planType }, plan, { upsert: true, new: true });
    console.log(`PlanConfig seeded: ${plan.planType}`);
  }

  await mongoose.disconnect();
  console.log('Seed complete');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
