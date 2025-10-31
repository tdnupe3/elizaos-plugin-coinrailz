import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Star, TrendingUp, Users, Activity } from 'lucide-react';

interface Testimonial {
  id: number;
  agentName: string;
  agentType: string;
  rating: number;
  comment: string;
  transactionCount: number;
  source: string;
  verified: boolean;
  createdAt: string;
}

interface PlatformStats {
  totalTransactions: number;
  platformRating: string;
  totalReviews: number;
  activeAgents: number;
  uptime: string;
}

export function TestimonialsSection() {
  const { data: testimonialsData } = useQuery<{ success: boolean; testimonials?: Testimonial[]; avgRating?: string }>({
    queryKey: ['/api/testimonials'],
  });

  const { data: statsData } = useQuery<{ success: boolean; stats?: PlatformStats }>({
    queryKey: ['/api/platform/stats'],
  });

  const testimonials = testimonialsData?.testimonials || [];
  const stats = statsData?.stats;
  const avgRating = testimonialsData?.avgRating || '5.0';

  return (
    <div className="w-full bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-blue-950/20 py-16 px-6">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Header with Overall Rating */}
        <div className="text-center space-y-4">
          <h2 className="text-4xl font-bold font-[Space_Grotesk]" data-testid="testimonials-header">
            Trusted by AI Agents
          </h2>
          
          {/* Overall Rating Display */}
          <div className="flex items-center justify-center gap-3">
            <div className="text-6xl font-bold font-[Space_Grotesk] text-yellow-500" data-testid="platform-rating">
              {avgRating}
            </div>
            <div className="flex flex-col items-start">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className="w-6 h-6 fill-yellow-500 text-yellow-500"
                    data-testid={`star-${star}`}
                  />
                ))}
              </div>
              <div className="text-sm text-muted-foreground" data-testid="review-count">
                Based on {stats?.totalReviews || testimonials.length} reviews
              </div>
            </div>
          </div>

          {/* Platform Stats */}
          {stats && (
            <div className="flex flex-wrap items-center justify-center gap-8 pt-4">
              <div className="flex items-center gap-2 text-sm">
                <TrendingUp className="w-5 h-5 text-green-500" />
                <span className="font-semibold">{stats.totalTransactions.toLocaleString()}</span>
                <span className="text-muted-foreground">Transactions</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Users className="w-5 h-5 text-blue-500" />
                <span className="font-semibold">{stats.activeAgents.toLocaleString()}</span>
                <span className="text-muted-foreground">Active Agents</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Activity className="w-5 h-5 text-purple-500" />
                <span className="font-semibold">{stats.uptime}</span>
                <span className="text-muted-foreground">Uptime</span>
              </div>
            </div>
          )}
        </div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((testimonial) => (
            <Card
              key={testimonial.id}
              className="p-6 space-y-4 hover:shadow-xl transition-all border-2 hover:border-blue-200 dark:hover:border-blue-800"
              data-testid={`testimonial-${testimonial.id}`}
            >
              {/* Profile Section */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
                  {testimonial.agentName.charAt(0)}
                </div>
                <div>
                  <div className="font-semibold text-sm">{testimonial.agentName}</div>
                  <div className="text-xs text-muted-foreground">{testimonial.agentType}</div>
                </div>
                {testimonial.verified && (
                  <div className="ml-auto bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-full text-xs font-medium">
                    Verified
                  </div>
                )}
              </div>

              {/* Star Rating */}
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-4 h-4 ${
                      star <= testimonial.rating
                        ? 'fill-yellow-500 text-yellow-500'
                        : 'text-gray-300 dark:text-gray-600'
                    }`}
                  />
                ))}
              </div>

              {/* Quote */}
              <p className="text-sm leading-relaxed line-clamp-3" data-testid={`quote-${testimonial.id}`}>
                "{testimonial.comment}"
              </p>

              {/* Transaction Count Badge */}
              <div className="pt-3 border-t flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  Source: {testimonial.source}
                </div>
                <div className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 px-3 py-1 rounded-full text-xs font-semibold">
                  {testimonial.transactionCount} txns
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Trust Indicators */}
        <div className="text-center pt-8">
          <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
            Real feedback from AI agents in our community on Twitter and Telegram. 
            Join {stats?.activeAgents.toLocaleString() || '1,000+'} agents already using Coin Railz for seamless crypto payments.
          </p>
        </div>
      </div>
    </div>
  );
}
