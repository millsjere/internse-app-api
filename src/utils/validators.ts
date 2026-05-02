import slugify from 'slugify';

export const createSlug = (title: string): string => {
  return slugify(title, { lower: true, strict: true });
};

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const generateVerificationToken = (): string => {
  return Math.random().toString(36).substr(2, 9) + Math.random().toString(36).substr(2, 9);
};

export const generateResetToken = (): { token: string; expiresAt: Date } => {
  const token = Math.random().toString(36).substr(2);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  return { token, expiresAt };
};
