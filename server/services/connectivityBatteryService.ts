/**
 * 🔋 CONNECTIVITY BATTERY - Pre-flight testing for all A2A providers
 * 
 * This implements the "connectivity battery" from ChatGPT analysis - a test script
 * that validates all provider connections work before the A2A system uses them.
 * 
 * Prevents wasted API calls and gives clear error diagnosis.
 */

import { ProviderType } from './a2aAPIWrapperService.js';

interface ConnectivityResult {
  provider: ProviderType;
  healthy: boolean;
  error_code?: string;
  error_message?: string;
  response_time_ms?: number;
  test_timestamp: string;
}

interface BatteryTestResult {
  all_healthy: boolean;
  healthy_count: number;
  total_count: number;
  results: ConnectivityResult[];
  test_completed_at: string;
}

/**
 * 🧪 CONNECTIVITY BATTERY - Tests all providers with exact ChatGPT recommendations
 */
export class ConnectivityBatteryService {
  private static instance: ConnectivityBatteryService;
  
  public static getInstance(): ConnectivityBatteryService {
    if (!ConnectivityBatteryService.instance) {
      ConnectivityBatteryService.instance = new ConnectivityBatteryService();
    }
    return ConnectivityBatteryService.instance;
  }

  /**
   * 🔬 Run full connectivity battery test
   */
  async runFullBattery(): Promise<BatteryTestResult> {
    console.log('🔋 Starting CONNECTIVITY BATTERY test...');
    
    const results: ConnectivityResult[] = [];
    const testStart = Date.now();
    
    // Test all providers in parallel for speed
    const providers: ProviderType[] = ['openai', 'anthropic', 'cohere', 'dexscreener', 'ibm', 'slack'];
    
    const testPromises = providers.map(provider => this.testProvider(provider));
    const testResults = await Promise.all(testPromises);
    
    results.push(...testResults);
    
    const healthyCount = results.filter(r => r.healthy).length;
    const testDuration = Date.now() - testStart;
    
    const batteryResult: BatteryTestResult = {
      all_healthy: healthyCount === results.length,
      healthy_count: healthyCount,
      total_count: results.length,
      results,
      test_completed_at: new Date().toISOString()
    };
    
    console.log(`🔋 BATTERY COMPLETE: ${healthyCount}/${results.length} healthy (${testDuration}ms)`);
    
    // Log any failures with details
    results.filter(r => !r.healthy).forEach(result => {
      console.log(`❌ ${result.provider}: ${result.error_code} - ${result.error_message}`);
    });
    
    return batteryResult;
  }

  /**
   * 🧪 Test individual provider using exact ChatGPT curl patterns
   */
  private async testProvider(provider: ProviderType): Promise<ConnectivityResult> {
    const startTime = Date.now();
    
    try {
      switch (provider) {
        case 'openai':
          return await this.testOpenAI(startTime);
        case 'anthropic':
          return await this.testAnthropic(startTime);
        case 'cohere':
          return await this.testCohere(startTime);
        case 'dexscreener':
          return await this.testDexScreener(startTime);
        case 'ibm':
          return await this.testIBM(startTime);
        case 'slack':
          return await this.testSlack(startTime);
        default:
          return {
            provider,
            healthy: false,
            error_code: 'UNKNOWN_PROVIDER',
            error_message: `Provider ${provider} not supported`,
            test_timestamp: new Date().toISOString()
          };
      }
    } catch (error) {
      return {
        provider,
        healthy: false,
        error_code: 'TEST_EXCEPTION',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        response_time_ms: Date.now() - startTime,
        test_timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 🤖 Test OpenAI using Responses API (ChatGPT recommendation)
   */
  private async testOpenAI(startTime: number): Promise<ConnectivityResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      return {
        provider: 'openai',
        healthy: false,
        error_code: 'MISSING_API_KEY',
        error_message: 'OPENAI_API_KEY environment variable not set',
        test_timestamp: new Date().toISOString()
      };
    }

    try {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          input: 'Say pong.'
        })
      });

      const responseTime = Date.now() - startTime;
      
      if (response.ok) {
        const data = await response.json();
        return {
          provider: 'openai',
          healthy: true,
          response_time_ms: responseTime,
          test_timestamp: new Date().toISOString()
        };
      } else {
        const errorText = await response.text();
        return {
          provider: 'openai',
          healthy: false,
          error_code: `HTTP_${response.status}`,
          error_message: errorText,
          response_time_ms: responseTime,
          test_timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      return {
        provider: 'openai',
        healthy: false,
        error_code: 'NETWORK_ERROR',
        error_message: error instanceof Error ? error.message : 'Network failure',
        response_time_ms: Date.now() - startTime,
        test_timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 🧠 Test Anthropic with proper version header
   */
  private async testAnthropic(startTime: number): Promise<ConnectivityResult> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      return {
        provider: 'anthropic',
        healthy: false,
        error_code: 'MISSING_API_KEY',
        error_message: 'ANTHROPIC_API_KEY environment variable not set',
        test_timestamp: new Date().toISOString()
      };
    }

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 64,
          messages: [{ role: 'user', content: 'Say pong.' }]
        })
      });

      const responseTime = Date.now() - startTime;
      
      if (response.ok) {
        const data = await response.json();
        return {
          provider: 'anthropic',
          healthy: true,
          response_time_ms: responseTime,
          test_timestamp: new Date().toISOString()
        };
      } else {
        const errorText = await response.text();
        return {
          provider: 'anthropic',
          healthy: false,
          error_code: `HTTP_${response.status}`,
          error_message: errorText,
          response_time_ms: responseTime,
          test_timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      return {
        provider: 'anthropic',
        healthy: false,
        error_code: 'NETWORK_ERROR',
        error_message: error instanceof Error ? error.message : 'Network failure',
        response_time_ms: Date.now() - startTime,
        test_timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 🎯 Test Cohere Chat API
   */
  private async testCohere(startTime: number): Promise<ConnectivityResult> {
    const apiKey = process.env.COHERE_API_KEY;
    
    if (!apiKey) {
      return {
        provider: 'cohere',
        healthy: false,
        error_code: 'MISSING_API_KEY',
        error_message: 'COHERE_API_KEY environment variable not set',
        test_timestamp: new Date().toISOString()
      };
    }

    try {
      const response = await fetch('https://api.cohere.ai/v1/chat', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'command-r-plus',
          message: 'Say pong.'
        })
      });

      const responseTime = Date.now() - startTime;
      
      if (response.ok) {
        const data = await response.json();
        return {
          provider: 'cohere',
          healthy: true,
          response_time_ms: responseTime,
          test_timestamp: new Date().toISOString()
        };
      } else {
        const errorText = await response.text();
        return {
          provider: 'cohere',
          healthy: false,
          error_code: `HTTP_${response.status}`,
          error_message: errorText,
          response_time_ms: responseTime,
          test_timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      return {
        provider: 'cohere',
        healthy: false,
        error_code: 'NETWORK_ERROR',
        error_message: error instanceof Error ? error.message : 'Network failure',
        response_time_ms: Date.now() - startTime,
        test_timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 📊 Test DexScreener public API with proper User-Agent
   */
  private async testDexScreener(startTime: number): Promise<ConnectivityResult> {
    try {
      const response = await fetch('https://api.dexscreener.com/latest/dex/search?q=ethereum', {
        method: 'GET',
        headers: {
          'User-Agent': 'a2a-bot/1.0 (support@coinrailz.com)'
        }
      });

      const responseTime = Date.now() - startTime;
      
      if (response.ok) {
        const data = await response.json();
        return {
          provider: 'dexscreener',
          healthy: true,
          response_time_ms: responseTime,
          test_timestamp: new Date().toISOString()
        };
      } else {
        const errorText = await response.text();
        return {
          provider: 'dexscreener',
          healthy: false,
          error_code: `HTTP_${response.status}`,
          error_message: errorText,
          response_time_ms: responseTime,
          test_timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      return {
        provider: 'dexscreener',
        healthy: false,
        error_code: 'NETWORK_ERROR',
        error_message: error instanceof Error ? error.message : 'Network failure',
        response_time_ms: Date.now() - startTime,
        test_timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 🏢 Test IBM with IAM token exchange
   */
  private async testIBM(startTime: number): Promise<ConnectivityResult> {
    const apiKey = process.env.IBM_API_KEY;
    
    if (!apiKey) {
      return {
        provider: 'ibm',
        healthy: false,
        error_code: 'MISSING_API_KEY',
        error_message: 'IBM_API_KEY environment variable not set',
        test_timestamp: new Date().toISOString()
      };
    }

    try {
      // Step 1: Get IAM token
      const iamResponse = await fetch('https://iam.cloud.ibm.com/identity/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${apiKey}`
      });

      if (!iamResponse.ok) {
        const errorText = await iamResponse.text();
        return {
          provider: 'ibm',
          healthy: false,
          error_code: `IAM_HTTP_${iamResponse.status}`,
          error_message: `IAM token exchange failed: ${errorText}`,
          response_time_ms: Date.now() - startTime,
          test_timestamp: new Date().toISOString()
        };
      }

      const iamData = await iamResponse.json();
      const accessToken = iamData.access_token;

      // Step 2: Test inference with token
      const inferenceResponse = await fetch('https://us-south.ml.cloud.ibm.com/ml/v1/text/generation?version=2024-10-15', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model_id: 'ibm/granite-3-8b-instruct',
          input: 'Say pong.',
          parameters: { max_new_tokens: 16 }
        })
      });

      const responseTime = Date.now() - startTime;
      
      if (inferenceResponse.ok) {
        const data = await inferenceResponse.json();
        return {
          provider: 'ibm',
          healthy: true,
          response_time_ms: responseTime,
          test_timestamp: new Date().toISOString()
        };
      } else {
        const errorText = await inferenceResponse.text();
        return {
          provider: 'ibm',
          healthy: false,
          error_code: `HTTP_${inferenceResponse.status}`,
          error_message: errorText,
          response_time_ms: responseTime,
          test_timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      return {
        provider: 'ibm',
        healthy: false,
        error_code: 'NETWORK_ERROR',
        error_message: error instanceof Error ? error.message : 'Network failure',
        response_time_ms: Date.now() - startTime,
        test_timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 💬 Test Slack Bot API
   */
  private async testSlack(startTime: number): Promise<ConnectivityResult> {
    const botToken = process.env.SLACK_BOT_TOKEN;
    
    if (!botToken) {
      return {
        provider: 'slack',
        healthy: false,
        error_code: 'MISSING_API_KEY',
        error_message: 'SLACK_BOT_TOKEN environment variable not set',
        test_timestamp: new Date().toISOString()
      };
    }

    try {
      const response = await fetch('https://slack.com/api/auth.test', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${botToken}`,
          'Content-Type': 'application/json'
        }
      });

      const responseTime = Date.now() - startTime;
      
      if (response.ok) {
        const data = await response.json();
        if (data.ok) {
          return {
            provider: 'slack',
            healthy: true,
            response_time_ms: responseTime,
            test_timestamp: new Date().toISOString()
          };
        } else {
          return {
            provider: 'slack',
            healthy: false,
            error_code: 'SLACK_API_ERROR',
            error_message: data.error || 'Slack API returned ok: false',
            response_time_ms: responseTime,
            test_timestamp: new Date().toISOString()
          };
        }
      } else {
        const errorText = await response.text();
        return {
          provider: 'slack',
          healthy: false,
          error_code: `HTTP_${response.status}`,
          error_message: errorText,
          response_time_ms: responseTime,
          test_timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      return {
        provider: 'slack',
        healthy: false,
        error_code: 'NETWORK_ERROR',
        error_message: error instanceof Error ? error.message : 'Network failure',
        response_time_ms: Date.now() - startTime,
        test_timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 🔍 Get last battery test results
   */
  getLastBatteryResults(): BatteryTestResult | null {
    // In production, this would be stored in Redis/DB
    // For now, return null to trigger fresh test
    return null;
  }
}

export default ConnectivityBatteryService;