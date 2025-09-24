/**
 * 🎯 A2A DISCOVERY CLIENT - REVENUE GENERATION CORE
 * 
 * Implementation of ChatGPT's suggestion:
 * 1. Hits /.well-known/agent.json with optional bearer tokens
 * 2. Parses required methods/capabilities 
 * 3. Runs auth flows (Salesforce/Microsoft/SAP/Box)
 * 
 * IMMEDIATE REVENUE TARGET: Enterprise A2A integrations
 */

import axios, { AxiosRequestConfig } from 'axios';

export interface AgentCard {
  agent: {
    name: string;
    description: string;
    version: string;
    capabilities: string[];
    endpoints: {
      [method: string]: {
        url: string;
        method: 'POST' | 'GET';
        auth?: 'bearer' | 'oauth2' | 'api_key';
        scopes?: string[];
      };
    };
    auth?: {
      type: 'oauth2' | 'api_key' | 'bearer';
      oauth2?: {
        authorization_url: string;
        token_url: string;
        client_id?: string;
        scopes: string[];
      };
    };
  };
}

export interface OAuth2Config {
  platform: 'salesforce' | 'microsoft' | 'sap' | 'box' | 'ibm';
  clientId: string;
  clientSecret: string;
  domain?: string; // For Salesforce My Domain
  tenantId?: string; // For Microsoft
  subaccount?: string; // For SAP BTP
}

export interface A2AConnectionResult {
  success: boolean;
  agentCard?: AgentCard;
  accessToken?: string;
  capabilities: string[];
  endpoints: string[];
  platform: string;
  error?: string;
}

/**
 * 🎯 A2A DISCOVERY CLIENT - ENTERPRISE REVENUE GENERATOR
 */
export class A2ADiscoveryClient {
  private readonly USER_AGENT = 'Coin-Railz-A2A-Client/1.0 (Enterprise Integration Platform)';

  /**
   * 🔍 DISCOVER AGENT CAPABILITIES FROM /.well-known/agent.json
   */
  async discoverAgent(
    agentHost: string, 
    bearerToken?: string
  ): Promise<AgentCard | null> {
    try {
      const agentCardUrl = `${agentHost.replace(/\/$/, '')}/.well-known/agent.json`;
      
      const config: AxiosRequestConfig = {
        method: 'GET',
        url: agentCardUrl,
        headers: {
          'User-Agent': this.USER_AGENT,
          'Accept': 'application/json',
          ...(bearerToken && { 'Authorization': `Bearer ${bearerToken}` })
        },
        timeout: 10000,
        validateStatus: (status) => status === 200
      };

      console.log(`🔍 Discovering A2A agent at: ${agentCardUrl}`);
      
      const response = await axios(config);
      const agentCard = response.data as AgentCard;
      
      console.log(`✅ Discovered agent: ${agentCard.agent.name} with ${agentCard.agent.capabilities.length} capabilities`);
      
      return agentCard;
      
    } catch (error: any) {
      console.log(`⚠️ Agent discovery failed for ${agentHost}: ${error.message}`);
      return null;
    }
  }

  /**
   * 🔐 SALESFORCE MY DOMAIN OAUTH2 FLOW
   */
  async authenticateSalesforce(config: OAuth2Config): Promise<string | null> {
    try {
      const tokenUrl = `https://${config.domain}.my.salesforce.com/services/oauth2/token`;
      
      const response = await axios.post(tokenUrl, new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: config.clientId,
        client_secret: config.clientSecret
      }), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': this.USER_AGENT
        },
        timeout: 15000
      });

      console.log(`✅ Salesforce OAuth2 success for domain: ${config.domain}`);
      return response.data.access_token;
      
    } catch (error: any) {
      console.error(`❌ Salesforce OAuth2 failed:`, error.response?.data || error.message);
      return null;
    }
  }

  /**
   * 🔐 MICROSOFT ENTRA ID (AZURE AD) OAUTH2 FLOW
   */
  async authenticateMicrosoft(config: OAuth2Config): Promise<string | null> {
    try {
      const tokenUrl = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`;
      
      const response = await axios.post(tokenUrl, new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: config.clientId,
        client_secret: config.clientSecret,
        scope: 'https://graph.microsoft.com/.default'
      }), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': this.USER_AGENT
        },
        timeout: 15000
      });

      console.log(`✅ Microsoft Entra OAuth2 success for tenant: ${config.tenantId}`);
      return response.data.access_token;
      
    } catch (error: any) {
      console.error(`❌ Microsoft OAuth2 failed:`, error.response?.data || error.message);
      return null;
    }
  }

  /**
   * 🔐 SAP BTP XSUAA OAUTH2 FLOW
   */
  async authenticateSAP(config: OAuth2Config): Promise<string | null> {
    try {
      const tokenUrl = `https://${config.subaccount}.authentication.sap.hana.ondemand.com/oauth/token`;
      
      const response = await axios.post(tokenUrl, new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: config.clientId,
        client_secret: config.clientSecret
      }), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': this.USER_AGENT
        },
        timeout: 15000
      });

      console.log(`✅ SAP XSUAA OAuth2 success for subaccount: ${config.subaccount}`);
      return response.data.access_token;
      
    } catch (error: any) {
      console.error(`❌ SAP OAuth2 failed:`, error.response?.data || error.message);
      return null;
    }
  }

  /**
   * 🔐 BOX OAUTH2 FLOW
   */
  async authenticateBox(config: OAuth2Config): Promise<string | null> {
    try {
      const tokenUrl = 'https://api.box.com/oauth2/token';
      
      const response = await axios.post(tokenUrl, new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: config.clientId,
        client_secret: config.clientSecret
      }), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': this.USER_AGENT
        },
        timeout: 15000
      });

      console.log(`✅ Box OAuth2 success`);
      return response.data.access_token;
      
    } catch (error: any) {
      console.error(`❌ Box OAuth2 failed:`, error.response?.data || error.message);
      return null;
    }
  }

  /**
   * 🎯 CONNECT TO ENTERPRISE A2A AGENT (FULL WORKFLOW)
   */
  async connectToEnterpriseAgent(
    agentHost: string,
    oauthConfig?: OAuth2Config
  ): Promise<A2AConnectionResult> {
    try {
      // Step 1: Get OAuth2 token if config provided
      let accessToken: string | null = null;
      
      if (oauthConfig) {
        console.log(`🔐 Authenticating with ${oauthConfig.platform}...`);
        
        switch (oauthConfig.platform) {
          case 'salesforce':
            accessToken = await this.authenticateSalesforce(oauthConfig);
            break;
          case 'microsoft':
            accessToken = await this.authenticateMicrosoft(oauthConfig);
            break;
          case 'sap':
            accessToken = await this.authenticateSAP(oauthConfig);
            break;
          case 'box':
            accessToken = await this.authenticateBox(oauthConfig);
            break;
          default:
            console.log(`⚠️ Unsupported OAuth platform: ${oauthConfig.platform}`);
        }
      }

      // Step 2: Discover agent capabilities
      const agentCard = await this.discoverAgent(agentHost, accessToken || undefined);
      
      if (!agentCard) {
        return {
          success: false,
          capabilities: [],
          endpoints: [],
          platform: oauthConfig?.platform || 'unknown',
          error: 'Failed to discover agent card'
        };
      }

      // Step 3: Extract capabilities and endpoints
      const capabilities = agentCard.agent.capabilities;
      const endpoints = Object.keys(agentCard.agent.endpoints);

      console.log(`🎯 Successfully connected to ${agentCard.agent.name}`);
      console.log(`📋 Capabilities: ${capabilities.join(', ')}`);
      console.log(`🔗 Endpoints: ${endpoints.join(', ')}`);

      return {
        success: true,
        agentCard,
        accessToken: accessToken || undefined,
        capabilities,
        endpoints,
        platform: oauthConfig?.platform || 'unknown'
      };

    } catch (error: any) {
      console.error(`❌ Enterprise agent connection failed:`, error.message);
      
      return {
        success: false,
        capabilities: [],
        endpoints: [],
        platform: oauthConfig?.platform || 'unknown',
        error: error.message
      };
    }
  }

  /**
   * 💰 INVOKE A2A AGENT METHOD (REVENUE-GENERATING CALLS)
   */
  async invokeAgentMethod(
    agentCard: AgentCard,
    method: string,
    params: any,
    accessToken: string
  ): Promise<any> {
    try {
      const endpoint = agentCard.agent.endpoints[method];
      
      if (!endpoint) {
        throw new Error(`Method '${method}' not supported by agent`);
      }

      const response = await axios({
        method: endpoint.method,
        url: endpoint.url,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': this.USER_AGENT
        },
        data: {
          jsonrpc: '2.0',
          method: 'agent.invoke',
          params: {
            task: {
              name: method,
              input: params
            }
          },
          id: Date.now()
        },
        timeout: 30000
      });

      console.log(`✅ A2A method '${method}' executed successfully`);
      return response.data;
      
    } catch (error: any) {
      console.error(`❌ A2A method invocation failed:`, error.message);
      throw error;
    }
  }
}

export default new A2ADiscoveryClient();