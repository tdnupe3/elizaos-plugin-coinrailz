import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, DollarSign, TrendingUp, Clock } from "@/lib/icons";
// Using native date formatting instead of date-fns

interface PendingCommissions {
  totalPending: number;
  commissionCount: number;
  nextPayoutDate: Date;
  minimumThreshold: number;
}

interface SchedulerStatus {
  isRunning: boolean;
  nextPayoutDate: Date;
}

export function CommissionDashboard() {
  const { data: pendingCommissions, isLoading: commissionsLoading } = useQuery<PendingCommissions>({
    queryKey: ['/api/commissions/pending'],
  });

  const { data: schedulerStatus, isLoading: statusLoading } = useQuery<SchedulerStatus>({
    queryKey: ['/api/commissions/scheduler-status'],
  });

  if (commissionsLoading || statusLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="animate-pulse">
              <div className="h-4 bg-muted rounded w-3/4"></div>
              <div className="h-6 bg-muted rounded w-1/2"></div>
            </CardHeader>
            <CardContent className="animate-pulse">
              <div className="h-4 bg-muted rounded w-full"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const isEligibleForPayout = (pendingCommissions?.totalPending || 0) >= (pendingCommissions?.minimumThreshold || 10);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Pending Commissions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Commissions</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(pendingCommissions?.totalPending || 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              {pendingCommissions?.commissionCount || 0} referral(s) completed
            </p>
            {isEligibleForPayout ? (
              <Badge variant="default" className="mt-2">
                <TrendingUp className="h-3 w-3 mr-1" />
                Eligible for payout
              </Badge>
            ) : (
              <Badge variant="secondary" className="mt-2">
                <Clock className="h-3 w-3 mr-1" />
                Below minimum threshold
              </Badge>
            )}
          </CardContent>
        </Card>

        {/* Next Payout Date */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Next Payout</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {pendingCommissions?.nextPayoutDate 
                ? new Date(pendingCommissions.nextPayoutDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : 'TBD'
              }
            </div>
            <p className="text-xs text-muted-foreground">
              Weekly automatic payouts
            </p>
            <Badge variant={schedulerStatus?.isRunning ? "default" : "destructive"} className="mt-2">
              {schedulerStatus?.isRunning ? "Scheduler Active" : "Scheduler Inactive"}
            </Badge>
          </CardContent>
        </Card>

        {/* Minimum Threshold */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Minimum Payout</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${pendingCommissions?.minimumThreshold || 10}.00
            </div>
            <p className="text-xs text-muted-foreground">
              Required for weekly payout
            </p>
            <div className="mt-2">
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300" 
                  style={{ 
                    width: `${Math.min(100, ((pendingCommissions?.totalPending || 0) / (pendingCommissions?.minimumThreshold || 10)) * 100)}%` 
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {Math.round(((pendingCommissions?.totalPending || 0) / (pendingCommissions?.minimumThreshold || 10)) * 100)}% of minimum
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Commission Details */}
      <Card>
        <CardHeader>
          <CardTitle>Commission System Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="font-semibold mb-2">How It Works</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Earn 1% commission on referred user transactions</li>
                <li>• Commissions accumulate weekly</li>
                <li>• Automatic payouts every Monday</li>
                <li>• Minimum $10 threshold required</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Payment Method</h4>
              <p className="text-sm text-muted-foreground">
                Commissions are credited directly to your platform balance. 
                You can then withdraw to your connected wallet or use for platform transactions.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}