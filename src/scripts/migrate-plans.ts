#!/usr/bin/env node

/**
 * Migration: Assign all companies to Starter plan
 *
 * - Sets planType = 'starter' for every company
 * - Sets credits = 2 (starter lifetime cap)
 * - Preserves existing 'used' count if it was already tracking usage
 * - Sets billing period to now → start of next month
 *
 * Usage:
 *   npm run migrate:plans
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { Company, PLAN_LIMITS } from '../models/Company';

const MONGO_URI = process.env.MONGO_URI || process.env.DATABASE_URL || '';

async function migrate() {
  if (!MONGO_URI) {
    console.error('❌  MONGO_URI is not set. Check your .env file.');
    process.exit(1);
  }

  console.log('🔌  Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('✅  Connected.\n');

  const now = new Date();
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  // Find all companies not yet on the new plan model
  const companies = await Company.find({});

  console.log(`📋  Found ${companies.length} companies to migrate.\n`);

  let migrated = 0;
  let skipped = 0;

  for (const company of companies) {
    const plan = company.paymentPlan as any;
    const alreadyMigrated =
      plan.planType === 'starter' ||
      plan.planType === 'growth' ||
      plan.planType === 'enterprise';

    if (alreadyMigrated) {
      console.log(`⏭️   Skipping ${company.companyName} (already on ${plan.planType})`);
      skipped++;
      continue;
    }

    // Assign starter plan
    company.paymentPlan = {
      planType: 'starter',
      credits: PLAN_LIMITS.starter.credits,   // 2
      used: plan.used ?? 0,                    // preserve existing usage
      billingCycle: 'monthly',
      currentPeriodStart: now,
      currentPeriodEnd: nextMonthStart,
    } as any;

    await company.save();
    console.log(`✅  Migrated: ${company.companyName} → starter (credits: ${PLAN_LIMITS.starter.credits}, used: ${plan.used ?? 0})`);
    migrated++;
  }

  console.log(`\n🎉  Migration complete.`);
  console.log(`    Migrated: ${migrated}`);
  console.log(`    Skipped:  ${skipped}`);
  console.log(`    Total:    ${companies.length}`);

  await mongoose.disconnect();
  process.exit(0);
}

migrate().catch((err) => {
  console.error('❌  Migration failed:', err);
  process.exit(1);
});
