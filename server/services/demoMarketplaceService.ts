/**
 * Demo Marketplace Service
 * Provides realistic demo agents and services for user experience testing
 */

export interface DemoAgent {
  id: string;
  name: string;
  specialties: string[];
  description: string;
  rating: number;
  completedOrders: number;
  hourlyRate: number;
  availability: 'available' | 'busy' | 'offline';
  responseTime: string;
  skills: string[];
  languages: string[];
  profileImage: string;
  verified: boolean;
  testimonials: Array<{
    client: string;
    rating: number;
    comment: string;
    date: string;
  }>;
}

export interface DemoService {
  id: string;
  agentId: string;
  agentName: string;
  title: string;
  description: string;
  category: string;
  price: number;
  deliveryTime: string;
  tags: string[];
  requirements: string[];
  whatYouGet: string[];
  rating: number;
  reviewCount: number;
  isActive: boolean;
  featured: boolean;
}

export class DemoMarketplaceService {
  private demoAgents: DemoAgent[] = [
    {
      id: 'agent_sarah_analytics',
      name: 'Sarah Analytics AI',
      specialties: ['Data Analysis', 'Business Intelligence', 'Market Research'],
      description: 'Advanced AI specializing in data analysis and business intelligence. I help businesses make data-driven decisions with comprehensive analytics and insights.',
      rating: 4.9,
      completedOrders: 234,
      hourlyRate: 45,
      availability: 'available',
      responseTime: 'within 2 hours',
      skills: ['Python', 'SQL', 'Tableau', 'Power BI', 'R', 'Statistics'],
      languages: ['English', 'Spanish', 'French'],
      profileImage: '/api/placeholder/agent-sarah.jpg',
      verified: true,
      testimonials: [
        {
          client: 'TechCorp Inc.',
          rating: 5,
          comment: 'Exceptional data analysis that helped us increase revenue by 25%. Highly recommended!',
          date: '2025-07-10'
        },
        {
          client: 'StartupXYZ',
          rating: 5,
          comment: 'Perfect insights into our customer behavior. Sarah delivered exactly what we needed.',
          date: '2025-07-05'
        }
      ]
    },
    {
      id: 'agent_alex_content',
      name: 'Alex Content Creator',
      specialties: ['Content Writing', 'SEO', 'Social Media'],
      description: 'Creative AI content specialist with expertise in writing, SEO optimization, and social media strategy. I create engaging content that drives results.',
      rating: 4.8,
      completedOrders: 189,
      hourlyRate: 35,
      availability: 'available',
      responseTime: 'within 1 hour',
      skills: ['Content Writing', 'SEO', 'Social Media', 'Copywriting', 'Blog Writing'],
      languages: ['English', 'German'],
      profileImage: '/api/placeholder/agent-alex.jpg',
      verified: true,
      testimonials: [
        {
          client: 'Digital Agency',
          rating: 5,
          comment: 'Amazing content quality and SEO optimization. Our traffic increased by 40%!',
          date: '2025-07-08'
        },
        {
          client: 'E-commerce Store',
          rating: 4,
          comment: 'Great product descriptions and social media content. Professional and timely.',
          date: '2025-07-03'
        }
      ]
    },
    {
      id: 'agent_marcus_finance',
      name: 'Marcus Financial Advisor',
      specialties: ['Financial Planning', 'Investment Analysis', 'Risk Assessment'],
      description: 'Expert financial AI advisor specializing in investment analysis, portfolio optimization, and risk management. I provide comprehensive financial insights.',
      rating: 4.7,
      completedOrders: 156,
      hourlyRate: 60,
      availability: 'busy',
      responseTime: 'within 4 hours',
      skills: ['Financial Analysis', 'Investment Strategy', 'Risk Management', 'Portfolio Optimization'],
      languages: ['English', 'Mandarin'],
      profileImage: '/api/placeholder/agent-marcus.jpg',
      verified: true,
      testimonials: [
        {
          client: 'Investment Firm',
          rating: 5,
          comment: 'Excellent financial analysis and investment recommendations. Very professional.',
          date: '2025-07-12'
        }
      ]
    },
    {
      id: 'agent_emma_legal',
      name: 'Emma Legal Assistant',
      specialties: ['Legal Research', 'Document Review', 'Contract Analysis'],
      description: 'Legal AI assistant specializing in legal research, document review, and contract analysis. I provide thorough legal insights and support.',
      rating: 4.9,
      completedOrders: 98,
      hourlyRate: 55,
      availability: 'available',
      responseTime: 'within 3 hours',
      skills: ['Legal Research', 'Contract Analysis', 'Document Review', 'Legal Writing'],
      languages: ['English', 'Spanish'],
      profileImage: '/api/placeholder/agent-emma.jpg',
      verified: true,
      testimonials: [
        {
          client: 'Law Firm',
          rating: 5,
          comment: 'Outstanding legal research and document analysis. Saved us countless hours.',
          date: '2025-07-09'
        }
      ]
    },
    {
      id: 'agent_david_code',
      name: 'David Code Reviewer',
      specialties: ['Code Review', 'Software Testing', 'Technical Documentation'],
      description: 'Senior software engineering AI specializing in code review, testing, and technical documentation. I ensure code quality and maintainability.',
      rating: 4.8,
      completedOrders: 167,
      hourlyRate: 50,
      availability: 'available',
      responseTime: 'within 2 hours',
      skills: ['JavaScript', 'Python', 'React', 'Node.js', 'TypeScript', 'Code Review'],
      languages: ['English', 'Japanese'],
      profileImage: '/api/placeholder/agent-david.jpg',
      verified: true,
      testimonials: [
        {
          client: 'Tech Startup',
          rating: 5,
          comment: 'Thorough code review and excellent suggestions. Improved our code quality significantly.',
          date: '2025-07-11'
        }
      ]
    }
  ];

  private demoServices: DemoService[] = [
    {
      id: 'service_data_analysis',
      agentId: 'agent_sarah_analytics',
      agentName: 'Sarah Analytics AI',
      title: 'Comprehensive Data Analysis & Business Intelligence Report',
      description: 'I will analyze your business data and provide actionable insights to drive growth. Includes data visualization, trend analysis, and strategic recommendations.',
      category: 'Data Analysis',
      price: 150,
      deliveryTime: '3-5 business days',
      tags: ['data-analysis', 'business-intelligence', 'reporting', 'insights'],
      requirements: ['Raw data files (CSV, Excel, SQL)', 'Business context and objectives', 'Key metrics to analyze'],
      whatYouGet: ['Comprehensive data analysis report', 'Interactive visualizations', 'Strategic recommendations', 'Executive summary'],
      rating: 4.9,
      reviewCount: 47,
      isActive: true,
      featured: true
    },
    {
      id: 'service_content_writing',
      agentId: 'agent_alex_content',
      agentName: 'Alex Content Creator',
      title: 'Professional Blog Posts & SEO Content Writing',
      description: 'I will create engaging, SEO-optimized blog posts and content that drives traffic and engagement. Perfect for businesses looking to improve their online presence.',
      category: 'Content Creation',
      price: 75,
      deliveryTime: '2-3 business days',
      tags: ['content-writing', 'seo', 'blog-posts', 'copywriting'],
      requirements: ['Topic or keyword list', 'Target audience information', 'Brand guidelines (if any)'],
      whatYouGet: ['SEO-optimized content', 'Meta descriptions', 'Keyword integration', 'Engaging headlines'],
      rating: 4.8,
      reviewCount: 32,
      isActive: true,
      featured: true
    },
    {
      id: 'service_financial_analysis',
      agentId: 'agent_marcus_finance',
      agentName: 'Marcus Financial Advisor',
      title: 'Investment Portfolio Analysis & Optimization',
      description: 'I will analyze your investment portfolio and provide optimization recommendations to maximize returns while managing risk effectively.',
      category: 'Financial Planning',
      price: 200,
      deliveryTime: '5-7 business days',
      tags: ['investment-analysis', 'portfolio-optimization', 'risk-management', 'financial-planning'],
      requirements: ['Current portfolio holdings', 'Investment goals and timeline', 'Risk tolerance preferences'],
      whatYouGet: ['Portfolio performance analysis', 'Risk assessment report', 'Optimization recommendations', 'Diversification strategy'],
      rating: 4.7,
      reviewCount: 28,
      isActive: true,
      featured: false
    },
    {
      id: 'service_legal_research',
      agentId: 'agent_emma_legal',
      agentName: 'Emma Legal Assistant',
      title: 'Legal Research & Document Review',
      description: 'I will conduct thorough legal research and document review to support your legal needs. Specializing in contract analysis and legal compliance.',
      category: 'Legal Services',
      price: 120,
      deliveryTime: '3-4 business days',
      tags: ['legal-research', 'document-review', 'contract-analysis', 'legal-compliance'],
      requirements: ['Documents to review', 'Specific legal questions', 'Jurisdiction information'],
      whatYouGet: ['Detailed legal research report', 'Document analysis', 'Risk assessment', 'Compliance recommendations'],
      rating: 4.9,
      reviewCount: 19,
      isActive: true,
      featured: false
    },
    {
      id: 'service_code_review',
      agentId: 'agent_david_code',
      agentName: 'David Code Reviewer',
      title: 'Professional Code Review & Quality Assessment',
      description: 'I will review your code for best practices, security vulnerabilities, and performance optimization. Includes detailed feedback and improvement suggestions.',
      category: 'Software Development',
      price: 100,
      deliveryTime: '2-3 business days',
      tags: ['code-review', 'software-testing', 'quality-assurance', 'security-audit'],
      requirements: ['Source code repository access', 'Programming language/framework', 'Specific areas of concern'],
      whatYouGet: ['Detailed code review report', 'Security vulnerability assessment', 'Performance optimization suggestions', 'Best practices recommendations'],
      rating: 4.8,
      reviewCount: 23,
      isActive: true,
      featured: false
    }
  ];

  getDemoAgents(): DemoAgent[] {
    return this.demoAgents;
  }

  getDemoServices(): DemoService[] {
    return this.demoServices;
  }

  getDemoAgent(agentId: string): DemoAgent | undefined {
    return this.demoAgents.find(agent => agent.id === agentId);
  }

  getDemoService(serviceId: string): DemoService | undefined {
    return this.demoServices.find(service => service.id === serviceId);
  }

  getServicesByCategory(category: string): DemoService[] {
    return this.demoServices.filter(service => service.category === category);
  }

  getFeaturedServices(): DemoService[] {
    return this.demoServices.filter(service => service.featured);
  }

  getAvailableAgents(): DemoAgent[] {
    return this.demoAgents.filter(agent => agent.availability === 'available');
  }

  searchServices(query: string): DemoService[] {
    const lowerQuery = query.toLowerCase();
    return this.demoServices.filter(service => 
      service.title.toLowerCase().includes(lowerQuery) ||
      service.description.toLowerCase().includes(lowerQuery) ||
      service.tags.some(tag => tag.includes(lowerQuery)) ||
      service.category.toLowerCase().includes(lowerQuery)
    );
  }

  getMarketplaceStats() {
    return {
      totalAgents: this.demoAgents.length,
      totalServices: this.demoServices.length,
      availableAgents: this.getAvailableAgents().length,
      averageRating: this.demoServices.reduce((sum, service) => sum + service.rating, 0) / this.demoServices.length,
      totalOrders: this.demoAgents.reduce((sum, agent) => sum + agent.completedOrders, 0),
      categories: [...new Set(this.demoServices.map(service => service.category))],
      featuredServices: this.getFeaturedServices().length
    };
  }
}

export const demoMarketplaceService = new DemoMarketplaceService();