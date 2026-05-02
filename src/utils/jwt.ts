import jwt from 'jsonwebtoken';
import { IAuthPayload } from '../types';

export const getTokenExpiry = (token: string): number => {
  try {
    const decoded: any = jwt.decode(token);
    if (decoded?.exp) {
      return decoded.exp * 1000; // Convert from seconds to milliseconds
    }
  } catch (error) {
    // Return default 7 days from now if can't decode
    return Date.now() + 7 * 24 * 60 * 60 * 1000;
  }
  return Date.now() + 7 * 24 * 60 * 60 * 1000;
};

export const generateToken = (user: IAuthPayload): string => {
  return jwt.sign(user, process.env.JWT_SECRET as string, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  } as any);
};

export const generateRefreshToken = (user: IAuthPayload): string => {
  return jwt.sign(user, (process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET) as string, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d',
  } as any);
};

export const verifyToken = (token: string): IAuthPayload | null => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET as string) as IAuthPayload;
  } catch {
    return null;
  }
};
