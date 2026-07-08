import { Request, Response, NextFunction } from 'express';
import { MulterError } from 'multer';

export class AppError extends Error {
  public statusCode: number;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      status: err.statusCode,
      message: err.message,
    });
    return;
  }

  if (err instanceof MulterError) {
    const messages: Partial<Record<MulterError['code'], string>> = {
      LIMIT_FILE_SIZE: 'File is too large. Maximum size is 5MB.',
      LIMIT_UNEXPECTED_FILE: 'Unexpected file field.',
    };
    res.status(400).json({
      success: false,
      status: 400,
      message: messages[err.code] || err.message,
    });
    return;
  }

  console.error('Unexpected error:', err);
  res.status(500).json({
    success: false,
    status: 500,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
};

export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
