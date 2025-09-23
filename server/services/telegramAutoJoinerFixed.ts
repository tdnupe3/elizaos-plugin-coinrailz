import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

export class TelegramAutoJoinerFixed {
  private isRunning = false;
  private currentProcess: any = null;
  private joinedGroups = new Set<string>();
  private failedGroups = new Set<string>();
  private totalGroups = 0;
  private status = 'idle';
  private logs: string[] = [];
  private sessionFile: string = '';

  constructor() {
    this.sessionFile = path.join(process.cwd(), '.sessions', 'crypto_joiner.session');
    this.ensureSessionDirectory();
    console.log('🤖 Fixed Telegram Auto-Joiner service initialized');
  }

  private ensureSessionDirectory(): void {
    const sessionDir = path.dirname(this.sessionFile);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }
  }

  /**
   * 🚀 START AUTO-JOINING WITH IMPROVED AUTH FLOW
   */
  async startAutoJoin(config: AutoJoinConfig): Promise<void> {
    if (this.isRunning) {
      throw new Error('Auto-joiner is already running');
    }

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
      await this.executeAutoJoin(config);
    } catch (error: any) {
      this.status = 'failed';
      this.logs.push(`❌ Auto-join failed: ${error.message}`);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 🔧 EXECUTE AUTO-JOIN WITH PROPER ERROR HANDLING
   */
  private async executeAutoJoin(config: AutoJoinConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      this.status = 'running';
      
      // Create secure Python script with environment variables
      const env = {
        ...process.env,
        TELEGRAM_API_ID: config.apiId,
        TELEGRAM_API_HASH: config.apiHash,
        TELEGRAM_PHONE: config.phoneNumber,
        TELEGRAM_GROUPS: config.groupUrls.join('|'),
        TELEGRAM_SESSION_FILE: this.sessionFile
      };

      const pythonScript = this.createSecurePythonScript();
      
      this.currentProcess = spawn('python3', ['-c', pythonScript], { env });

      this.currentProcess.stdout.on('data', (data: Buffer) => {
        const output = data.toString().trim();
        console.log('Auto-joiner:', output);
        this.logs.push(output);
        this.parseOutput(output);
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
          reject(new Error(`Auto-join failed with exit code ${code}`));
        }
      });
    });
  }

  /**
   * 📜 CREATE SECURE PYTHON SCRIPT (NO PLAINTEXT FILES)
   */
  private createSecurePythonScript(): string {
    return `
import os
import sys
import asyncio
import random
import re
from pyrogram import Client
from pyrogram.errors import FloodWait, UserAlreadyParticipant, InviteHashExpired, PeerFlood

# Get credentials from environment variables
api_id = int(os.getenv('TELEGRAM_API_ID'))
api_hash = os.getenv('TELEGRAM_API_HASH')
phone_number = os.getenv('TELEGRAM_PHONE')
groups_str = os.getenv('TELEGRAM_GROUPS', '')
session_file = os.getenv('TELEGRAM_SESSION_FILE', 'crypto_joiner')

groups = [url.strip() for url in groups_str.split('|') if url.strip()]

if not all([api_id, api_hash, phone_number]):
    print("❌ Missing required environment variables")
    sys.exit(1)

if not groups:
    print("❌ No groups provided")
    sys.exit(1)

def extract_username(url):
    match = re.search(r't\\.me\\/([a-zA-Z0-9_]+)', url)
    return match.group(1) if match else None

app = Client(session_file, api_id=api_id, api_hash=api_hash, phone_number=phone_number)

async def join_channels():
    joined = 0
    failed = 0
    already_member = 0
    
    try:
        async with app:
            print(f"🚀 Starting to join {len(groups)} crypto groups...")
            
            for i, group_url in enumerate(groups, 1):
                username = extract_username(group_url)
                
                if not username:
                    print(f"❌ Invalid URL format: {group_url}")
                    failed += 1
                    continue
                
                try:
                    print(f"[{i}/{len(groups)}] Joining {group_url}...")
                    await app.join_chat(username)
                    joined += 1
                    print(f"✅ Successfully joined {group_url}")
                    
                except UserAlreadyParticipant:
                    print(f"⚠️ Already a member of {group_url}")
                    already_member += 1
                    
                except FloodWait as e:
                    print(f"⏳ Rate limited! Waiting {e.value} seconds...")
                    await asyncio.sleep(e.value)
                    # Retry this group
                    try:
                        await app.join_chat(username)
                        joined += 1
                        print(f"✅ Successfully joined {group_url} (after wait)")
                    except Exception as retry_error:
                        print(f"❌ Failed to join {group_url} after retry: {retry_error}")
                        failed += 1
                        
                except (InviteHashExpired, PeerFlood) as e:
                    print(f"❌ Cannot join {group_url}: {e}")
                    failed += 1
                    
                except Exception as e:
                    print(f"❌ Failed to join {group_url}: {e}")
                    failed += 1
                
                # Random delay between joins (5-10 minutes)
                if i < len(groups):
                    delay = random.randint(300, 600)
                    print(f"⏳ Waiting {delay} seconds before next group...")
                    await asyncio.sleep(delay)
        
        print(f"\\n🎉 Auto-join complete!")
        print(f"✅ Successfully joined: {joined}")
        print(f"⚠️ Already member: {already_member}")
        print(f"❌ Failed to join: {failed}")
        
    except Exception as e:
        print(f"❌ Fatal error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(join_channels())
`;
  }

  /**
   * 📊 PARSE OUTPUT AND UPDATE STATS
   */
  private parseOutput(output: string): void {
    if (output.includes('Successfully joined') || output.includes('joined') && output.includes('after wait')) {
      const match = output.match(/Successfully joined (.+?)(?:\\s|$)/);
      if (match) {
        this.joinedGroups.add(match[1]);
      }
    } else if (output.includes('Already a member')) {
      const match = output.match(/Already a member of (.+?)(?:\\s|$)/);
      if (match) {
        this.joinedGroups.add(match[1]); // Count as success for progress
      }
    } else if (output.includes('Failed to join') || output.includes('Cannot join')) {
      const match = output.match(/(?:Failed to join|Cannot join) (.+?):/);
      if (match) {
        this.failedGroups.add(match[1]);
      }
    }
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
    const progress = this.totalGroups > 0 ? 
      ((this.joinedGroups.size + this.failedGroups.size) / this.totalGroups * 100) : 0;

    return {
      isRunning: this.isRunning,
      status: this.status,
      totalGroups: this.totalGroups,
      joinedCount: this.joinedGroups.size,
      failedCount: this.failedGroups.size,
      joinedGroups: Array.from(this.joinedGroups),
      failedGroups: Array.from(this.failedGroups),
      logs: this.logs.slice(-50),
      progress: Math.min(progress, 100),
      hasSession: fs.existsSync(this.sessionFile)
    };
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

  /**
   * 🗑️ DELETE TELEGRAM SESSION (LOGOUT)
   */
  clearSession(): void {
    if (this.isRunning) {
      throw new Error('Cannot clear session while auto-joiner is running');
    }
    
    try {
      if (fs.existsSync(this.sessionFile)) {
        fs.unlinkSync(this.sessionFile);
        this.logs.push('🗑️ Telegram session cleared');
      }
    } catch (error) {
      console.error('Error clearing session:', error);
    }
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
  hasSession: boolean;
}

// Export singleton instance
export const telegramAutoJoinerFixed = new TelegramAutoJoinerFixed();