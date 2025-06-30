/**
 * Service Delivery Core System
 * Handles file uploads, order tracking, and delivery verification
 */

import { storage } from '../storage';
import { nanoid } from 'nanoid';
import path from 'path';
import fs from 'fs/promises';

export interface DeliveryFile {
  id: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  uploadedAt: Date;
  virusScanned: boolean;
  scanResult: 'clean' | 'infected' | 'pending';
}

export interface OrderDelivery {
  id: string;
  orderId: string;
  agentId: string;
  customerId: string;
  files: DeliveryFile[];
  message: string;
  status: 'pending' | 'submitted' | 'under_review' | 'accepted' | 'rejected';
  submittedAt: Date;
  reviewedAt?: Date;
  customerFeedback?: string;
  qualityScore?: number;
}

export class ServiceDeliveryCore {
  private static uploadsDir = './uploads';

  static async initialize() {
    try {
      await fs.mkdir(this.uploadsDir, { recursive: true });
      console.log('Service delivery system initialized');
    } catch (error) {
      console.error('Failed to initialize service delivery:', error);
    }
  }

  /**
   * Upload delivery files for an order
   */
  static async uploadDeliveryFiles(
    orderId: string,
    agentId: string,
    files: Express.Multer.File[],
    message: string
  ): Promise<{ success: boolean; deliveryId?: string; error?: string }> {
    try {
      // Validate order exists and agent has permission
      const orders = await storage.getOrders();
      const order = orders.find(o => o.id === orderId && o.agentId === agentId);
      
      if (!order) {
        return { success: false, error: 'Order not found or access denied' };
      }

      if (order.status !== 'active' && order.status !== 'in_progress') {
        return { success: false, error: 'Order is not active for delivery' };
      }

      // Process uploaded files
      const deliveryFiles: DeliveryFile[] = [];
      
      for (const file of files) {
        const fileId = nanoid();
        const filename = `${fileId}_${file.originalname}`;
        const filepath = path.join(this.uploadsDir, filename);
        
        // Save file to disk
        await fs.writeFile(filepath, file.buffer);
        
        // Basic virus scan simulation (in production, integrate real antivirus)
        const virusScanned = await this.simulateVirusScan(filepath);
        
        deliveryFiles.push({
          id: fileId,
          filename,
          originalName: file.originalname,
          size: file.size,
          mimeType: file.mimetype,
          uploadedAt: new Date(),
          virusScanned: true,
          scanResult: virusScanned ? 'clean' : 'infected'
        });

        // Remove infected files immediately
        if (!virusScanned) {
          await fs.unlink(filepath);
        }
      }

      // Filter out infected files
      const cleanFiles = deliveryFiles.filter(f => f.scanResult === 'clean');
      
      if (cleanFiles.length === 0) {
        return { success: false, error: 'No clean files to deliver' };
      }

      // Create delivery record
      const deliveryId = nanoid();
      const delivery: OrderDelivery = {
        id: deliveryId,
        orderId,
        agentId,
        customerId: order.customerId,
        files: cleanFiles,
        message,
        status: 'submitted',
        submittedAt: new Date()
      };

      // Save delivery (in production, save to database)
      await this.saveDelivery(delivery);

      // Update order status
      await storage.updateOrderStatus(orderId, 'delivered');

      return { success: true, deliveryId };
    } catch (error) {
      console.error('File upload error:', error);
      return { success: false, error: 'Upload failed' };
    }
  }

  /**
   * Get delivery details
   */
  static async getDelivery(deliveryId: string): Promise<OrderDelivery | null> {
    try {
      return await this.loadDelivery(deliveryId);
    } catch (error) {
      console.error('Get delivery error:', error);
      return null;
    }
  }

  /**
   * Customer verification of delivery
   */
  static async verifyDelivery(
    deliveryId: string,
    customerId: string,
    confirmed: boolean,
    qualityScore?: number,
    feedback?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const delivery = await this.loadDelivery(deliveryId);
      
      if (!delivery) {
        return { success: false, error: 'Delivery not found' };
      }

      if (delivery.customerId !== customerId) {
        return { success: false, error: 'Access denied' };
      }

      // Update delivery status
      delivery.status = confirmed ? 'accepted' : 'rejected';
      delivery.reviewedAt = new Date();
      delivery.customerFeedback = feedback;
      delivery.qualityScore = qualityScore;

      await this.saveDelivery(delivery);

      // Update order status based on verification
      if (confirmed) {
        await storage.updateOrderStatus(delivery.orderId, 'completed');
        // Trigger payment release
        await this.releaseEscrowPayment(delivery.orderId);
      } else {
        await storage.updateOrderStatus(delivery.orderId, 'disputed');
      }

      return { success: true };
    } catch (error) {
      console.error('Verify delivery error:', error);
      return { success: false, error: 'Verification failed' };
    }
  }

  /**
   * Get order status and tracking info
   */
  static async getOrderTracking(orderId: string): Promise<any> {
    try {
      const orders = await storage.getOrders();
      const order = orders.find(o => o.id === orderId);
      
      if (!order) {
        return null;
      }

      // Get deliveries for this order
      const deliveries = await this.getOrderDeliveries(orderId);
      
      return {
        orderId,
        status: order.status,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        deliveries: deliveries.map(d => ({
          id: d.id,
          status: d.status,
          submittedAt: d.submittedAt,
          reviewedAt: d.reviewedAt,
          fileCount: d.files.length,
          message: d.message,
          qualityScore: d.qualityScore
        }))
      };
    } catch (error) {
      console.error('Get order tracking error:', error);
      return null;
    }
  }

  /**
   * Download delivery file
   */
  static async downloadFile(fileId: string, userId: string): Promise<{ filepath?: string; error?: string }> {
    try {
      // Find delivery containing this file
      const delivery = await this.findDeliveryByFileId(fileId);
      
      if (!delivery) {
        return { error: 'File not found' };
      }

      // Check access permissions
      if (delivery.customerId !== userId && delivery.agentId !== userId) {
        return { error: 'Access denied' };
      }

      const file = delivery.files.find(f => f.id === fileId);
      if (!file) {
        return { error: 'File not found' };
      }

      const filepath = path.join(this.uploadsDir, file.filename);
      
      // Check if file exists
      try {
        await fs.access(filepath);
        return { filepath };
      } catch {
        return { error: 'File no longer available' };
      }
    } catch (error) {
      console.error('Download file error:', error);
      return { error: 'Download failed' };
    }
  }

  // Private helper methods

  private static async simulateVirusScan(filepath: string): Promise<boolean> {
    // In production, integrate with real antivirus like ClamAV
    // For now, simulate scan by checking file extension
    const extension = path.extname(filepath).toLowerCase();
    const dangerousExtensions = ['.exe', '.scr', '.bat', '.com', '.cmd', '.pif'];
    
    return !dangerousExtensions.includes(extension);
  }

  private static async saveDelivery(delivery: OrderDelivery): Promise<void> {
    // In production, save to database
    // For now, save to file system as JSON
    const deliveryPath = path.join(this.uploadsDir, `delivery_${delivery.id}.json`);
    await fs.writeFile(deliveryPath, JSON.stringify(delivery, null, 2));
  }

  private static async loadDelivery(deliveryId: string): Promise<OrderDelivery | null> {
    try {
      const deliveryPath = path.join(this.uploadsDir, `delivery_${deliveryId}.json`);
      const data = await fs.readFile(deliveryPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  private static async getOrderDeliveries(orderId: string): Promise<OrderDelivery[]> {
    try {
      const files = await fs.readdir(this.uploadsDir);
      const deliveryFiles = files.filter(f => f.startsWith('delivery_') && f.endsWith('.json'));
      
      const deliveries: OrderDelivery[] = [];
      
      for (const file of deliveryFiles) {
        const delivery = await this.loadDelivery(file.replace('delivery_', '').replace('.json', ''));
        if (delivery && delivery.orderId === orderId) {
          deliveries.push(delivery);
        }
      }
      
      return deliveries;
    } catch {
      return [];
    }
  }

  private static async findDeliveryByFileId(fileId: string): Promise<OrderDelivery | null> {
    try {
      const files = await fs.readdir(this.uploadsDir);
      const deliveryFiles = files.filter(f => f.startsWith('delivery_') && f.endsWith('.json'));
      
      for (const file of deliveryFiles) {
        const delivery = await this.loadDelivery(file.replace('delivery_', '').replace('.json', ''));
        if (delivery && delivery.files.some(f => f.id === fileId)) {
          return delivery;
        }
      }
      
      return null;
    } catch {
      return null;
    }
  }

  private static async releaseEscrowPayment(orderId: string): Promise<void> {
    try {
      // In production, integrate with payment processor
      console.log(`Releasing escrow payment for order ${orderId}`);
      // Trigger agent payout and platform fee collection
    } catch (error) {
      console.error('Payment release error:', error);
    }
  }
}