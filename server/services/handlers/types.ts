export interface ServiceRequest {
  limit?: number;
  active?: boolean;
  sortBy?: 'volume' | 'startDate';
  slug?: string;
  eventId?: string;
  query?: string;
  includeArchived?: boolean;
  exhaustive?: boolean;
  category?: string;
  eventTicker?: string;
  status?: string;
  ticker?: string;
  minConfidence?: 'high' | 'medium' | 'low';
  minSpreadPct?: number;
}

export interface ServiceHandler {
  execute(request: ServiceRequest): Promise<unknown>;
}