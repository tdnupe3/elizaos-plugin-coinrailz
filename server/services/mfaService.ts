import crypto from 'crypto';
import { storage } from '../storage';
import type { MfaVerificationCode, InsertMfaVerificationCode } from '@shared/mfa-schema';

export class MfaService {
  // Generate 6-digit verification code
  generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Create and store verification code
  async createVerificationCode(userId: string, method: 'email' | 'sms'): Promise<string> {
    const code = this.generateVerificationCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const verificationData: InsertMfaVerificationCode = {
      userId,
      code,
      method,
      verified: false,
      attempts: 0,
      expiresAt,
    };

    await storage.createMfaVerificationCode(verificationData);
    return code;
  }

  // Verify code entered by user
  async verifyCode(userId: string, code: string, method: 'email' | 'sms'): Promise<{ success: boolean; attempts: number }> {
    const verificationCode = await storage.getLatestMfaCode(userId, method);
    
    if (!verificationCode || verificationCode.expiresAt < new Date()) {
      return { success: false, attempts: 0 };
    }

    if (verificationCode.attempts >= 3) {
      return { success: false, attempts: verificationCode.attempts };
    }

    // Increment attempts
    await storage.incrementMfaCodeAttempts(verificationCode.id);

    const isValid = verificationCode.code === code;

    if (isValid) {
      await storage.markMfaCodeVerified(verificationCode.id);
    }

    return { success: isValid, attempts: verificationCode.attempts + 1 };
  }

  // Generate device fingerprint
  generateDeviceFingerprint(userAgent: string, ipAddress: string): string {
    const fingerprint = crypto
      .createHash('sha256')
      .update(`${userAgent}:${ipAddress}`)
      .digest('hex');
    return fingerprint;
  }

  // Check if device is trusted
  async isDeviceTrusted(userId: string, deviceFingerprint: string): Promise<boolean> {
    const device = await storage.getTrustedDevice(userId, deviceFingerprint);
    return device !== undefined && device.isActive && device.expiresAt > new Date();
  }

  // Add trusted device
  async addTrustedDevice(
    userId: string, 
    deviceFingerprint: string, 
    deviceName: string,
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await storage.createTrustedDevice({
      userId,
      deviceFingerprint,
      deviceName,
      ipAddress,
      userAgent,
      isActive: true,
      expiresAt,
    });
  }

  // Send SMS code (placeholder - requires Twilio integration)
  async sendSmsCode(phoneNumber: string, code: string): Promise<boolean> {
    // This would integrate with Twilio in production
    console.log(`SMS Code ${code} would be sent to ${phoneNumber}`);
    
    // For demo purposes, always return true
    // In production, check if TWILIO credentials are available
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      // Implement actual Twilio integration
      return true;
    }
    
    return true; // Demo mode
  }

  // Send email code (placeholder - requires SendGrid integration)
  async sendEmailCode(email: string, code: string): Promise<boolean> {
    // This would integrate with SendGrid in production
    console.log(`Email code ${code} would be sent to ${email}`);
    
    // For demo purposes, always return true
    // In production, check if SENDGRID credentials are available
    if (process.env.SENDGRID_API_KEY) {
      // Implement actual SendGrid integration
      return true;
    }
    
    return true; // Demo mode
  }
}

export const mfaService = new MfaService();