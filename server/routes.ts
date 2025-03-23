import type { Express } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import MemoryStore from "memorystore";
import { getSessionCookieConfig, isDevelopment } from "./config";
import { storage } from "./storage";
import { setupSocketServer } from "./socket";

// Extend the session to include our custom properties
declare module 'express-session' {
  interface SessionData {
    userId?: string;
    username?: string;
    gameData?: {
      playerId?: string;
      roomCode?: string;
      faction?: string;
      lastActive?: number;
    };
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up session middleware for managing user sessions
  const MemoryStoreSession = MemoryStore(session);
  const sessionConfig = getSessionCookieConfig();
  
  // Use memory store for development, but for production you should use
  // a more persistent store like Redis or PostgreSQL
  const sessionMiddleware = session({
    ...sessionConfig,
    store: new MemoryStoreSession({
      checkPeriod: 86400000, // prune expired entries every 24h
    }),
  });
  
  app.use(sessionMiddleware);
  
  // API routes
  // Use /api prefix for all API routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', environment: isDevelopment() ? 'development' : 'production' });
  });

  // Get current user session info
  app.get('/api/session', (req, res) => {
    if (req.session.userId) {
      res.json({ 
        authenticated: true, 
        userId: req.session.userId,
        username: req.session.username,
        gameData: req.session.gameData || {}
      });
    } else {
      res.json({ authenticated: false });
    }
  });

  // Create HTTP server
  const httpServer = createServer(app);
  
  // Set up WebSocket server for game communication
  const socketServer = setupSocketServer(httpServer);
  
  // Store socket server in app locals for access in other parts of the app
  app.locals.socketServer = socketServer;

  return httpServer;
}
