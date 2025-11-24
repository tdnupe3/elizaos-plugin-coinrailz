import axios from 'axios';
import * as cheerio from 'cheerio';
import { db } from '../db';
import { discoveredAgents } from '@shared/schema';
import { sql } from 'drizzle-orm';
import { persistDiscoveredAgent } from '../storage/discoveredAgentsStorage';

interface X402Agent {
  name: string;
  resources: number;
  score: number;
  messages: number;
  toolCalls: number;
  users: number;
  chats: number;
  agentUrl?: string;
}

export class X402ScanAgentScraper {
  private baseUrl = 'https://www.x402scan.com';
  
  async scrapeTopAgents(limit: number = 50): Promise<X402Agent[]> {
    try {
      console.log('🔍 Fetching x402scan Top Agents page...');
      const response = await axios.get(this.baseUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; CoinRailzBot/1.0; +https://coinrailz.com)',
        },
        timeout: 15000,
      });

      const $ = cheerio.load(response.data);
      const agents: X402Agent[] = [];

      console.log('📊 Parsing agent data from page...');
      
      $('table').each((_, table) => {
        const headings = $(table).find('th').map((_, th) => $(th).text().trim().toLowerCase()).get();
        
        if (headings.includes('name') && headings.includes('score')) {
          console.log('✅ Found Top Agents table');
          
          $(table).find('tbody tr').each((index, row) => {
            if (index >= limit) return false;
            
            const cells = $(row).find('td');
            if (cells.length === 0) return;

            const nameCell = $(cells[0]);
            const name = nameCell.find('img').attr('alt') || nameCell.text().trim();
            const agentUrl = nameCell.find('a').attr('href');
            
            const resources = parseInt($(cells[1]).text().trim()) || 0;
            const score = parseFloat($(cells[2]).text().trim()) || 0;
            const messages = parseInt($(cells[3]).text().trim()) || 0;
            const toolCalls = parseInt($(cells[4]).text().trim()) || 0;
            const users = parseInt($(cells[5]).text().trim()) || 0;
            const chats = parseFloat($(cells[6]).text().trim()) || 0;

            if (name && score > 0) {
              agents.push({
                name,
                resources,
                score,
                messages,
                toolCalls,
                users,
                chats,
                agentUrl: agentUrl ? `${this.baseUrl}${agentUrl}` : undefined,
              });
            }
          });
        }
      });

      console.log(`📦 Found ${agents.length} agents from x402scan`);
      return agents;
    } catch (error: any) {
      console.error('❌ Failed to scrape x402scan:', error.message);
      throw new Error(`x402scan scraping failed: ${error.message}`);
    }
  }

  async saveToDatabase(agents: X402Agent[]): Promise<void> {
    console.log(`💾 Saving ${agents.length} agents to database...`);
    
    for (const agent of agents) {
      try {
        await persistDiscoveredAgent({
          url: agent.agentUrl || `https://x402scan.com/agent/${encodeURIComponent(agent.name)}`,
          source: 'x402scan-top-agents',
          status: 'new',
          score: Math.round(agent.score * 10),
          metadata: {
            name: agent.name,
            resources: agent.resources,
            score: agent.score,
            messages: agent.messages,
            toolCalls: agent.toolCalls,
            users: agent.users,
            chats: agent.chats,
            scrapedAt: new Date().toISOString(),
          },
          capabilities: {
            toolCalls: agent.toolCalls,
            resources: agent.resources,
          },
        });
      } catch (error: any) {
        console.error(`❌ Failed to save agent ${agent.name}:`, error.message);
      }
    }
    
    console.log('✅ Database save complete');
  }

  async run(limit: number = 50): Promise<{ discovered: number; saved: number }> {
    console.log('🚀 Starting x402scan agent discovery...');
    
    const agents = await this.scrapeTopAgents(limit);
    await this.saveToDatabase(agents);
    
    return {
      discovered: agents.length,
      saved: agents.length,
    };
  }
}

export const x402scanAgentScraper = new X402ScanAgentScraper();
