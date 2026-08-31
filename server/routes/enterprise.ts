import type { Express } from "express";
import { isAuthenticated } from "../replitAuth";

declare global {
  namespace Express {
    interface User {
      claims?: {
        sub?: string;
        email?: string;
        first_name?: string;
        last_name?: string;
        profile_image_url?: string;
      };
    }
  }
}

interface EnterpriseClient {
  id: string;
  companyName: string;
  contactEmail: string;
  tier: 'standard' | 'premium' | 'enterprise';
  monthlyVolume: number;
  totalVolume: number;
  activeUsers: number;
  features: string[];
  createdAt: Date;
  lastActivity: Date;
}

interface EnterpriseStats {
  totalVolume: number;
  monthlyVolume: number;
  totalTransactions: number;
  activeUsers: number;
  averageTransactionSize: number;
  feesSaved: number;
  complianceScore: number;
}

interface APIKey {
  id: string;
  name: string;
  key: string;
  environment: 'sandbox' | 'production';
  permissions: string[];
  createdAt: Date;
  lastUsed?: Date;
  isActive: boolean;
}

// In-memory storage (in production, use proper database)
const enterpriseClients: Map<string, EnterpriseClient> = new Map();
const apiKeys: Map<string, APIKey[]> = new Map();
const complianceReports: Map<string, any[]> = new Map();

export function setupEnterpriseRoutes(app: Express) {
  
  // Get enterprise dashboard stats
  app.get("/api/enterprise/stats", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Check if user is enterprise client
      let client = enterpriseClients.get(userId);
      if (!client) {
        // Create default enterprise profile
        client = {
          id: userId,
          companyName: "Enterprise Client",
          contactEmail: req.user?.claims?.email || "",
          tier: 'standard',
          monthlyVolume: 0,
          totalVolume: 0,
          activeUsers: 0,
          features: ['payments', 'wallets', 'analytics'],
          createdAt: new Date(),
          lastActivity: new Date()
        };
        enterpriseClients.set(userId, client);
      }

      // Calculate stats (in production, query from actual transaction data)
      const stats: EnterpriseStats = {
        totalVolume: client.totalVolume,
        monthlyVolume: client.monthlyVolume,
        totalTransactions: Math.floor(client.totalVolume / 1000), // Estimate
        activeUsers: client.activeUsers,
        averageTransactionSize: client.totalVolume > 0 ? client.totalVolume / Math.max(1, Math.floor(client.totalVolume / 1000)) : 0,
        feesSaved: client.totalVolume * 0.02, // Estimated 2% savings
        complianceScore: 95 // High compliance score for enterprise
      };

      res.json(stats);
    } catch (error) {
      console.error("Error fetching enterprise stats:", error);
      res.status(500).json({ error: "Failed to fetch enterprise statistics" });
    }
  });

  // Get API keys for enterprise client
  app.get("/api/enterprise/api-keys", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      let userApiKeys = apiKeys.get(userId);
      if (!userApiKeys) {
        // Create default API keys
        userApiKeys = [
          {
            id: 'prod_key_1',
            name: 'Production API Key',
            key: `pk_live_${generateAPIKey()}`,
            environment: 'production',
            permissions: ['payments', 'wallets', 'webhooks'],
            createdAt: new Date(),
            isActive: true
          },
          {
            id: 'test_key_1', 
            name: 'Sandbox API Key',
            key: `pk_test_${generateAPIKey()}`,
            environment: 'sandbox',
            permissions: ['payments', 'wallets', 'webhooks'],
            createdAt: new Date(),
            isActive: true
          }
        ];
        apiKeys.set(userId, userApiKeys);
      }

      // Mask API keys for security
      const maskedKeys = userApiKeys.map(key => ({
        ...key,
        key: maskAPIKey(key.key)
      }));

      res.json(maskedKeys);
    } catch (error) {
      console.error("Error fetching API keys:", error);
      res.status(500).json({ error: "Failed to fetch API keys" });
    }
  });

  // Generate new API key
  app.post("/api/enterprise/api-keys", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const { name, environment, permissions } = req.body;
      
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      if (!name || !environment || !permissions) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const newApiKey: APIKey = {
        id: `key_${Date.now()}`,
        name,
        key: `pk_${environment}_${generateAPIKey()}`,
        environment: environment as 'sandbox' | 'production',
        permissions,
        createdAt: new Date(),
        isActive: true
      };

      let userApiKeys = apiKeys.get(userId) || [];
      userApiKeys.push(newApiKey);
      apiKeys.set(userId, userApiKeys);

      res.json({
        ...newApiKey,
        key: maskAPIKey(newApiKey.key) // Return masked key
      });
    } catch (error) {
      console.error("Error creating API key:", error);
      res.status(500).json({ error: "Failed to create API key" });
    }
  });

  // Revoke API key
  app.delete("/api/enterprise/api-keys/:keyId", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const { keyId } = req.params;
      
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const userApiKeys = apiKeys.get(userId);
      if (!userApiKeys) {
        return res.status(404).json({ error: "No API keys found" });
      }

      const keyIndex = userApiKeys.findIndex(key => key.id === keyId);
      if (keyIndex === -1) {
        return res.status(404).json({ error: "API key not found" });
      }

      // Deactivate instead of delete for audit trail
      userApiKeys[keyIndex].isActive = false;

      res.json({ success: true, message: "API key revoked successfully" });
    } catch (error) {
      console.error("Error revoking API key:", error);
      res.status(500).json({ error: "Failed to revoke API key" });
    }
  });

  // Get compliance reports
  app.get("/api/enterprise/compliance", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      let reports = complianceReports.get(userId);
      if (!reports) {
        // Generate sample compliance reports
        reports = [
          {
            id: 'aml_2024_12',
            type: 'AML Report',
            period: 'December 2024',
            status: 'completed',
            createdAt: new Date('2024-12-31'),
            downloadUrl: '/api/enterprise/compliance/aml_2024_12/download'
          },
          {
            id: 'monitoring_30d',
            type: 'Transaction Monitoring',
            period: 'Last 30 days',
            status: 'completed',
            createdAt: new Date(),
            downloadUrl: '/api/enterprise/compliance/monitoring_30d/download'
          },
          {
            id: 'risk_q4_2024',
            type: 'Risk Assessment',
            period: 'Q4 2024',
            status: 'completed',
            createdAt: new Date('2024-12-31'),
            downloadUrl: '/api/enterprise/compliance/risk_q4_2024/download'
          }
        ];
        complianceReports.set(userId, reports);
      }

      res.json(reports);
    } catch (error) {
      console.error("Error fetching compliance reports:", error);
      res.status(500).json({ error: "Failed to fetch compliance reports" });
    }
  });

  // Download compliance report
  app.get("/api/enterprise/compliance/:reportId/download", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const { reportId } = req.params;
      
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // In production, generate actual report files
      const reportData = generateComplianceReport(reportId);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${reportId}.pdf"`);
      res.send(reportData);
    } catch (error) {
      console.error("Error downloading compliance report:", error);
      res.status(500).json({ error: "Failed to download report" });
    }
  });

  // Submit support request
  app.post("/api/enterprise/support", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const { subject, priority, message } = req.body;
      
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      if (!subject || !message) {
        return res.status(400).json({ error: "Subject and message are required" });
      }

      // In production, integrate with support ticket system
      const ticket = {
        id: `ENT_${Date.now()}`,
        userId,
        subject,
        priority: priority || 'medium',
        message,
        status: 'open',
        createdAt: new Date()
      };

      // Log enterprise support request
      console.log("Enterprise support request:", ticket);

      res.json({
        success: true,
        ticketId: ticket.id,
        message: "Support request submitted successfully. Our enterprise team will respond within 2 hours."
      });
    } catch (error) {
      console.error("Error submitting support request:", error);
      res.status(500).json({ error: "Failed to submit support request" });
    }
  });

  // Webhook endpoints configuration
  app.get("/api/enterprise/webhooks", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Sample webhook configuration
      const webhooks = [
        {
          id: 'webhook_1',
          url: 'https://your-api.com/webhooks/payments',
          events: ['payment.completed', 'payment.failed', 'wallet.created'],
          status: 'active',
          createdAt: new Date()
        }
      ];

      res.json(webhooks);
    } catch (error) {
      console.error("Error fetching webhooks:", error);
      res.status(500).json({ error: "Failed to fetch webhook configuration" });
    }
  });

  // Bulk payment processing
  app.post("/api/enterprise/bulk-payments", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const { payments } = req.body;
      
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      if (!payments || !Array.isArray(payments)) {
        return res.status(400).json({ error: "Invalid payments data" });
      }

      // Process bulk payments (in production, queue this)
      const batchId = `batch_${Date.now()}`;
      const results = payments.map((payment, index) => ({
        id: `${batchId}_${index}`,
        status: 'queued',
        amount: payment.amount,
        recipient: payment.recipient
      }));

      res.json({
        batchId,
        totalPayments: payments.length,
        results,
        status: 'processing'
      });
    } catch (error) {
      console.error("Error processing bulk payments:", error);
      res.status(500).json({ error: "Failed to process bulk payments" });
    }
  });
}

// Helper functions
function generateAPIKey(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(36))
    .join('')
    .substring(0, 32);
}

function maskAPIKey(key: string): string {
  if (key.length < 8) return key;
  return key.substring(0, 8) + '•'.repeat(key.length - 8);
}

function generateComplianceReport(reportId: string): Buffer {
  // In production, generate actual PDF reports
  const sampleData = `Compliance Report: ${reportId}\nGenerated on: ${new Date().toISOString()}\n\nThis is a sample compliance report.`;
  return Buffer.from(sampleData);
}