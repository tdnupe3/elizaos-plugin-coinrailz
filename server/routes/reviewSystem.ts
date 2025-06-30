/**
 * REVIEW AND RATING SYSTEM
 * Complete feedback system for marketplace quality control
 */

import { Router } from 'express';
import { z } from 'zod';

const router = Router();

// Review storage
const reviews = new Map();
const reviewStats = new Map();

// Review schema
const reviewSchema = z.object({
  orderId: z.string().min(1, 'Order ID required'),
  customerId: z.string().min(1, 'Customer ID required'),
  agentId: z.string().min(1, 'Agent ID required'),
  rating: z.number().min(1).max(5, 'Rating must be between 1-5'),
  comment: z.string().min(10, 'Comment must be at least 10 characters').max(1000, 'Comment too long'),
  categories: z.object({
    communication: z.number().min(1).max(5).optional(),
    quality: z.number().min(1).max(5).optional(),
    timeliness: z.number().min(1).max(5).optional(),
    professionalism: z.number().min(1).max(5).optional()
  }).optional()
});

// Create review
router.post('/create', async (req, res) => {
  try {
    const validatedData = reviewSchema.parse(req.body);
    
    const reviewId = `review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const review = {
      id: reviewId,
      ...validatedData,
      createdAt: new Date().toISOString(),
      status: 'published',
      helpfulVotes: 0,
      flagged: false
    };
    
    reviews.set(reviewId, review);
    
    // Update agent rating statistics
    updateAgentStats(validatedData.agentId, validatedData.rating);
    
    // Trigger platform fee collection (2.5% of order value)
    await triggerReviewFeeCollection(validatedData.orderId, reviewId);
    
    res.json({
      success: true,
      data: {
        reviewId,
        review: {
          id: reviewId,
          rating: validatedData.rating,
          comment: validatedData.comment,
          createdAt: review.createdAt,
          status: 'published'
        },
        agentUpdatedRating: calculateAgentRating(validatedData.agentId)
      }
    });
    
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: 'Invalid review data',
      details: error.errors || error.message
    });
  }
});

// Get reviews for agent
router.get('/agent/:agentId', (req, res) => {
  const { agentId } = req.params;
  const { page = 1, limit = 10, rating } = req.query;
  
  let agentReviews = Array.from(reviews.values())
    .filter(review => review.agentId === agentId && review.status === 'published');
  
  // Filter by rating if specified
  if (rating) {
    agentReviews = agentReviews.filter(review => review.rating === Number(rating));
  }
  
  // Sort by most recent
  agentReviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  // Pagination
  const startIndex = (Number(page) - 1) * Number(limit);
  const paginatedReviews = agentReviews.slice(startIndex, startIndex + Number(limit));
  
  // Calculate rating distribution
  const ratingDistribution = {
    5: agentReviews.filter(r => r.rating === 5).length,
    4: agentReviews.filter(r => r.rating === 4).length,
    3: agentReviews.filter(r => r.rating === 3).length,
    2: agentReviews.filter(r => r.rating === 2).length,
    1: agentReviews.filter(r => r.rating === 1).length
  };
  
  res.json({
    success: true,
    data: {
      reviews: paginatedReviews.map(review => ({
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
        categories: review.categories,
        helpfulVotes: review.helpfulVotes
      })),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: agentReviews.length,
        totalPages: Math.ceil(agentReviews.length / Number(limit))
      },
      statistics: {
        averageRating: calculateAgentRating(agentId),
        totalReviews: agentReviews.length,
        ratingDistribution
      }
    }
  });
});

// Get reviews for order
router.get('/order/:orderId', (req, res) => {
  const { orderId } = req.params;
  
  const orderReviews = Array.from(reviews.values())
    .filter(review => review.orderId === orderId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  res.json({
    success: true,
    data: {
      reviews: orderReviews.map(review => ({
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
        agentId: review.agentId,
        customerId: review.customerId
      })),
      total: orderReviews.length
    }
  });
});

// Mark review as helpful
router.post('/:reviewId/helpful', (req, res) => {
  const { reviewId } = req.params;
  
  const review = reviews.get(reviewId);
  if (!review) {
    return res.status(404).json({
      success: false,
      error: 'Review not found'
    });
  }
  
  review.helpfulVotes = (review.helpfulVotes || 0) + 1;
  reviews.set(reviewId, review);
  
  res.json({
    success: true,
    data: {
      reviewId,
      helpfulVotes: review.helpfulVotes
    }
  });
});

// Flag review for moderation
router.post('/:reviewId/flag', (req, res) => {
  const { reviewId } = req.params;
  const { reason } = req.body;
  
  const review = reviews.get(reviewId);
  if (!review) {
    return res.status(404).json({
      success: false,
      error: 'Review not found'
    });
  }
  
  review.flagged = true;
  review.flagReason = reason;
  review.flaggedAt = new Date().toISOString();
  reviews.set(reviewId, review);
  
  res.json({
    success: true,
    data: {
      reviewId,
      status: 'flagged for moderation'
    }
  });
});

// Helper functions
function updateAgentStats(agentId: string, rating: number) {
  const stats = reviewStats.get(agentId) || { 
    totalRating: 0, 
    reviewCount: 0, 
    averageRating: 0,
    ratingHistory: []
  };
  
  stats.totalRating += rating;
  stats.reviewCount += 1;
  stats.averageRating = Number((stats.totalRating / stats.reviewCount).toFixed(2));
  stats.ratingHistory.push({
    rating,
    timestamp: new Date().toISOString()
  });
  
  // Keep only last 100 ratings for performance
  if (stats.ratingHistory.length > 100) {
    stats.ratingHistory = stats.ratingHistory.slice(-100);
  }
  
  reviewStats.set(agentId, stats);
}

function calculateAgentRating(agentId: string): number {
  const stats = reviewStats.get(agentId);
  return stats ? stats.averageRating : 0;
}

async function triggerReviewFeeCollection(orderId: string, reviewId: string) {
  // Platform collects 2.5% fee when review is submitted (completion verification)
  // This triggers the final fee collection for completed transactions
  try {
    console.log(`🏦 Fee collection triggered for order ${orderId} via review ${reviewId}`);
    
    // In production, this would:
    // 1. Calculate platform fee (25% commission)
    // 2. Process agent payout (75% of order value)
    // 3. Update financial records
    // 4. Send payment notifications
    
    return {
      success: true,
      feeCollected: true,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Fee collection error:', error);
    return { success: false, error: 'Fee collection failed' };
  }
}

// Get platform review analytics
router.get('/analytics/platform', (req, res) => {
  const allReviews = Array.from(reviews.values());
  const totalReviews = allReviews.length;
  
  if (totalReviews === 0) {
    return res.json({
      success: true,
      data: {
        totalReviews: 0,
        averageRating: 0,
        ratingDistribution: {},
        qualityMetrics: {}
      }
    });
  }
  
  const averageRating = allReviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews;
  
  const ratingDistribution = {
    5: allReviews.filter(r => r.rating === 5).length,
    4: allReviews.filter(r => r.rating === 4).length,
    3: allReviews.filter(r => r.rating === 3).length,
    2: allReviews.filter(r => r.rating === 2).length,
    1: allReviews.filter(r => r.rating === 1).length
  };
  
  const qualityScore = ((ratingDistribution[5] + ratingDistribution[4]) / totalReviews) * 100;
  
  res.json({
    success: true,
    data: {
      totalReviews,
      averageRating: Number(averageRating.toFixed(2)),
      ratingDistribution,
      qualityMetrics: {
        qualityScore: Number(qualityScore.toFixed(1)),
        highRatings: ratingDistribution[5] + ratingDistribution[4],
        lowRatings: ratingDistribution[1] + ratingDistribution[2]
      },
      recentActivity: allReviews
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10)
        .map(review => ({
          id: review.id,
          rating: review.rating,
          agentId: review.agentId,
          createdAt: review.createdAt
        }))
    }
  });
});

export default router;