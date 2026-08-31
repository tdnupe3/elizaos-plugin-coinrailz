export interface Course {
  id: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration: string;
  modules: Module[];
  completionRate: number;
  rating: number;
  enrolledUsers: number;
}

export interface Module {
  id: string;
  title: string;
  description: string;
  content: string;
  videoUrl?: string;
  resources?: Resource[];
  quiz?: Quiz;
  estimatedTime: string;
}

export interface Resource {
  id: string;
  title: string;
  type: 'article' | 'video' | 'tool' | 'documentation';
  url: string;
  description: string;
}

export interface Quiz {
  id: string;
  questions: Question[];
  passingScore: number;
}

export interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export interface UserProgress {
  userId: string;
  courseId: string;
  completedModules: string[];
  currentModule: string;
  progress: number;
  score: number;
  certificates: string[];
}

export interface QASession {
  id: string;
  title: string;
  description: string;
  scheduledDate: Date;
  duration: string;
  instructor: string;
  maxParticipants: number;
  registeredUsers: string[];
  recordingUrl?: string;
}

export class SolanaEducationService {
  
  /**
   * 📚 Get all available courses
   */
  async getAllCourses(): Promise<Course[]> {
    const courses: Course[] = [
      {
        id: 'solana-basics-101',
        title: 'Solana Blockchain Fundamentals',
        description: 'Complete introduction to Solana blockchain, wallets, and basic concepts',
        difficulty: 'beginner',
        duration: '4 hours',
        modules: await this.getSolanaBasicsModules(),
        completionRate: 87,
        rating: 4.8,
        enrolledUsers: 2341
      },
      {
        id: 'defi-trading-mastery',
        title: 'Solana DeFi Trading Mastery',
        description: 'Advanced strategies for trading on Solana DEX protocols like Jupiter, Orca, and Raydium',
        difficulty: 'intermediate',
        duration: '6 hours',
        modules: await this.getDeFiTradingModules(),
        completionRate: 72,
        rating: 4.9,
        enrolledUsers: 1876
      },
      {
        id: 'risk-management-pro',
        title: 'Professional Risk Management',
        description: 'Advanced risk management strategies for Solana trading and DeFi protocols',
        difficulty: 'advanced',
        duration: '5 hours',
        modules: await this.getRiskManagementModules(),
        completionRate: 65,
        rating: 4.7,
        enrolledUsers: 934
      },
      {
        id: 'nft-gaming-guide',
        title: 'Solana NFT & Gaming Ecosystem',
        description: 'Complete guide to NFT trading, gaming tokens, and play-to-earn on Solana',
        difficulty: 'intermediate',
        duration: '3 hours',
        modules: await this.getNFTGamingModules(),
        completionRate: 81,
        rating: 4.6,
        enrolledUsers: 1523
      },
      {
        id: 'technical-analysis',
        title: 'Technical Analysis for Crypto',
        description: 'Professional technical analysis specifically for cryptocurrency and Solana tokens',
        difficulty: 'advanced',
        duration: '7 hours',
        modules: await this.getTechnicalAnalysisModules(),
        completionRate: 58,
        rating: 4.9,
        enrolledUsers: 756
      }
    ];

    console.log(`📚 Retrieved ${courses.length} courses`);
    return courses;
  }

  /**
   * 📖 Get specific course details
   */
  async getCourseById(courseId: string): Promise<Course | null> {
    const courses = await this.getAllCourses();
    const course = courses.find(c => c.id === courseId);
    
    if (course) {
      console.log(`📖 Retrieved course: ${course.title}`);
    } else {
      console.log(`❌ Course not found: ${courseId}`);
    }
    
    return course || null;
  }

  /**
   * 👤 Get user progress for a course
   */
  async getUserProgress(userId: string, courseId: string): Promise<UserProgress | null> {
    // Mock user progress (in production, fetch from database)
    const mockProgress: UserProgress = {
      userId,
      courseId,
      completedModules: ['module-1', 'module-2'],
      currentModule: 'module-3',
      progress: 45, // 45% complete
      score: 87,
      certificates: []
    };

    console.log(`👤 User ${userId} progress in ${courseId}: ${mockProgress.progress}%`);
    return mockProgress;
  }

  /**
   * ✅ Mark module as completed
   */
  async completeModule(userId: string, courseId: string, moduleId: string): Promise<boolean> {
    try {
      console.log(`✅ Marking module ${moduleId} complete for user ${userId}`);
      
      // In production, update database with completion
      // Check if user completed all modules, award certificate
      
      return true;
    } catch (error) {
      console.error('❌ Error completing module:', error);
      return false;
    }
  }

  /**
   * 📅 Get upcoming Q&A sessions
   */
  async getUpcomingQASessions(): Promise<QASession[]> {
    const now = new Date();
    const sessions: QASession[] = [
      {
        id: 'qa-solana-basics',
        title: 'Solana Basics Q&A Session',
        description: 'Ask questions about Solana fundamentals, wallets, and getting started',
        scheduledDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
        duration: '1 hour',
        instructor: 'Sarah Chen, Solana Developer',
        maxParticipants: 50,
        registeredUsers: [],
        recordingUrl: undefined
      },
      {
        id: 'qa-defi-advanced',
        title: 'Advanced DeFi Strategies',
        description: 'Deep dive into advanced DeFi trading strategies and protocol analysis',
        scheduledDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
        duration: '1.5 hours',
        instructor: 'Alex Rodriguez, DeFi Expert',
        maxParticipants: 30,
        registeredUsers: [],
        recordingUrl: undefined
      },
      {
        id: 'qa-risk-management',
        title: 'Risk Management Masterclass',
        description: 'Learn professional risk management techniques for crypto trading',
        scheduledDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
        duration: '2 hours',
        instructor: 'Michael Thompson, Risk Analyst',
        maxParticipants: 25,
        registeredUsers: [],
        recordingUrl: undefined
      }
    ];

    console.log(`📅 Found ${sessions.length} upcoming Q&A sessions`);
    return sessions;
  }

  /**
   * 📝 Register user for Q&A session
   */
  async registerForQASession(userId: string, sessionId: string): Promise<boolean> {
    try {
      console.log(`📝 Registering user ${userId} for session ${sessionId}`);
      
      // In production, check capacity and add user to session
      return true;
      
    } catch (error) {
      console.error('❌ Error registering for Q&A session:', error);
      return false;
    }
  }

  /**
   * 🏆 Award certificate to user
   */
  async awardCertificate(userId: string, courseId: string): Promise<string> {
    const certificateId = `cert_${courseId}_${userId}_${Date.now()}`;
    
    console.log(`🏆 Awarded certificate ${certificateId} to user ${userId}`);
    
    // In production, generate actual certificate and store in database
    return certificateId;
  }

  /**
   * 📚 Get Solana Basics course modules
   */
  private async getSolanaBasicsModules(): Promise<Module[]> {
    return [
      {
        id: 'module-1',
        title: 'What is Solana?',
        description: 'Understanding Solana blockchain fundamentals',
        content: 'Comprehensive introduction to Solana\'s unique architecture...',
        videoUrl: 'https://example.com/solana-intro',
        resources: [
          {
            id: 'resource-1',
            title: 'Official Solana Documentation',
            type: 'documentation',
            url: 'https://docs.solana.com',
            description: 'Complete Solana developer documentation'
          }
        ],
        quiz: {
          id: 'quiz-1',
          questions: [
            {
              id: 'q1',
              question: 'What makes Solana unique compared to other blockchains?',
              options: ['High speed', 'Low fees', 'Both high speed and low fees', 'Smart contracts'],
              correctAnswer: 2,
              explanation: 'Solana combines high transaction throughput with low fees'
            }
          ],
          passingScore: 80
        },
        estimatedTime: '45 minutes'
      },
      {
        id: 'module-2',
        title: 'Setting Up Your Solana Wallet',
        description: 'How to create and secure your Solana wallet',
        content: 'Step-by-step guide to wallet setup and security...',
        videoUrl: 'https://example.com/wallet-setup',
        resources: [
          {
            id: 'resource-2',
            title: 'Phantom Wallet Guide',
            type: 'tool',
            url: 'https://phantom.app',
            description: 'Popular Solana wallet browser extension'
          }
        ],
        estimatedTime: '30 minutes'
      }
    ];
  }

  /**
   * 💹 Get DeFi Trading course modules
   */
  private async getDeFiTradingModules(): Promise<Module[]> {
    return [
      {
        id: 'defi-module-1',
        title: 'Understanding Solana DeFi Ecosystem',
        description: 'Overview of major DeFi protocols on Solana',
        content: 'Deep dive into Jupiter, Orca, Raydium, and other protocols...',
        videoUrl: 'https://example.com/defi-overview',
        resources: [
          {
            id: 'defi-resource-1',
            title: 'Jupiter Exchange',
            type: 'tool',
            url: 'https://jup.ag',
            description: 'Best-in-class DEX aggregator for Solana'
          }
        ],
        estimatedTime: '60 minutes'
      },
      {
        id: 'defi-module-2',
        title: 'Advanced Trading Strategies',
        description: 'Professional trading techniques for Solana DeFi',
        content: 'Arbitrage, yield farming, and liquidity provision strategies...',
        estimatedTime: '90 minutes'
      }
    ];
  }

  /**
   * 🛡️ Get Risk Management course modules
   */
  private async getRiskManagementModules(): Promise<Module[]> {
    return [
      {
        id: 'risk-module-1',
        title: 'Portfolio Risk Assessment',
        description: 'How to evaluate and manage portfolio risk',
        content: 'Professional risk assessment techniques...',
        estimatedTime: '75 minutes'
      },
      {
        id: 'risk-module-2',
        title: 'Position Sizing and Stop Losses',
        description: 'Advanced position management strategies',
        content: 'Calculate optimal position sizes and exit strategies...',
        estimatedTime: '60 minutes'
      }
    ];
  }

  /**
   * 🎮 Get NFT Gaming course modules
   */
  private async getNFTGamingModules(): Promise<Module[]> {
    return [
      {
        id: 'nft-module-1',
        title: 'Solana NFT Marketplaces',
        description: 'Understanding Magic Eden, Tensor, and other NFT platforms',
        content: 'Complete guide to NFT trading on Solana...',
        estimatedTime: '45 minutes'
      },
      {
        id: 'nft-module-2',
        title: 'Gaming Token Economics',
        description: 'Understanding play-to-earn and gaming tokenomics',
        content: 'Analysis of successful gaming projects on Solana...',
        estimatedTime: '50 minutes'
      }
    ];
  }

  /**
   * 📈 Get Technical Analysis course modules
   */
  private async getTechnicalAnalysisModules(): Promise<Module[]> {
    return [
      {
        id: 'ta-module-1',
        title: 'Chart Patterns for Crypto',
        description: 'Essential chart patterns every trader should know',
        content: 'In-depth analysis of bullish and bearish patterns...',
        estimatedTime: '90 minutes'
      },
      {
        id: 'ta-module-2',
        title: 'Indicators and Oscillators',
        description: 'Using technical indicators effectively',
        content: 'RSI, MACD, Bollinger Bands, and custom crypto indicators...',
        estimatedTime: '75 minutes'
      },
      {
        id: 'ta-module-3',
        title: 'Volume Analysis',
        description: 'Understanding volume patterns in crypto markets',
        content: 'Volume-price analysis specific to cryptocurrency trading...',
        estimatedTime: '60 minutes'
      }
    ];
  }
}

export const solanaEducationService = new SolanaEducationService();