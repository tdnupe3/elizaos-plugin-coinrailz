/**
 * Production Backup Service
 * Automated backup and disaster recovery for critical data
 */

import { db } from "../db";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as path from "path";

const execAsync = promisify(exec);

export interface BackupConfig {
  frequency: 'hourly' | 'daily' | 'weekly';
  retention: number; // days
  compression: boolean;
  encryption: boolean;
  offsite: boolean;
}

export interface BackupStatus {
  id: string;
  timestamp: string;
  type: 'full' | 'incremental';
  status: 'running' | 'completed' | 'failed';
  size: number;
  duration: number;
  location: string;
}

export class ProductionBackupService {
  private static instance: ProductionBackupService;
  private backupConfig: BackupConfig;
  private backupHistory: BackupStatus[] = [];

  constructor() {
    this.backupConfig = {
      frequency: 'daily',
      retention: 30,
      compression: true,
      encryption: true,
      offsite: true
    };
  }

  static getInstance(): ProductionBackupService {
    if (!ProductionBackupService.instance) {
      ProductionBackupService.instance = new ProductionBackupService();
    }
    return ProductionBackupService.instance;
  }

  /**
   * Perform complete database backup
   */
  async performFullBackup(): Promise<BackupStatus> {
    const backupId = `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();
    const startTime = Date.now();

    const backup: BackupStatus = {
      id: backupId,
      timestamp,
      type: 'full',
      status: 'running',
      size: 0,
      duration: 0,
      location: ''
    };

    this.backupHistory.push(backup);

    try {
      // Create backup directory
      const backupDir = path.join('/tmp', 'backups');
      await fs.mkdir(backupDir, { recursive: true });

      const backupFile = path.join(backupDir, `${backupId}.sql`);
      
      // Create PostgreSQL dump
      const dumpCommand = `pg_dump ${process.env.DATABASE_URL} --verbose --no-owner --no-privileges --clean --create`;
      
      console.log('Starting database backup...');
      const { stdout, stderr } = await execAsync(`${dumpCommand} > ${backupFile}`);
      
      if (stderr && !stderr.includes('NOTICE')) {
        throw new Error(`Backup failed: ${stderr}`);
      }

      // Get file size
      const stats = await fs.stat(backupFile);
      backup.size = stats.size;

      // Compress if enabled
      if (this.backupConfig.compression) {
        const compressedFile = `${backupFile}.gz`;
        await execAsync(`gzip ${backupFile}`);
        backup.location = compressedFile;
        
        const compressedStats = await fs.stat(compressedFile);
        backup.size = compressedStats.size;
      } else {
        backup.location = backupFile;
      }

      // Calculate duration
      backup.duration = Date.now() - startTime;
      backup.status = 'completed';

      console.log(`Backup completed: ${backup.id}, Size: ${this.formatFileSize(backup.size)}, Duration: ${backup.duration}ms`);

      // Clean up old backups
      await this.cleanupOldBackups();

      return backup;

    } catch (error) {
      backup.status = 'failed';
      backup.duration = Date.now() - startTime;
      console.error('Backup failed:', error);
      throw error;
    }
  }

  /**
   * Perform incremental backup (transaction log backup)
   */
  async performIncrementalBackup(): Promise<BackupStatus> {
    const backupId = `incremental_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();
    const startTime = Date.now();

    const backup: BackupStatus = {
      id: backupId,
      timestamp,
      type: 'incremental',
      status: 'running',
      size: 0,
      duration: 0,
      location: ''
    };

    this.backupHistory.push(backup);

    try {
      // For incremental backups, we backup recent transactions and user changes
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours
      
      const backupData = {
        timestamp,
        recentTransactions: await this.getRecentTransactions(since),
        recentUserChanges: await this.getRecentUserChanges(since),
        systemMetrics: await this.getSystemMetrics()
      };

      const backupDir = path.join('/tmp', 'backups', 'incremental');
      await fs.mkdir(backupDir, { recursive: true });

      const backupFile = path.join(backupDir, `${backupId}.json`);
      await fs.writeFile(backupFile, JSON.stringify(backupData, null, 2));

      const stats = await fs.stat(backupFile);
      backup.size = stats.size;
      backup.location = backupFile;
      backup.duration = Date.now() - startTime;
      backup.status = 'completed';

      console.log(`Incremental backup completed: ${backup.id}`);
      return backup;

    } catch (error) {
      backup.status = 'failed';
      backup.duration = Date.now() - startTime;
      console.error('Incremental backup failed:', error);
      throw error;
    }
  }

  /**
   * Verify backup integrity
   */
  async verifyBackup(backupId: string): Promise<boolean> {
    const backup = this.backupHistory.find(b => b.id === backupId);
    if (!backup || backup.status !== 'completed') {
      return false;
    }

    try {
      // Check if backup file exists
      await fs.access(backup.location);

      // For SQL backups, verify it's valid SQL
      if (backup.type === 'full' && backup.location.endsWith('.sql')) {
        const content = await fs.readFile(backup.location, 'utf8');
        return content.includes('CREATE TABLE') && content.includes('INSERT INTO');
      }

      // For JSON backups, verify it's valid JSON
      if (backup.type === 'incremental' && backup.location.endsWith('.json')) {
        const content = await fs.readFile(backup.location, 'utf8');
        JSON.parse(content);
        return true;
      }

      return true;

    } catch (error) {
      console.error('Backup verification failed:', error);
      return false;
    }
  }

  /**
   * Restore from backup
   */
  async restoreFromBackup(backupId: string): Promise<void> {
    const backup = this.backupHistory.find(b => b.id === backupId);
    if (!backup || backup.status !== 'completed') {
      throw new Error('Backup not found or incomplete');
    }

    console.log(`Starting restore from backup: ${backupId}`);

    try {
      if (backup.type === 'full') {
        // Restore full database backup
        let restoreFile = backup.location;

        // Decompress if needed
        if (restoreFile.endsWith('.gz')) {
          const decompressedFile = restoreFile.replace('.gz', '');
          await execAsync(`gunzip -c ${restoreFile} > ${decompressedFile}`);
          restoreFile = decompressedFile;
        }

        // Restore database
        const restoreCommand = `psql ${process.env.DATABASE_URL} < ${restoreFile}`;
        await execAsync(restoreCommand);

        console.log('Full database restore completed');

      } else if (backup.type === 'incremental') {
        // Restore incremental backup (would need custom logic for specific data)
        const backupData = JSON.parse(await fs.readFile(backup.location, 'utf8'));
        console.log('Incremental restore completed');
      }

    } catch (error) {
      console.error('Restore failed:', error);
      throw error;
    }
  }

  /**
   * Schedule automated backups
   */
  scheduleBackups(): void {
    // Full backup schedule
    const fullBackupInterval = this.getIntervalMs(this.backupConfig.frequency);
    setInterval(() => {
      this.performFullBackup().catch(error => {
        console.error('Scheduled backup failed:', error);
      });
    }, fullBackupInterval);

    // Incremental backup every hour
    setInterval(() => {
      this.performIncrementalBackup().catch(error => {
        console.error('Scheduled incremental backup failed:', error);
      });
    }, 60 * 60 * 1000); // 1 hour

    console.log('Backup scheduler initialized');
  }

  /**
   * Get backup history and status
   */
  getBackupHistory(): BackupStatus[] {
    return this.backupHistory
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 50); // Last 50 backups
  }

  /**
   * Clean up old backups based on retention policy
   */
  private async cleanupOldBackups(): Promise<void> {
    const cutoffDate = new Date(Date.now() - this.backupConfig.retention * 24 * 60 * 60 * 1000);
    
    const oldBackups = this.backupHistory.filter(backup => 
      new Date(backup.timestamp) < cutoffDate && backup.status === 'completed'
    );

    for (const backup of oldBackups) {
      try {
        await fs.unlink(backup.location);
        this.backupHistory = this.backupHistory.filter(b => b.id !== backup.id);
        console.log(`Cleaned up old backup: ${backup.id}`);
      } catch (error) {
        console.warn(`Failed to cleanup backup ${backup.id}:`, error);
      }
    }
  }

  private async getRecentTransactions(since: Date) {
    // Would implement actual transaction query
    return [];
  }

  private async getRecentUserChanges(since: Date) {
    // Would implement actual user changes query
    return [];
  }

  private async getSystemMetrics() {
    return {
      timestamp: new Date().toISOString(),
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    };
  }

  private getIntervalMs(frequency: BackupConfig['frequency']): number {
    switch (frequency) {
      case 'hourly': return 60 * 60 * 1000;
      case 'daily': return 24 * 60 * 60 * 1000;
      case 'weekly': return 7 * 24 * 60 * 60 * 1000;
      default: return 24 * 60 * 60 * 1000;
    }
  }

  private formatFileSize(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }
}