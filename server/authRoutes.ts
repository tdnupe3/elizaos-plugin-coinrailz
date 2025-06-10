/**
 * Authentication Routes - Simplified
 */

import type { Express } from "express";
import { isAuthenticated } from "./replitAuth";
import { storage } from "./storage";

export function registerAuthRoutes(app: Express) {
  
  // Get current user
  app.get('/api/auth/user', isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Update user profile
  app.patch('/api/auth/profile', isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      const updates = req.body;
      
      const user = await storage.updateUser(userId, updates);
      res.json({ success: true, user });
    } catch (error) {
      res.status(500).json({ success: false, message: "Profile update failed" });
    }
  });

  // User dashboard data
  app.get('/api/auth/dashboard', isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      
      const user = await storage.getUser(userId);
      const balances = await storage.getUserWalletBalances(userId);
      
      res.json({
        user: {
          id: user?.id,
          email: user?.email,
          firstName: user?.firstName,
          lastName: user?.lastName,
          kycStatus: user?.kycStatus || 'pending'
        },
        balances: balances || []
      });
    } catch (error) {
      res.status(500).json({ message: "Dashboard data fetch failed" });
    }
  });
}