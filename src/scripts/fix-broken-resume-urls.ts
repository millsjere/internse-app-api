import 'dotenv/config';
import axios from 'axios';
import mongoose from 'mongoose';
import { Application } from '../models/Application';
import { User } from '../models/User';

const isLive = process.argv.includes('--live');
const isApply = process.argv.includes('--apply');
const CONCURRENCY = 20;

const connectDB = async (): Promise<void> => {
  const uri = isLive ? process.env.MONGO_URI_LIVE : process.env.MONGO_URI;
  try {
    await mongoose.connect(uri!);
    console.log(`MongoDB connected (${isLive ? 'LIVE' : 'dev'}, ${isApply ? 'APPLY' : 'DRY RUN'})`);
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Matches raw-upload Cloudinary resume URLs with a bogus extension appended
// after the real (extension-less) public_id, e.g.
// .../raw/upload/v123/resumes/<publicId>.pdf -> .../raw/upload/v123/resumes/<publicId>
const BROKEN_RAW_RESUME = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/raw\/upload\/(?:v\d+\/)?resumes\/[^./]+)\.[a-zA-Z0-9]+$/;

const urlResolves = async (url: string): Promise<boolean> => {
  try {
    const res = await axios.head(url, { validateStatus: () => true });
    return res.status === 200;
  } catch {
    return false;
  }
};

const runBatched = async <T>(items: T[], worker: (item: T) => Promise<void>): Promise<void> => {
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const batch = items.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(worker));
  }
};

const fixBrokenResumeUrls = async (): Promise<void> => {
  let fixed = 0;
  let skipped = 0;

  try {
    console.log('Scanning applications for broken resume URLs...\n');
    const applications = await Application.find({ resume: { $regex: BROKEN_RAW_RESUME } });
    console.log(`Found ${applications.length} matching applications`);
    await runBatched(applications, async (app) => {
      const match = app.resume!.match(BROKEN_RAW_RESUME);
      const fixedUrl = match![1];
      if (await urlResolves(fixedUrl)) {
        if (isApply) {
          app.resume = fixedUrl;
          await app.save();
        }
        fixed++;
      } else {
        skipped++;
        console.log(`  [application ${app._id}] SKIPPED — fixed URL did not resolve: ${fixedUrl}`);
      }
    });

    console.log('\nScanning user profile resumes for broken resume URLs...\n');
    const users = await User.find({ resume: { $regex: BROKEN_RAW_RESUME } });
    console.log(`Found ${users.length} matching users`);
    await runBatched(users, async (user) => {
      const match = user.resume!.match(BROKEN_RAW_RESUME);
      const fixedUrl = match![1];
      if (await urlResolves(fixedUrl)) {
        if (isApply) {
          user.resume = fixedUrl;
          await user.save();
        }
        fixed++;
      } else {
        skipped++;
        console.log(`  [user ${user._id}] SKIPPED — fixed URL did not resolve: ${fixedUrl}`);
      }
    });

    console.log(`\nDone. Checked: ${applications.length + users.length}, ${isApply ? 'fixed' : 'would fix'}: ${fixed}, skipped: ${skipped}`);
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Database connection closed');
  }
};

connectDB().then(() => fixBrokenResumeUrls());
