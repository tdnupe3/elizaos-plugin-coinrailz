import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="space-y-3 p-6 border rounded-lg">
      <Skeleton className="h-4 w-[250px]" />
      <Skeleton className="h-4 w-[200px]" />
      <Skeleton className="h-8 w-[150px]" />
    </div>
  );
}

export function TransactionSkeleton() {
  return (
    <div className="flex items-center justify-between p-3 border rounded-lg">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-[120px]" />
          <Skeleton className="h-3 w-[80px]" />
        </div>
      </div>
      <div className="text-right space-y-2">
        <Skeleton className="h-4 w-[80px]" />
        <Skeleton className="h-3 w-[60px]" />
      </div>
    </div>
  );
}

export function CryptoHoldingSkeleton() {
  return (
    <div className="flex items-center justify-between p-3">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-[100px]" />
          <Skeleton className="h-3 w-[80px]" />
        </div>
      </div>
      <div className="text-right space-y-2">
        <Skeleton className="h-4 w-[80px]" />
        <Skeleton className="h-3 w-[60px]" />
      </div>
    </div>
  );
}

export function BalanceCardSkeleton() {
  return (
    <div className="p-6 border rounded-lg space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-[120px]" />
        <Skeleton className="h-4 w-4" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-8 w-[140px]" />
        <Skeleton className="h-3 w-[100px]" />
      </div>
    </div>
  );
}