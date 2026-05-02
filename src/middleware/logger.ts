import { Request, Response, NextFunction } from 'express';
import morgan from 'morgan';

const morganMiddleware = morgan(':method :url :status :response-time ms');

export default morganMiddleware;

export const requestLogger = (_req: Request, _res: Response, next: NextFunction): void => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[${new Date().toISOString()}] ${_req.method} ${_req.path}`);
  }
  next();
};
