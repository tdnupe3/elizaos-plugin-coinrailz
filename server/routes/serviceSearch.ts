/**
 * ADVANCED SERVICE SEARCH & FILTERING SYSTEM
 * Comprehensive search capabilities for marketplace discovery
 */

import { Router } from 'express';
import { z } from 'zod';

const router = Router();

// Service data store
const services = new Map();
const categories = new Map();
const agentProfiles = new Map();

// Initialize sample data
function initializeServiceData() {
  // Service categories
  const serviceCategories = [
    { id: 'data-analysis', name: 'Data Analysis', description: 'AI-powered data insights and analytics' },
    { id: 'content-creation', name: 'Content Creation', description: 'AI writing and content generation' },
    { id: 'automation', name: 'Process Automation', description: 'Workflow and business process automation' },
    { id: 'financial-analysis', name: 'Financial Analysis', description: 'Financial modeling and analysis' },
    { id: 'code-review', name: 'Code Review', description: 'AI-assisted code analysis and optimization' },
    { id: 'consulting', name: 'AI Consulting', description: 'Strategic AI implementation guidance' },
    { id: 'research', name: 'Research & Insights', description: 'Market and competitive research' },
    { id: 'customer-service', name: 'Customer Service', description: 'AI customer support solutions' }
  ];

  serviceCategories.forEach(cat => categories.set(cat.id, cat));

  // Agent profiles
  const agents = [
    {
      id: 'agent_sarah_001',
      name: 'Sarah AI Analytics',
      specialization: 'Data Analysis',
      rating: 4.8,
      completedOrders: 127,
      hourlyRate: 75,
      projectMinimum: 200,
      skills: ['machine-learning', 'data-visualization', 'statistical-analysis', 'python', 'sql'],
      availability: 'Available',
      responseTime: '2 hours',
      languages: ['English', 'Spanish'],
      location: 'Remote',
      experience: '5+ years'
    },
    {
      id: 'agent_marcus_002',
      name: 'Marcus ML Expert',
      specialization: 'Financial Analysis',
      rating: 4.9,
      completedOrders: 89,
      hourlyRate: 95,
      projectMinimum: 300,
      skills: ['financial-modeling', 'risk-analysis', 'quantitative-analysis', 'excel', 'python'],
      availability: 'Available',
      responseTime: '1 hour',
      languages: ['English'],
      location: 'Remote',
      experience: '8+ years'
    },
    {
      id: 'agent_emma_003',
      name: 'Emma Content Pro',
      specialization: 'Content Creation',
      rating: 4.7,
      completedOrders: 203,
      hourlyRate: 65,
      projectMinimum: 150,
      skills: ['copywriting', 'content-strategy', 'seo', 'social-media', 'marketing'],
      availability: 'Busy',
      responseTime: '4 hours',
      languages: ['English', 'French'],
      location: 'Remote',
      experience: '6+ years'
    },
    {
      id: 'agent_david_004',
      name: 'David Automation',
      specialization: 'Process Automation',
      rating: 4.8,
      completedOrders: 156,
      hourlyRate: 85,
      projectMinimum: 250,
      skills: ['workflow-automation', 'zapier', 'api-integration', 'business-process', 'efficiency'],
      availability: 'Available',
      responseTime: '3 hours',
      languages: ['English', 'German'],
      location: 'Remote',
      experience: '7+ years'
    }
  ];

  agents.forEach(agent => agentProfiles.set(agent.id, agent));

  // Services
  const servicesList = [
    {
      id: 'svc_data_001',
      title: 'Advanced Sales Data Analysis',
      category: 'data-analysis',
      agentId: 'agent_sarah_001',
      price: 150,
      duration: '3-5 days',
      description: 'Comprehensive analysis of sales data to identify trends, patterns, and growth opportunities',
      features: ['Statistical analysis', 'Trend identification', 'Predictive modeling', 'Visual dashboards'],
      rating: 4.8,
      reviewCount: 45,
      deliveryFormat: 'Report + Dashboard',
      tags: ['sales', 'analytics', 'trends', 'forecasting']
    },
    {
      id: 'svc_content_001',
      title: 'SEO Content Strategy & Creation',
      category: 'content-creation',
      agentId: 'agent_emma_003',
      price: 200,
      duration: '5-7 days',
      description: 'Complete content strategy development with SEO-optimized content creation',
      features: ['Keyword research', 'Content calendar', 'SEO optimization', 'Performance tracking'],
      rating: 4.7,
      reviewCount: 32,
      deliveryFormat: 'Strategy Document + Content',
      tags: ['seo', 'content', 'marketing', 'strategy']
    },
    {
      id: 'svc_finance_001',
      title: 'Financial Risk Assessment Model',
      category: 'financial-analysis',
      agentId: 'agent_marcus_002',
      price: 350,
      duration: '7-10 days',
      description: 'Custom financial risk assessment model with scenario analysis and recommendations',
      features: ['Risk modeling', 'Scenario analysis', 'Monte Carlo simulation', 'Compliance review'],
      rating: 4.9,
      reviewCount: 28,
      deliveryFormat: 'Excel Model + Report',
      tags: ['finance', 'risk', 'modeling', 'compliance']
    },
    {
      id: 'svc_automation_001',
      title: 'Business Process Automation Setup',
      category: 'automation',
      agentId: 'agent_david_004',
      price: 275,
      duration: '5-8 days',
      description: 'End-to-end automation of repetitive business processes to increase efficiency',
      features: ['Process mapping', 'Automation setup', 'Integration testing', 'Training materials'],
      rating: 4.8,
      reviewCount: 41,
      deliveryFormat: 'Automation System + Documentation',
      tags: ['automation', 'efficiency', 'workflow', 'integration']
    }
  ];

  servicesList.forEach(service => services.set(service.id, service));
}

// Initialize data on module load
initializeServiceData();

// Search schema with string-to-number coercion for query parameters
const searchSchema = z.object({
  query: z.string().optional(),
  category: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  availability: z.enum(['Available', 'Busy', 'All']).optional(),
  skills: z.array(z.string()).optional(),
  sortBy: z.enum(['relevance', 'price_low', 'price_high', 'rating', 'popularity']).optional(),
  limit: z.coerce.number().min(1).max(50).default(20),
  offset: z.coerce.number().min(0).default(0)
});

// Advanced service search
router.get('/search', (req, res) => {
  try {
    const validation = searchSchema.safeParse(req.query);
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid search parameters',
        details: validation.error.issues
      });
    }

    const params = validation.data;
    let results = Array.from(services.values());

    // Apply filters
    if (params.query) {
      const queryLower = params.query.toLowerCase();
      results = results.filter(service => 
        service.title.toLowerCase().includes(queryLower) ||
        service.description.toLowerCase().includes(queryLower) ||
        service.tags.some((tag: string) => tag.toLowerCase().includes(queryLower))
      );
    }

    if (params.category) {
      results = results.filter(service => service.category === params.category);
    }

    if (params.minPrice !== undefined) {
      const minPrice = params.minPrice;
      results = results.filter(service => service.price >= minPrice);
    }

    if (params.maxPrice !== undefined) {
      const maxPrice = params.maxPrice;
      results = results.filter(service => service.price <= maxPrice);
    }

    if (params.minRating !== undefined) {
      const minRating = params.minRating;
      results = results.filter(service => service.rating >= minRating);
    }

    if (params.availability && params.availability !== 'All') {
      results = results.filter(service => {
        const agent = agentProfiles.get(service.agentId);
        return agent && agent.availability === params.availability;
      });
    }

    if (params.skills && params.skills.length > 0) {
      results = results.filter(service => {
        const agent = agentProfiles.get(service.agentId);
        if (!agent) return false;
        const skills = params.skills ?? [];
        return skills.some((skill: string) =>
          agent.skills.includes(skill) || 
          service.tags.includes(skill)
        );
      });
    }

    // Apply sorting
    if (params.sortBy) {
      switch (params.sortBy) {
        case 'price_low':
          results.sort((a, b) => a.price - b.price);
          break;
        case 'price_high':
          results.sort((a, b) => b.price - a.price);
          break;
        case 'rating':
          results.sort((a, b) => b.rating - a.rating);
          break;
        case 'popularity':
          results.sort((a, b) => b.reviewCount - a.reviewCount);
          break;
        default: // relevance - keep current order
          break;
      }
    }

    // Apply pagination
    const total = results.length;
    const paginatedResults = results.slice(params.offset, params.offset + params.limit);

    // Enrich results with agent data
    const enrichedResults = paginatedResults.map(service => {
      const agent = agentProfiles.get(service.agentId);
      return {
        ...service,
        agent: agent ? {
          id: agent.id,
          name: agent.name,
          rating: agent.rating,
          completedOrders: agent.completedOrders,
          availability: agent.availability,
          responseTime: agent.responseTime
        } : null
      };
    });

    res.json({
      success: true,
      data: {
        services: enrichedResults,
        pagination: {
          total,
          limit: params.limit,
          offset: params.offset,
          hasMore: params.offset + params.limit < total
        },
        filters: {
          query: params.query,
          category: params.category,
          priceRange: { min: params.minPrice, max: params.maxPrice },
          minRating: params.minRating,
          availability: params.availability,
          skills: params.skills,
          sortBy: params.sortBy
        }
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Search failed'
    });
  }
});

// Get all categories
router.get('/categories', (req, res) => {
  const categoryList = Array.from(categories.values()).map(cat => ({
    ...cat,
    serviceCount: Array.from(services.values()).filter(s => s.category === cat.id).length
  }));

  res.json({
    success: true,
    data: {
      categories: categoryList,
      total: categoryList.length
    }
  });
});

// Get popular search filters
router.get('/filters', (req, res) => {
  const allServices = Array.from(services.values());
  const allAgents = Array.from(agentProfiles.values());

  const filters = {
    priceRanges: [
      { label: 'Under $100', min: 0, max: 99, count: allServices.filter(s => s.price < 100).length },
      { label: '$100 - $200', min: 100, max: 200, count: allServices.filter(s => s.price >= 100 && s.price <= 200).length },
      { label: '$200 - $500', min: 200, max: 500, count: allServices.filter(s => s.price >= 200 && s.price <= 500).length },
      { label: 'Over $500', min: 500, max: 10000, count: allServices.filter(s => s.price > 500).length }
    ],
    ratings: [
      { label: '4.5+ Stars', value: 4.5, count: allServices.filter(s => s.rating >= 4.5).length },
      { label: '4.0+ Stars', value: 4.0, count: allServices.filter(s => s.rating >= 4.0).length },
      { label: '3.5+ Stars', value: 3.5, count: allServices.filter(s => s.rating >= 3.5).length }
    ],
    availability: [
      { label: 'Available Now', value: 'Available', count: allAgents.filter(a => a.availability === 'Available').length },
      { label: 'All Agents', value: 'All', count: allAgents.length }
    ],
    popularSkills: [
      'machine-learning', 'data-visualization', 'python', 'sql', 'financial-modeling',
      'content-strategy', 'seo', 'automation', 'api-integration', 'business-process'
    ],
    deliveryTime: [
      { label: '1-3 days', count: allServices.filter(s => s.duration.includes('1-3')).length },
      { label: '3-5 days', count: allServices.filter(s => s.duration.includes('3-5')).length },
      { label: '5-7 days', count: allServices.filter(s => s.duration.includes('5-7')).length },
      { label: '7+ days', count: allServices.filter(s => s.duration.includes('7-10') || s.duration.includes('10+')).length }
    ]
  };

  res.json({
    success: true,
    data: filters
  });
});

// Get service details
router.get('/service/:serviceId', (req, res) => {
  const { serviceId } = req.params;
  const service = services.get(serviceId);
  
  if (!service) {
    return res.status(404).json({
      success: false,
      error: 'Service not found'
    });
  }

  const agent = agentProfiles.get(service.agentId);
  
  res.json({
    success: true,
    data: {
      service: {
        ...service,
        agent: agent ? {
          id: agent.id,
          name: agent.name,
          specialization: agent.specialization,
          rating: agent.rating,
          completedOrders: agent.completedOrders,
          hourlyRate: agent.hourlyRate,
          skills: agent.skills,
          availability: agent.availability,
          responseTime: agent.responseTime,
          languages: agent.languages,
          experience: agent.experience
        } : null
      }
    }
  });
});

// Get trending searches
router.get('/trending', (req, res) => {
  const trending = {
    searches: [
      'data analysis',
      'content writing',
      'financial modeling',
      'process automation',
      'market research'
    ],
    categories: [
      'data-analysis',
      'content-creation',
      'financial-analysis'
    ],
    agents: [
      'agent_sarah_001',
      'agent_marcus_002',
      'agent_david_004'
    ]
  };

  res.json({
    success: true,
    data: trending
  });
});

// Search analytics
router.get('/analytics/search', (req, res) => {
  const analytics = {
    totalServices: services.size,
    totalAgents: agentProfiles.size,
    totalCategories: categories.size,
    averagePrice: Array.from(services.values()).reduce((sum, s) => sum + s.price, 0) / services.size,
    averageRating: Array.from(services.values()).reduce((sum, s) => sum + s.rating, 0) / services.size,
    mostPopularCategory: 'data-analysis',
    searchVolume: {
      daily: 1250,
      weekly: 8750,
      monthly: 37500
    },
    conversionRate: '12.5%'
  };

  res.json({
    success: true,
    data: analytics
  });
});

export default router;