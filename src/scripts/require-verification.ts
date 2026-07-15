import 'dotenv/config';
import mongoose from 'mongoose';
import { Company } from '../models/Company';

const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(process.env.MONGO_URI!);
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

const requireVerificationForAll = async (): Promise<void> => {
  try {
    console.log('Starting migration: Require verification for all employers...\n');

    // Get count of companies before update
    const totalCompanies = await Company.countDocuments();
    console.log(`Total companies: ${totalCompanies}`);

    // Update all companies to require verification
    const result = await Company.updateMany(
      {},
      {
        $set: {
          canPostJobs: false,
          'businessVerification.status': 'not_submitted',
        },
      }
    );

    console.log(`Updated companies: ${result.modifiedCount}`);
    console.log(`Matched companies: ${result.matchedCount}`);

    // Get stats on verification status
    const stats = await Company.aggregate([
      {
        $group: {
          _id: '$businessVerification.status',
          count: { $sum: 1 },
        },
      },
    ]);

    console.log('\nVerification status breakdown:');
    stats.forEach((stat) => {
      console.log(`  ${stat._id || 'not_set'}: ${stat.count}`);
    });

    console.log('\n✅ Migration complete!');
    console.log('All employers now require business verification before posting jobs.');
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Database connection closed');
  }
};

connectDB().then(() => requireVerificationForAll());
