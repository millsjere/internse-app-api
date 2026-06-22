import axios from 'axios';
import { AppError } from '../middleware/errorHandler';
import { Resend } from 'resend';
import { v2 as cloudinary } from 'cloudinary';

const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@internseapp.com';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export class CloudinaryService {
  static async uploadFile(file: Express.Multer.File, folder: string, originalname?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Use 'raw' resource type for document uploads (resumes, etc.), 'auto' for others
      const resourceType = folder === 'resumes' ? 'raw' : 'auto';

      const stream = cloudinary.uploader.upload_stream(
        { folder, resource_type: resourceType },
        (error, result) => {
          if (error) {
            console.error('[Cloudinary] Upload error:', error);
            reject(new AppError(`Failed to upload file to Cloudinary: ${error.message}`, 500));
          } else if (!result?.secure_url) {
            reject(new AppError('Cloudinary upload succeeded but returned no URL', 500));
          } else {
            let url = result.secure_url;
            // Append original file extension for documents (resumes, etc.)
            if (originalname && folder === 'resumes') {
              const ext = originalname.substring(originalname.lastIndexOf('.')).toLowerCase();
              url = `${url}${ext}`;
            }
            resolve(url);
          }
        }
      );
      stream.end(file.buffer);
    });
  }

  static async deleteFile(publicId: string): Promise<boolean> {
    try {
      await cloudinary.uploader.destroy(publicId);
      return true;
    } catch {
      return false;
    }
  }
}

export class ResendService {
  static async sendVerificationEmail(
    email: string,
    token: string,
    userType: 'user' | 'company' = 'user'
  ): Promise<void> {
    try {
      const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${token}&email=${encodeURIComponent(email)}&type=${userType}`;
      
      await resend.emails.send({
        from: fromEmail,
        to: email,
        subject: 'Verify your Internse email address',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Welcome to Internse!</h2>
            <p>Please verify your email address by clicking the link below:</p>
            <a href="${verificationUrl}" style="display: inline-block; padding: 12px 24px; background-color: #3B82F6; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
              Verify Email
            </a>
            <p style="color: #666; margin-top: 20px;">Or copy and paste this link:</p>
            <p style="color: #666; word-break: break-all;">${verificationUrl}</p>
            <p style="color: #999; font-size: 12px; margin-top: 30px;">This link expires in 24 hours.</p>
          </div>
        `,
      });
      
      console.log(`Verification email sent to ${email}`);
    } catch (error) {
      console.error('Error sending verification email:', error);
      throw new AppError('Failed to send verification email', 500);
    }
  }

  static async sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
    try {
      const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;
      
      await resend.emails.send({
        from: fromEmail,
        to: email,
        subject: 'Reset your Internse password',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Password Reset Request</h2>
            <p>We received a request to reset your password. Click the link below:</p>
            <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #3B82F6; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
              Reset Password
            </a>
            <p style="color: #666; margin-top: 20px;">Or copy and paste this link:</p>
            <p style="color: #666; word-break: break-all;">${resetUrl}</p>
            <p style="color: #999; font-size: 12px; margin-top: 30px;">This link expires in 24 hours.</p>
            <p style="color: #999; font-size: 12px;">If you didn't request this, you can ignore this email.</p>
          </div>
        `,
      });
      
      console.log(`Password reset email sent to ${email}`);
    } catch (error) {
      console.error('Error sending password reset email:', error);
      throw new AppError('Failed to send password reset email', 500);
    }
  }

  static async sendApplicationConfirmation(
    email: string,
    firstName: string,
    jobTitle: string,
    companyName: string
  ): Promise<void> {
    try {
      await resend.emails.send({
        from: fromEmail,
        to: email,
        subject: `Application submitted — ${jobTitle} at ${companyName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
            <h2 style="color: #1d4ed8;">Application Received!</h2>
            <p>Hi ${firstName},</p>
            <p>Your application for <strong>${jobTitle}</strong> at <strong>${companyName}</strong> has been successfully submitted.</p>
            <p>The hiring team will review your application and reach out if you're a good fit. In the meantime, you can track the status of all your applications from your dashboard.</p>
            <p style="margin: 24px 0;">
              <a href="${process.env.CLIENT_URL}/applications" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px;">View My Applications</a>
            </p>
            <p style="color: #666;">Good luck!</p>
            <p style="color: #666;">— The Internse Team</p>
            <p style="color: #999; font-size: 12px; margin-top: 30px;">You are receiving this because you applied for a job on Internse.</p>
          </div>
        `,
      });
      console.log(`Application confirmation sent to ${email}`);
    } catch (error) {
      console.error('Error sending application confirmation email:', error);
      // Non-fatal — don't throw, application already saved
    }
  }

  static async sendApplicationNotification(email: string, jobTitle: string): Promise<void> {
    try {
      await resend.emails.send({
        from: fromEmail,
        to: email,
        subject: `You received a new application for ${jobTitle}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">New Application Received</h2>
            <p>You have received a new application for the position: <strong>${jobTitle}</strong></p>
            <p><a href="${process.env.CLIENT_URL}/employer/applications" style="display: inline-block; padding: 12px 24px; background-color: #3B82F6; color: white; text-decoration: none; border-radius: 6px;">View Application</a></p>
          </div>
        `,
      });
      
      console.log(`Application notification sent to ${email}`);
    } catch (error) {
      console.error('Error sending application notification:', error);
      throw new AppError('Failed to send application notification', 500);
    }
  }

  static async sendCustomEmail(email: string, subject: string, html: string): Promise<void> {
    await resend.emails.send({ from: fromEmail, to: email, subject, html });
  }

  static async sendTeamInviteEmail(email: string, companyName: string, role: string, inviteLink: string): Promise<void> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #1f2937; font-size: 24px; margin: 0;">You're invited!</h1>
        </div>

        <div style="background-color: white; padding: 30px; border-radius: 8px; margin-bottom: 20px;">
          <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 15px 0;">
            Hi there,
          </p>

          <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 15px 0;">
            <strong>${companyName}</strong> has invited you to join their team as a <strong>${role}</strong> on Internse.
          </p>

          <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
            Click the button below to accept the invitation and start collaborating:
          </p>

          <div style="text-align: center; margin-bottom: 25px;">
            <a href="${inviteLink}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 16px;">
              Accept Invitation
            </a>
          </div>

          <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin: 0; text-align: center;">
            Or copy and paste this link in your browser:
            <br />
            <span style="color: #2563eb; word-break: break-all;">${inviteLink}</span>
          </p>
        </div>

        <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px;">
          <p style="margin: 0;">
            If you received this email by mistake, you can safely ignore it.
          </p>
          <p style="margin: 10px 0 0 0;">
            © Internse. All rights reserved.
          </p>
        </div>
      </div>
    `;

    await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: `${companyName} invited you to join Internse`,
      html,
    });
  }
}

export class PaystackService {
  private static get secretKey(): string {
    const key = process.env.PAYSTACK_SECRET_KEY;
    if (!key) throw new AppError('Paystack secret key not configured', 500);
    return key;
  }

  static async initializeTransaction(
    email: string,
    amount: number,
    reference: string,
    currency = 'GHS',
    callbackUrl?: string,
  ): Promise<{ authorizationUrl: string; reference: string }> {
    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email,
        amount,
        reference,
        currency,
        ...(callbackUrl && { callback_url: callbackUrl }),
      },
      {
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.data.status) {
      throw new AppError(response.data.message ?? 'Failed to initialize payment', 500);
    }

    return {
      authorizationUrl: response.data.data.authorization_url,
      reference: response.data.data.reference,
    };
  }

  static async verifyTransaction(reference: string): Promise<boolean> {
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: { Authorization: `Bearer ${this.secretKey}` },
      }
    );

    if (!response.data.status) {
      throw new AppError(response.data.message ?? 'Transaction verification failed', 400);
    }

    return response.data.data.status === 'success';
  }
}
