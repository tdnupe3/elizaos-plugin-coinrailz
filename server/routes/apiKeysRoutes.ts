import { Express, Request, Response } from "express";
import { creditsService } from "../services/creditsService.js";

export function registerApiKeysRoutes(app: Express) {
  
  // Generate new API key
  app.post("/api/api-keys/generate", async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { name } = req.body;

    try {
      const result = await creditsService.generateApiKey(req.user.id, name);

      res.json({
        success: true,
        apiKey: result.apiKey,
        keyPrefix: result.keyPrefix,
        keyId: result.keyId,
        message: "⚠️ Copy this key now - it won't be shown again!"
      });
    } catch (error: any) {
      console.error("❌ Error generating API key:", error);
      res.status(500).json({ error: "Failed to generate API key" });
    }
  });

  // List user's API keys
  app.get("/api/api-keys", async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const keys = await creditsService.listApiKeys(req.user.id);

      const safeKeys = keys.map(key => ({
        id: key.id,
        keyPrefix: key.keyPrefix,
        name: key.name,
        status: key.status,
        lastUsedAt: key.lastUsedAt,
        createdAt: key.createdAt,
        rateLimit: key.rateLimit
      }));

      res.json({ keys: safeKeys });
    } catch (error: any) {
      console.error("❌ Error listing API keys:", error);
      res.status(500).json({ error: "Failed to list API keys" });
    }
  });

  // Revoke API key
  app.delete("/api/api-keys/:keyId", async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { keyId } = req.params;

    try {
      const success = await creditsService.revokeApiKey(keyId, req.user.id);

      if (success) {
        res.json({ success: true, message: "API key revoked successfully" });
      } else {
        res.status(404).json({ error: "API key not found or already revoked" });
      }
    } catch (error: any) {
      console.error("❌ Error revoking API key:", error);
      res.status(500).json({ error: "Failed to revoke API key" });
    }
  });

  console.log("✅ API Keys routes registered successfully");
}
