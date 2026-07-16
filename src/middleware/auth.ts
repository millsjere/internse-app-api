import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { IAuthPayload } from '../types/index.js';

declare global {
  namespace Express {
    interface Request {
      user?: IAuthPayload;
      token?: string;
    }
  }
}

export const protect = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Check for user token (uid_jwt) OR company token (cid_jwt) OR Authorization header
    const token = req.cookies?.uid_jwt || req.cookies?.cid_jwt || req.headers.authorization?.split(' ')[1];

    if (!token) {
      res.status(401).json({ success: false, message: 'Not authorized to access this route' });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as IAuthPayload;
    req.user = decoded;
    req.token = token;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Not authorized to access this route' });
  }
};

export const protectCompany = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const token = req.cookies?.cid_jwt || req.headers.authorization?.split(' ')[1];

    if (!token) {
      res.status(401).json({ success: false, message: 'Not authorized to access this route' });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as IAuthPayload;
    if (decoded.type !== 'company') {
      res.status(403).json({ success: false, message: 'Access denied. Company account required' });
      return;
    }

    req.user = decoded;
    req.token = token;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Not authorized to access this route' });
  }
};

// Must run after protectCompany. Accounts with no teamRole are company owners and are
// always allowed; team members are restricted to the given roles.
export const requireCompanyRole = (allowedRoles: Array<'admin' | 'recruiter' | 'viewer'>) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const teamRole = req.user?.teamRole;
    if (!teamRole || allowedRoles.includes(teamRole)) {
      next();
      return;
    }
    res.status(403).json({ success: false, message: 'You do not have permission to perform this action' });
  };
};

export const protectAdmin = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const token = req.cookies?.admin_jwt || req.headers.authorization?.split(' ')[1];

    if (!token) {
      res.status(401).json({ success: false, message: 'Admin access required' });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as IAuthPayload;
    if (decoded.type !== 'admin') {
      res.status(403).json({ success: false, message: 'Admin access required' });
      return;
    }

    req.user = decoded;
    req.token = token;
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired admin token' });
  }
};

export const protectOptional = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Check for user token (uid_jwt) OR company token (cid_jwt) OR Authorization header
    const token = req.cookies?.uid_jwt || req.cookies?.cid_jwt || req.headers.authorization?.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as IAuthPayload;
      req.user = decoded;
      req.token = token;
    }
  } catch (_error) {
    // Continue without auth
  }
  next();
};
