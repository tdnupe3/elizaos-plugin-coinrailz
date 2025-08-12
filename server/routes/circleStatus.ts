import type { Express } from "express";

export function registerCircleStatusRoutes(app: Express) {
  // Circle API status check endpoint
  app.get("/api/circle/status", async (req, res) => {
    try {
      const apiKey = process.env.CIRCLE_API_KEY;
      const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

      if (!apiKey || !entitySecret) {
        return res.json({
          success: false,
          error: "Circle API credentials not configured",
          hasApiKey: !!apiKey,
          hasEntitySecret: !!entitySecret
        });
      }

      // Test multiple Circle API endpoints to determine access level
      const testEndpoints = [
        'https://api.circle.com/v1/configuration',
        'https://api.circle.com/v1/wallets',
        'https://api.sandbox.circle.com/v1/configuration',
        'https://api.sandbox.circle.com/v1/wallets'
      ];

      const testResults = [];

      for (const endpoint of testEndpoints) {
        try {
          const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            }
          });

          const data = await response.text();
          
          testResults.push({
            endpoint: endpoint.replace(apiKey, '[REDACTED]'),
            status: response.status,
            success: response.ok,
            data: response.ok ? JSON.parse(data) : data
          });
        } catch (error) {
          testResults.push({
            endpoint: endpoint.replace(apiKey, '[REDACTED]'),
            status: 'ERROR',
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      res.json({
        success: true,
        apiKeyFormat: apiKey.startsWith('LIVE_') ? 'Production' : 
                     apiKey.startsWith('SAND_') ? 'Sandbox' : 'Unknown',
        apiKeyPrefix: apiKey.substring(0, 20) + '...',
        entitySecretConfigured: !!entitySecret,
        testResults
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}