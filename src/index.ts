import 'dotenv/config';
import express, { Express, Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morganMiddleware from './middleware/logger';
import { errorHandler } from './middleware/errorHandler';
import { initializeSocket } from './socket/index';

// Routes
import authRoutes from './routes/authRoutes';
import jobRoutes from './routes/jobRoutes';
import userRoutes from './routes/userRoutes';
import notificationsRoutes from './routes/notificationsRoutes';
import adminRoutes from './routes/adminRoutes';

const app: Express = express();
const httpServer = createServer(app);

// Initialize Socket.io
initializeSocket(httpServer);

// Middleware
app.use(helmet());
const allowedOrigins = [
  'https://www.internse.com',
  'https://internse.com',
  'http://localhost:3000',
  process.env.CLIENT_URL,
].filter((url): url is string => Boolean(url));

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  // Custom response headers are hidden from cross-origin JS by default — the applicants CSV
  // export reads these to page through batches via a cursor instead of skip/limit.
  exposedHeaders: ['X-Export-Row-Count', 'X-Export-Next-Cursor-Id', 'X-Export-Next-Cursor-Date'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morganMiddleware);

// Database Connection
const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(process.env.MONGO_URI!);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Health check
app.get('/api/health', (req: Request, res: Response): void => {
  res.json({ success: true, message: 'Server is running' });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/user', userRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/admin', adminRoutes);

// 404 handler
app.use((_req: Request, res: Response): void => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Error handling middleware
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;

const startServer = async (): Promise<void> => {
  try {
    await connectDB();
    httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};  

startServer();

export default app;
