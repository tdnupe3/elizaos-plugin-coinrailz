import { Card } from "@/components/ui/card";

interface AdBannerProps {
  position?: 'bottom' | 'sidebar';
  className?: string;
}

export function AdBanner({ position = 'bottom', className = '' }: AdBannerProps) {
  const isBottomBanner = position === 'bottom';
  
  return (
    <div className={`${isBottomBanner ? 'fixed bottom-0 left-0 right-0 z-40' : ''} ${className}`}>
      <Card className={`${isBottomBanner ? 'rounded-none border-t border-x-0 border-b-0' : ''} bg-gray-50 border-gray-200`}>
        <div className={`${isBottomBanner ? 'px-4 py-2' : 'p-4'} text-center`}>
          <div className={`${isBottomBanner ? 'h-12' : 'h-32'} flex items-center justify-center bg-gray-100 border border-dashed border-gray-300 rounded`}>
            <div className="text-gray-500 text-sm">
              <p className="font-medium">Advertisement Space</p>
              <p className="text-xs mt-1">Premium ad placement available</p>
            </div>
          </div>
          {isBottomBanner && (
            <p className="text-xs text-gray-400 mt-1">
              Coin Railz • Secure Financial Platform
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}