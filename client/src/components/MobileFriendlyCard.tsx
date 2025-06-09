
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface MobileFriendlyCardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  compact?: boolean;
  touchOptimized?: boolean;
}

export function MobileFriendlyCard({ 
  title, 
  children, 
  className, 
  compact = false, 
  touchOptimized = true 
}: MobileFriendlyCardProps) {
  return (
    <Card className={cn(
      "w-full transition-all duration-200",
      touchOptimized && "touch-manipulation active:scale-[0.98]",
      compact ? "p-3" : "p-4",
      className
    )}>
      {title && (
        <CardHeader className={compact ? "pb-2" : "pb-3"}>
          <CardTitle className={cn(
            "text-lg font-semibold",
            compact && "text-base"
          )}>
            {title}
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className={cn(
        compact ? "pt-0" : "pt-2",
        "space-y-3"
      )}>
        {children}
      </CardContent>
    </Card>
  );
}

export default MobileFriendlyCard;
