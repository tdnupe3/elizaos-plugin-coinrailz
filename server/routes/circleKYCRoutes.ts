/**
 * Circle KYC/AML Routes
 * Handles identity verification and compliance through Circle's KYC infrastructure
 */

import { Router } from 'express';
import { circleKYCService } from '../services/circleKYCService';
import { requireAuth } from '../middleware/requireAuth';
import multer from 'multer';
import { z } from 'zod';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5 // Maximum 5 files
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and PDF files are allowed.'));
    }
  }
});

// KYC verification request schema
const kycVerificationSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be in YYYY-MM-DD format'),
  country: z.string().length(2, 'Country must be a 2-letter ISO code'),
  address: z.object({
    street: z.string().min(1, 'Street address is required'),
    city: z.string().min(1, 'City is required'),
    state: z.string().optional(),
    postalCode: z.string().min(1, 'Postal code is required'),
    country: z.string().length(2, 'Country must be a 2-letter ISO code')
  }),
  phoneNumber: z.string().optional()
});

// All routes require authentication
router.use(requireAuth);

// Submit KYC verification
router.post('/submit', upload.array('documents', 5), async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'User not authenticated' });
    const userId = (req.user as unknown as { id: string }).id;
    const files = req.files as Express.Multer.File[];
    
    // Validate request body
    const validationResult = kycVerificationSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: validationResult.error.errors
      });
    }

    const data = validationResult.data;

    // Process uploaded documents
    const documents = files.map(file => ({
      documentType: file.fieldname as 'passport' | 'drivers_license' | 'national_id' | 'utility_bill' | 'bank_statement',
      fileData: file.buffer,
      fileName: file.originalname,
      contentType: file.mimetype
    }));

    if (documents.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one document is required'
      });
    }

    // Submit KYC verification
    const result = await circleKYCService.submitKYCVerification({
      userId,
      ...data,
      documents
    });

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json({
      success: true,
      verificationId: result.verificationId,
      status: result.status,
      message: 'KYC verification submitted successfully'
    });

  } catch (error) {
    console.error('KYC submission error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get KYC status
router.get('/status', async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'User not authenticated' });
    const userId = (req.user as unknown as { id: string }).id;
    const status = await circleKYCService.getKYCStatus(userId);
    
    if (!status) {
      return res.status(404).json({
        success: false,
        error: 'KYC status not found'
      });
    }

    res.json({
      success: true,
      status
    });

  } catch (error) {
    console.error('Error getting KYC status:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Check transaction permission
router.post('/check-permission', async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'User not authenticated' });
    const userId = (req.user as unknown as { id: string }).id;
    const { amount } = req.body;

    if (!amount || isNaN(parseFloat(amount))) {
      return res.status(400).json({
        success: false,
        error: 'Valid amount is required'
      });
    }

    const permission = await circleKYCService.checkTransactionPermission(userId, parseFloat(amount));
    
    res.json({
      success: true,
      permission
    });

  } catch (error) {
    console.error('Error checking transaction permission:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get KYC requirements for country
router.get('/requirements/:country', async (req, res) => {
  try {
    const { country } = req.params;
    
    if (!country || country.length !== 2) {
      return res.status(400).json({
        success: false,
        error: 'Valid 2-letter country code is required'
      });
    }

    const requirements = await circleKYCService.getKYCRequirements(country);
    
    res.json({
      success: true,
      requirements
    });

  } catch (error) {
    console.error('Error getting KYC requirements:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Generate KYC onboarding link
router.post('/generate-link', async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, error: 'User not authenticated' });
    const userId = (req.user as unknown as { id: string }).id;
    const result = await circleKYCService.generateKYCLink(userId);
    
    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json({
      success: true,
      kycUrl: result.kycUrl
    });

  } catch (error) {
    console.error('Error generating KYC link:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Update KYC status (webhook endpoint)
router.post('/webhook/status-update', async (req, res) => {
  try {
    const { userId, status, metadata } = req.body;
    
    if (!userId || !status) {
      return res.status(400).json({
        success: false,
        error: 'userId and status are required'
      });
    }

    const validStatuses = ['approved', 'rejected', 'review_required'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status'
      });
    }

    const result = await circleKYCService.updateKYCStatus(userId, status, metadata);
    
    if (!result) {
      return res.status(500).json({
        success: false,
        error: 'Failed to update KYC status'
      });
    }

    res.json({
      success: true,
      message: 'KYC status updated successfully'
    });

  } catch (error) {
    console.error('Error updating KYC status:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;