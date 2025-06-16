import { useState, useEffect } from "react";
import { Bell, Check, X, Clock, AlertTriangle } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  isRead: boolean;
  createdAt: string;
  actionUrl?: string;
}

interface NotificationBellProps {
  isDemo?: boolean;
}

export function NotificationBell({ isDemo = false }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch notifications with proper error handling to prevent unhandled rejections
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: isDemo ? ['/api/demo/notifications'] : ['/api/notifications'],
    refetchInterval: false, // Disable automatic refetching to prevent excessive calls
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
    enabled: true,
    queryFn: async () => {
      try {
        const endpoint = isDemo ? '/api/demo/notifications' : '/api/notifications';
        const response = await fetch(endpoint, { credentials: 'include' });
        if (!response.ok) {
          console.warn(`Notifications fetch failed: ${response.status}`);
          return [];
        }
        return await response.json();
      } catch (error) {
        console.warn('Notifications fetch error:', error);
        return [];
      }
    }
  });

  // Fetch unread count with proper error handling
  const { data: unreadData } = useQuery({
    queryKey: isDemo ? ['/api/demo/notifications/unread-count'] : ['/api/notifications/unread-count'],
    refetchInterval: false, // Disable automatic refetching
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
    queryFn: async () => {
      try {
        const endpoint = isDemo ? '/api/demo/notifications/unread-count' : '/api/notifications/unread-count';
        const response = await fetch(endpoint, { credentials: 'include' });
        if (!response.ok) {
          console.warn(`Unread count fetch failed: ${response.status}`);
          return { count: 0 };
        }
        return await response.json();
      } catch (error) {
        console.warn('Unread count fetch error:', error);
        return { count: 0 };
      }
    }
  });

  // Mark notification as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      if (isDemo) {
        return { success: true }; // Demo version
      }
      return await apiRequest("POST", "/api/notifications/mark-read", { notificationId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to mark notification as read",
        variant: "destructive",
      });
    },
  });

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      if (isDemo) {
        return { success: true }; // Demo version
      }
      return await apiRequest("POST", "/api/notifications/mark-all-read");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
      toast({
        title: "Success",
        description: "All notifications marked as read",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to mark all notifications as read",
        variant: "destructive",
      });
    },
  });

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsReadMutation.mutate(notification.id);
    }
    
    if (notification.actionUrl) {
      window.location.href = notification.actionUrl;
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'high':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'medium':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-blue-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'border-l-red-500 bg-red-50 dark:bg-red-950';
      case 'high':
        return 'border-l-orange-500 bg-orange-50 dark:bg-orange-950';
      case 'medium':
        return 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950';
      default:
        return 'border-l-blue-500 bg-blue-50 dark:bg-blue-950';
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Demo notifications for demo version
  const demoNotifications: Notification[] = [
    {
      id: '1',
      type: 'transaction_completed',
      title: 'Payment Received',
      message: 'You received $250.00 USD from Alex Johnson',
      priority: 'high',
      isRead: false,
      createdAt: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
      actionUrl: '/demo-transaction-history'
    },
    {
      id: '2',
      type: 'ai_agent_activity',
      title: 'AI Agent Update: Crypto Signals Agent',
      message: 'New trading signal: BTC bullish trend detected',
      priority: 'medium',
      isRead: false,
      createdAt: new Date(Date.now() - 900000).toISOString(), // 15 minutes ago
      actionUrl: '/ai-agents'
    },
    {
      id: '3',
      type: 'referral_earned',
      title: 'Referral Reward Earned!',
      message: 'You earned $12.50 USD from AI agent referral',
      priority: 'high',
      isRead: true,
      createdAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      actionUrl: '/referrals'
    },
    {
      id: '4',
      type: 'system_announcement',
      title: 'Platform Update',
      message: 'New features added to the AI Agent Marketplace',
      priority: 'medium',
      isRead: true,
      createdAt: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
      actionUrl: '/ai-agent-marketplace'
    }
  ];

  const displayNotifications = isDemo ? demoNotifications : (notifications || []);
  const unreadCount = isDemo ? demoNotifications.filter(n => !n.isRead).length : ((unreadData as any)?.count || 0);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Notifications</CardTitle>
              {unreadCount > 0 && !isDemo && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => markAllAsReadMutation.mutate()}
                  disabled={markAllAsReadMutation.isPending}
                  className="text-xs"
                >
                  Mark all read
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-96">
              {isLoading ? (
                <div className="p-4 text-center text-muted-foreground">
                  Loading notifications...
                </div>
              ) : (notifications as any[])?.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  No notifications yet
                </div>
              ) : (
                <div className="space-y-2 p-2">
                  {(notifications as any[])?.map((notification: any) => (
                    <div
                      key={notification.id}
                      className={`p-3 rounded-lg border-l-4 cursor-pointer transition-colors hover:bg-muted/50 ${
                        getPriorityColor(notification.priority)
                      } ${notification.isRead ? 'opacity-60' : ''}`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {getPriorityIcon(notification.priority)}
                            <h4 className="font-medium text-sm truncate">
                              {notification.title}
                            </h4>
                            {!notification.isRead && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                            {notification.message}
                          </p>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">
                              {formatTime(notification.createdAt)}
                            </span>
                            {notification.isRead && (
                              <Check className="h-3 w-3 text-green-500" />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
}