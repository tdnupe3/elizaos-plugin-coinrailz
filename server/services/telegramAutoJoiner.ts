import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

export class TelegramAutoJoiner {
  private isRunning = false;
  private currentProcess: any = null;
  private joinedGroups = new Set<string>();
  private failedGroups = new Set<string>();
  private totalGroups = 0;
  private status = 'idle';
  private logs: string[] = [];

  constructor() {
    console.log('🤖 Telegram Auto-Joiner service initialized');
  }

  /**
   * 🚀 START AUTO-JOINING CRYPTO GROUPS (FREE!)
   */
  async startAutoJoin(config: AutoJoinConfig): Promise<void> {
    if (this.isRunning) {
      throw new Error('Auto-joiner is already running');
    }

    // Validate required config
    if (!config.apiId || !config.apiHash || !config.phoneNumber) {
      throw new Error('Missing required Telegram API credentials');
    }

    if (!config.groupUrls || config.groupUrls.length === 0) {
      throw new Error('No group URLs provided');
    }

    this.isRunning = true;
    this.status = 'starting';
    this.totalGroups = config.groupUrls.length;
    this.logs.push(`🚀 Starting auto-join for ${this.totalGroups} crypto groups...`);

    try {
      // Create Python script with user's config
      const scriptPath = await this.createPythonScript(config);
      
      // Run the Python auto-joiner
      await this.executePythonScript(scriptPath);

    } catch (error: any) {
      this.status = 'failed';
      this.logs.push(`❌ Auto-join failed: ${error.message}`);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 📝 CREATE PYTHON AUTO-JOINER SCRIPT
   */
  private async createPythonScript(config: AutoJoinConfig): Promise<string> {
    const scriptContent = `#!/usr/bin/env python3

import time
import random
import re
import asyncio
from pyrogram import Client
from pyrogram.errors import FloodWait, UserAlreadyParticipant, InviteHashExpired

# API Configuration
api_id = '${config.apiId}'
api_hash = '${config.apiHash}'
phone_number = '${config.phoneNumber}'

# Crypto Groups to Join
channels = [
${config.groupUrls.map(url => `    "${url}",`).join('\n')}
]

def extract_username(url):
    match = re.search(r't\\.me\\/([a-zA-Z0-9_]+)', url)
    if match:
        return match.group(1)
    return None

app = Client("crypto_joiner", api_id=api_id, api_hash=api_hash, phone_number=phone_number)

async def join_channels():
    joined = 0
    failed = 0
    
    async with app:
        print(f"🚀 Starting to join {len(channels)} crypto groups...")
        
        for i, channel_url in enumerate(channels, 1):
            username = extract_username(channel_url)
            
            if username:
                try:
                    print(f"[{i}/{len(channels)}] Joining {channel_url}...")
                    await app.join_chat(username)
                    joined += 1
                    print(f"✅ Successfully joined {channel_url}")
                    
                except UserAlreadyParticipant:
                    print(f"⚠️ Already a member of {channel_url}")
                    joined += 1
                    
                except FloodWait as e:
                    print(f"⏳ Rate limited! Waiting {e.value} seconds...")
                    await asyncio.sleep(e.value)
                    continue  # Retry this group
                    
                except InviteHashExpired:
                    print(f"❌ Invite expired for {channel_url}")
                    failed += 1
                    
                except Exception as e:
                    print(f"❌ Failed to join {channel_url}: {e}")
                    failed += 1
                
                # Random delay between joins (5-10 minutes)
                if i < len(channels):
                    delay = random.randint(300, 600)
                    print(f"⏳ Waiting {delay} seconds before next group...")
                    await asyncio.sleep(delay)
            else:
                print(f"❌ Invalid URL format: {channel_url}")
                failed += 1
        
        print(f"\\n🎉 Auto-join complete!")
        print(f"✅ Successfully joined: {joined}")
        print(f"❌ Failed to join: {failed}")

if __name__ == "__main__":
    app.run(join_channels())
`;

    const scriptPath = path.join(process.cwd(), 'telegram-auto-joiner.py');
    fs.writeFileSync(scriptPath, scriptContent);
    return scriptPath;
  }

  /**
   * 🐍 EXECUTE PYTHON AUTO-JOINER SCRIPT
   */
  private async executePythonScript(scriptPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.status = 'running';
      this.currentProcess = spawn('python3', [scriptPath]);

      this.currentProcess.stdout.on('data', (data: Buffer) => {
        const output = data.toString().trim();
        console.log('Auto-joiner:', output);
        this.logs.push(output);
        
        // Parse join success/failure
        if (output.includes('Successfully joined')) {
          const match = output.match(/Successfully joined (.+)/);
          if (match) {
            this.joinedGroups.add(match[1]);
          }
        } else if (output.includes('Failed to join')) {
          const match = output.match(/Failed to join (.+):/);
          if (match) {
            this.failedGroups.add(match[1]);
          }
        }
      });

      this.currentProcess.stderr.on('data', (data: Buffer) => {
        const error = data.toString().trim();
        console.error('Auto-joiner error:', error);
        this.logs.push(`❌ ${error}`);
      });

      this.currentProcess.on('close', (code: number) => {
        this.status = code === 0 ? 'completed' : 'failed';
        this.isRunning = false;
        
        if (code === 0) {
          this.logs.push('🎉 Auto-join completed successfully!');
          resolve();
        } else {
          this.logs.push(`❌ Auto-join failed with exit code ${code}`);
          reject(new Error(`Python script failed with exit code ${code}`));
        }
        
        // Clean up script file
        try {
          fs.unlinkSync(scriptPath);
        } catch (e) {
          // Ignore cleanup errors
        }
      });
    });
  }

  /**
   * ⏸️ STOP AUTO-JOINER
   */
  stopAutoJoin(): void {
    if (this.currentProcess) {
      this.currentProcess.kill('SIGTERM');
      this.status = 'stopped';
      this.isRunning = false;
      this.logs.push('⏸️ Auto-join stopped by user');
    }
  }

  /**
   * 📊 GET AUTO-JOINER STATISTICS
   */
  getStats(): AutoJoinStats {
    return {
      isRunning: this.isRunning,
      status: this.status,
      totalGroups: this.totalGroups,
      joinedCount: this.joinedGroups.size,
      failedCount: this.failedGroups.size,
      joinedGroups: Array.from(this.joinedGroups),
      failedGroups: Array.from(this.failedGroups),
      logs: this.logs.slice(-50), // Last 50 log entries
      progress: this.totalGroups > 0 ? 
        ((this.joinedGroups.size + this.failedGroups.size) / this.totalGroups * 100) : 0
    };
  }

  /**
   * 📜 GET RECENT LOGS
   */
  getLogs(): string[] {
    return this.logs.slice(-100); // Last 100 log entries
  }

  /**
   * 🧹 CLEAR LOGS AND RESET STATS
   */
  reset(): void {
    if (this.isRunning) {
      throw new Error('Cannot reset while auto-joiner is running');
    }
    
    this.joinedGroups.clear();
    this.failedGroups.clear();
    this.logs = [];
    this.totalGroups = 0;
    this.status = 'idle';
  }
}

interface AutoJoinConfig {
  apiId: string;
  apiHash: string;
  phoneNumber: string;
  groupUrls: string[];
}

interface AutoJoinStats {
  isRunning: boolean;
  status: string;
  totalGroups: number;
  joinedCount: number;
  failedCount: number;
  joinedGroups: string[];
  failedGroups: string[];
  logs: string[];
  progress: number;
}

// Export singleton instance
export const telegramAutoJoiner = new TelegramAutoJoiner();