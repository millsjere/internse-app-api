import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import { IAuthPayload } from '../types';

const userConnections = new Map<string, string>(); // userId -> socketId
const companyConnections = new Map<string, string>(); // companyId -> socketId

export const initializeSocket = (httpServer: HTTPServer): Server => {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.SOCKET_CORS_ORIGIN || 'http://localhost:3000',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket: Socket) => {
    console.log(`New client connected: ${socket.id}`);

    // User join
    socket.on('user_join', (payload: IAuthPayload) => {
      userConnections.set(payload._id, socket.id);
      console.log(`User ${payload._id} joined. Total connections: ${userConnections.size}`);
    });

    // Company join
    socket.on('company_join', (payload: IAuthPayload) => {
      companyConnections.set(payload._id, socket.id);
      console.log(`Company ${payload._id} joined. Total connections: ${companyConnections.size}`);
    });

    // Listen for custom events
    socket.on('send_notification', (data) => {
      console.log('Notification event:', data);
      // Relay notification to specific user/company
      if (data.recipientType === 'user' && data.recipientId) {
        const recipientSocketId = userConnections.get(data.recipientId);
        if (recipientSocketId) {
          io.to(recipientSocketId).emit('notification', data);
        }
      } else if (data.recipientType === 'company' && data.recipientId) {
        const recipientSocketId = companyConnections.get(data.recipientId);
        if (recipientSocketId) {
          io.to(recipientSocketId).emit('notification', data);
        }
      }
    });

    // Disconnect
    socket.on('disconnect', () => {
      // Remove from connections
      for (const [userId, socketId] of userConnections.entries()) {
        if (socketId === socket.id) {
          userConnections.delete(userId);
          console.log(`User ${userId} disconnected`);
        }
      }

      for (const [companyId, socketId] of companyConnections.entries()) {
        if (socketId === socket.id) {
          companyConnections.delete(companyId);
          console.log(`Company ${companyId} disconnected`);
        }
      }

      console.log(`Client disconnected: ${socket.id}`);
    });

    // Ping for keep-alive
    socket.on('ping', () => {
      socket.emit('pong');
    });
  });

  return io;
};

export { userConnections, companyConnections };
