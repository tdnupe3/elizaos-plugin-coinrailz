
import { useEffect, useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

interface MobileKeyboardProps {
  children: React.ReactNode;
  adjustForKeyboard?: boolean;
}

export function MobileKeyboard({ children, adjustForKeyboard = true }: MobileKeyboardProps) {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!isMobile || !adjustForKeyboard) return;

    const handleResize = () => {
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      const windowHeight = window.innerHeight;
      const heightDifference = windowHeight - viewportHeight;

      if (heightDifference > 150) { // Keyboard is likely open
        setKeyboardHeight(heightDifference);
        setIsKeyboardOpen(true);
      } else {
        setKeyboardHeight(0);
        setIsKeyboardOpen(false);
      }
    };

    // Use Visual Viewport API if available
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
      return () => window.visualViewport?.removeEventListener('resize', handleResize);
    } else {
      // Fallback for older browsers
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, [isMobile, adjustForKeyboard]);

  if (!isMobile) {
    return <>{children}</>;
  }

  return (
    <div 
      className="transition-all duration-300 ease-in-out"
      style={{
        transform: isKeyboardOpen ? `translateY(-${Math.min(keyboardHeight / 2, 100)}px)` : 'translateY(0)',
        paddingBottom: isKeyboardOpen ? `${keyboardHeight}px` : '0'
      }}
    >
      {children}
    </div>
  );
}

export default MobileKeyboard;
