/**
 * Customer Support Service
 * Complete ticketing system for production customer support operations
 */

import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface SupportTicket {
  id: string;
  userId: string;
  category: 'technical' | 'financial' | 'kyc' | 'agent' | 'general';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'pending_user' | 'resolved' | 'closed';
  subject: string;
  description: string;
  attachments?: string[];
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  satisfaction?: 1 | 2 | 3 | 4 | 5;
  tags: string[];
}

export interface SupportAgent {
  id: string;
  name: string;
  email: string;
  specializations: string[];
  status: 'available' | 'busy' | 'offline';
  activeTickets: number;
  maxTickets: number;
  avgResponseTime: number;
  satisfactionRating: number;
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  authorId: string;
  authorType: 'user' | 'agent' | 'system';
  message: string;
  timestamp: string;
  attachments?: string[];
  internal: boolean;
}

export interface SupportMetrics {
  totalTickets: number;
  openTickets: number;
  avgResponseTime: number;
  avgResolutionTime: number;
  satisfactionScore: number;
  ticketsByCategory: Record<string, number>;
  ticketsByPriority: Record<string, number>;
}

export class CustomerSupportService {
  private static instance: CustomerSupportService;
  private tickets: SupportTicket[] = [];
  private agents: SupportAgent[] = [];
  private messages: TicketMessage[] = [];

  constructor() {
    this.initializeDefaultAgents();
  }

  static getInstance(): CustomerSupportService {
    if (!CustomerSupportService.instance) {
      CustomerSupportService.instance = new CustomerSupportService();
    }
    return CustomerSupportService.instance;
  }

  /**
   * Create new support ticket
   */
  async createTicket(
    userId: string,
    category: SupportTicket['category'],
    subject: string,
    description: string,
    priority: SupportTicket['priority'] = 'medium',
    attachments?: string[]
  ): Promise<SupportTicket> {
    
    const ticketId = `ticket_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const ticket: SupportTicket = {
      id: ticketId,
      userId,
      category,
      priority,
      status: 'open',
      subject,
      description,
      attachments,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: this.generateAutoTags(subject, description, category)
    };

    // Auto-assign ticket based on category and agent availability
    const assignedAgent = this.assignTicketToAgent(ticket);
    if (assignedAgent) {
      ticket.assignedTo = assignedAgent.id;
      ticket.status = 'in_progress';
      assignedAgent.activeTickets++;
    }

    this.tickets.push(ticket);

    // Create initial system message
    await this.addMessage(ticketId, 'system', 'system', 
      `Ticket created and ${assignedAgent ? `assigned to ${assignedAgent.name}` : 'queued for assignment'}`);

    // Send automated response based on category
    await this.sendAutomatedResponse(ticket);

    console.log(`Support ticket created: ${ticketId} for user ${userId}`);
    return ticket;
  }

  /**
   * Add message to ticket
   */
  async addMessage(
    ticketId: string,
    authorId: string,
    authorType: TicketMessage['authorType'],
    message: string,
    attachments?: string[],
    internal: boolean = false
  ): Promise<TicketMessage> {
    
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const ticketMessage: TicketMessage = {
      id: messageId,
      ticketId,
      authorId,
      authorType,
      message,
      timestamp: new Date().toISOString(),
      attachments,
      internal
    };

    this.messages.push(ticketMessage);

    // Update ticket status
    const ticket = this.tickets.find(t => t.id === ticketId);
    if (ticket) {
      ticket.updatedAt = new Date().toISOString();
      
      // If user responds, change status from pending_user
      if (authorType === 'user' && ticket.status === 'pending_user') {
        ticket.status = 'in_progress';
      }
    }

    return ticketMessage;
  }

  /**
   * Update ticket status
   */
  async updateTicketStatus(
    ticketId: string,
    status: SupportTicket['status'],
    agentId?: string
  ): Promise<void> {
    
    const ticket = this.tickets.find(t => t.id === ticketId);
    if (!ticket) {
      throw new Error('Ticket not found');
    }

    const oldStatus = ticket.status;
    ticket.status = status;
    ticket.updatedAt = new Date().toISOString();

    if (status === 'resolved' || status === 'closed') {
      ticket.resolvedAt = new Date().toISOString();
      
      // Update agent availability
      if (ticket.assignedTo) {
        const agent = this.agents.find(a => a.id === ticket.assignedTo);
        if (agent) {
          agent.activeTickets = Math.max(0, agent.activeTickets - 1);
          agent.status = agent.activeTickets < agent.maxTickets ? 'available' : 'busy';
        }
      }
    }

    await this.addMessage(ticketId, agentId || 'system', 'system', 
      `Ticket status changed from ${oldStatus} to ${status}`);
  }

  /**
   * Assign ticket to agent
   */
  private assignTicketToAgent(ticket: SupportTicket): SupportAgent | null {
    // Find available agents with relevant specialization
    const availableAgents = this.agents.filter(agent => 
      agent.status === 'available' && 
      agent.activeTickets < agent.maxTickets &&
      (agent.specializations.includes(ticket.category) || agent.specializations.includes('general'))
    );

    if (availableAgents.length === 0) {
      return null;
    }

    // Prioritize by specialization, then by workload
    availableAgents.sort((a, b) => {
      const aHasSpecialization = a.specializations.includes(ticket.category) ? 1 : 0;
      const bHasSpecialization = b.specializations.includes(ticket.category) ? 1 : 0;
      
      if (aHasSpecialization !== bHasSpecialization) {
        return bHasSpecialization - aHasSpecialization;
      }
      
      return a.activeTickets - b.activeTickets;
    });

    return availableAgents[0];
  }

  /**
   * Send automated response based on ticket category
   */
  private async sendAutomatedResponse(ticket: SupportTicket): Promise<void> {
    let response = '';

    switch (ticket.category) {
      case 'kyc':
        response = 'Thank you for contacting us regarding KYC verification. Our compliance team will review your request within 24 hours. Please have your government-issued ID and proof of address ready if additional documentation is needed.';
        break;
      case 'financial':
        response = 'We have received your financial inquiry. For security purposes, we may need to verify your identity before discussing account details. Our financial support team will respond within 2 hours during business hours.';
        break;
      case 'technical':
        response = 'Thank you for reporting this technical issue. Our technical support team will investigate and respond within 4 hours. Please include any error messages or screenshots that might help us resolve this quickly.';
        break;
      case 'agent':
        response = 'We have received your AI agent marketplace inquiry. Our agent support specialists will review your request and respond within 8 hours with detailed assistance.';
        break;
      default:
        response = 'Thank you for contacting Coin Railz support. We have received your request and will respond within 24 hours. If this is urgent, please reply with "URGENT" in your message.';
    }

    await this.addMessage(ticket.id, 'system', 'system', response);
  }

  /**
   * Generate automatic tags for tickets
   */
  private generateAutoTags(subject: string, description: string, category: string): string[] {
    const tags = [category];
    const text = `${subject} ${description}`.toLowerCase();

    // Financial terms
    if (text.includes('payment') || text.includes('transaction') || text.includes('refund')) {
      tags.push('payment');
    }
    if (text.includes('wallet') || text.includes('balance')) {
      tags.push('wallet');
    }
    if (text.includes('crypto') || text.includes('bitcoin') || text.includes('ethereum')) {
      tags.push('cryptocurrency');
    }

    // Technical terms
    if (text.includes('error') || text.includes('bug') || text.includes('broken')) {
      tags.push('error');
    }
    if (text.includes('login') || text.includes('password') || text.includes('access')) {
      tags.push('authentication');
    }

    // Urgency indicators
    if (text.includes('urgent') || text.includes('emergency') || text.includes('critical')) {
      tags.push('urgent');
    }

    return [...new Set(tags)]; // Remove duplicates
  }

  /**
   * Get ticket by ID
   */
  getTicket(ticketId: string): SupportTicket | null {
    return this.tickets.find(t => t.id === ticketId) || null;
  }

  /**
   * Get tickets for user
   */
  getUserTickets(userId: string): SupportTicket[] {
    return this.tickets
      .filter(t => t.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Get messages for ticket
   */
  getTicketMessages(ticketId: string, includeInternal: boolean = false): TicketMessage[] {
    return this.messages
      .filter(m => m.ticketId === ticketId && (includeInternal || !m.internal))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  /**
   * Get support metrics
   */
  getSupportMetrics(): SupportMetrics {
    const now = new Date();
    const totalTickets = this.tickets.length;
    const openTickets = this.tickets.filter(t => ['open', 'in_progress', 'pending_user'].includes(t.status)).length;

    // Calculate average response time (time from ticket creation to first agent response)
    const responseTimeSum = this.tickets.reduce((sum, ticket) => {
      const firstAgentMessage = this.messages.find(m => 
        m.ticketId === ticket.id && m.authorType === 'agent'
      );
      if (firstAgentMessage) {
        const responseTime = new Date(firstAgentMessage.timestamp).getTime() - new Date(ticket.createdAt).getTime();
        return sum + responseTime;
      }
      return sum;
    }, 0);

    const ticketsWithResponse = this.tickets.filter(ticket => 
      this.messages.some(m => m.ticketId === ticket.id && m.authorType === 'agent')
    ).length;

    const avgResponseTime = ticketsWithResponse > 0 ? responseTimeSum / ticketsWithResponse : 0;

    // Calculate average resolution time
    const resolvedTickets = this.tickets.filter(t => t.resolvedAt);
    const resolutionTimeSum = resolvedTickets.reduce((sum, ticket) => {
      const resolutionTime = new Date(ticket.resolvedAt!).getTime() - new Date(ticket.createdAt).getTime();
      return sum + resolutionTime;
    }, 0);

    const avgResolutionTime = resolvedTickets.length > 0 ? resolutionTimeSum / resolvedTickets.length : 0;

    // Calculate satisfaction score
    const ticketsWithSatisfaction = this.tickets.filter(t => t.satisfaction);
    const satisfactionSum = ticketsWithSatisfaction.reduce((sum, t) => sum + (t.satisfaction || 0), 0);
    const satisfactionScore = ticketsWithSatisfaction.length > 0 ? satisfactionSum / ticketsWithSatisfaction.length : 0;

    // Count by category and priority
    const ticketsByCategory: Record<string, number> = {};
    const ticketsByPriority: Record<string, number> = {};

    this.tickets.forEach(ticket => {
      ticketsByCategory[ticket.category] = (ticketsByCategory[ticket.category] || 0) + 1;
      ticketsByPriority[ticket.priority] = (ticketsByPriority[ticket.priority] || 0) + 1;
    });

    return {
      totalTickets,
      openTickets,
      avgResponseTime: Math.round(avgResponseTime / (1000 * 60)), // Convert to minutes
      avgResolutionTime: Math.round(avgResolutionTime / (1000 * 60 * 60)), // Convert to hours
      satisfactionScore: Math.round(satisfactionScore * 100) / 100,
      ticketsByCategory,
      ticketsByPriority
    };
  }

  /**
   * Initialize default support agents
   */
  private initializeDefaultAgents(): void {
    this.agents = [
      {
        id: 'agent_sarah_kyc',
        name: 'Sarah Johnson',
        email: 'support@coinrailz.com',
        specializations: ['kyc', 'compliance', 'verification'],
        status: 'available',
        activeTickets: 0,
        maxTickets: 5,
        avgResponseTime: 45, // minutes
        satisfactionRating: 4.8
      },
      {
        id: 'agent_mike_tech',
        name: 'Mike Chen',
        email: 'support@coinrailz.com',
        specializations: ['technical', 'api', 'integration'],
        status: 'available',
        activeTickets: 0,
        maxTickets: 8,
        avgResponseTime: 25,
        satisfactionRating: 4.9
      },
      {
        id: 'agent_emma_financial',
        name: 'Emma Rodriguez',
        email: 'support@coinrailz.com',
        specializations: ['financial', 'payments', 'refunds'],
        status: 'available',
        activeTickets: 0,
        maxTickets: 6,
        avgResponseTime: 35,
        satisfactionRating: 4.7
      },
      {
        id: 'agent_alex_agent',
        name: 'Alex Kim',
        email: 'support@coinrailz.com',
        specializations: ['agent', 'marketplace', 'referrals'],
        status: 'available',
        activeTickets: 0,
        maxTickets: 10,
        avgResponseTime: 55,
        satisfactionRating: 4.6
      },
      {
        id: 'agent_lisa_general',
        name: 'Lisa Thompson',
        email: 'support@coinrailz.com',
        specializations: ['general', 'account', 'billing'],
        status: 'available',
        activeTickets: 0,
        maxTickets: 12,
        avgResponseTime: 40,
        satisfactionRating: 4.5
      }
    ];
  }

  /**
   * Submit satisfaction rating
   */
  async submitSatisfactionRating(ticketId: string, rating: 1 | 2 | 3 | 4 | 5): Promise<void> {
    const ticket = this.tickets.find(t => t.id === ticketId);
    if (!ticket) {
      throw new Error('Ticket not found');
    }

    if (ticket.status !== 'resolved' && ticket.status !== 'closed') {
      throw new Error('Ticket must be resolved to submit satisfaction rating');
    }

    ticket.satisfaction = rating;
    ticket.updatedAt = new Date().toISOString();

    // Update agent satisfaction rating
    if (ticket.assignedTo) {
      const agent = this.agents.find(a => a.id === ticket.assignedTo);
      if (agent) {
        // Calculate new average (simplified - in production would use proper weighted average)
        agent.satisfactionRating = (agent.satisfactionRating + rating) / 2;
      }
    }

    await this.addMessage(ticketId, 'system', 'system', 
      `Customer satisfaction rating submitted: ${rating}/5 stars`);
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: string): SupportAgent | null {
    return this.agents.find(a => a.id === agentId) || null;
  }

  /**
   * Get all agents
   */
  getAllAgents(): SupportAgent[] {
    return this.agents;
  }
}