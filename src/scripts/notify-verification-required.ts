import 'dotenv/config';
import mongoose from 'mongoose';
import { Company } from '../models/Company';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@internseapp.com';

const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(process.env.MONGO_URI!);
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

const sendVerificationRequiredEmail = async (email: string, companyName: string): Promise<void> => {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #fef3c7; border-radius: 8px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="background-color: #f59e0b; color: white; width: 60px; height: 60px; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; font-size: 32px;">⚠</div>
        <h1 style="color: #92400e; font-size: 24px; margin: 0;">Verification Required</h1>
      </div>

      <div style="background-color: white; padding: 30px; border-radius: 8px; margin-bottom: 20px;">
        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 15px 0;">
          Hi ${companyName},
        </p>

        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 15px 0;">
          To continue posting jobs on Internse, we now require all employers to verify their business registration. This is a one-time process that helps us maintain platform integrity.
        </p>

        <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 4px; margin-bottom: 20px;">
          <p style="color: #92400e; font-size: 14px; margin: 0; line-height: 1.5;">
            <strong>⚡ Action Required:</strong> Your account is currently restricted from posting new jobs until verification is complete. You can still manage existing jobs and applicants.
          </p>
        </div>

        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
          The verification process is simple and usually takes 24-48 hours:
        </p>

        <ol style="color: #374151; font-size: 14px; line-height: 1.8; margin: 0 0 20px 0; padding-left: 20px;">
          <li>Log into your Internse dashboard</li>
          <li>Navigate to the Verification section</li>
          <li>Upload your business registration document (PDF)</li>
          <li>Enter your registration number</li>
          <li>Submit for review</li>
        </ol>

        <div style="text-align: center; margin-bottom: 25px;">
          <a href="${process.env.CLIENT_URL}/employer/verification" style="display: inline-block; background-color: #f59e0b; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 16px;">
            Start Verification
          </a>
        </div>

        <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0;">
          Once your business is verified, you'll regain full access to post and manage jobs. If you have any questions, contact us at <strong>support@internse.com</strong>
        </p>
      </div>

      <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px;">
        <p style="margin: 0;">
          © Internse. All rights reserved.
        </p>
      </div>
    </div>
  `;

  await resend.emails.send({
    from: fromEmail,
    to: email,
    subject: '⚠ Action Required: Verify Your Business on Internse',
    html,
  });
};

const notifyExistingEmployers = async (): Promise<void> => {
  try {
    console.log('Starting notification: Alerting existing employers about verification requirement...\n');

    // Get all companies
    const companies = await Company.find({}).select('_id companyName email businessVerification');
    console.log(`Found ${companies.length} companies to notify\n`);

    let successCount = 0;
    let failureCount = 0;

    for (const company of companies) {
      try {
        await sendVerificationRequiredEmail(company.email, company.companyName);
        successCount++;
        console.log(`✓ Sent to ${company.companyName} (${company.email})`);
      } catch (error: any) {
        failureCount++;
        console.error(`✗ Failed to send to ${company.companyName}: ${error.message}`);
      }

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log(`\n✅ Notification complete!`);
    console.log(`Sent: ${successCount}`);
    console.log(`Failed: ${failureCount}`);
    console.log(`\nAll employers have been notified about the new verification requirement.`);
  } catch (error) {
    console.error('Notification error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Database connection closed');
  }
};

connectDB().then(() => notifyExistingEmployers());
