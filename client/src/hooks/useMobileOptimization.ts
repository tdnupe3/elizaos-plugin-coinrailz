import { useState, useEffect, useCallback } from 'react';
import { useIsMobile } from './use-mobile';

export function useMobileOptimization() {
  const isMobile = useIsMobile();
  const [isPortrait, setIsPortrait] = useState(true);
  const [safeAreaInsets, setSafeAreaInsets] = useState({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0
  });

  // Detect orientation changes
  useEffect(() => {
    const checkOrientation = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };

    checkOrientation();
    window.addEventListener('orientationchange', checkOrientation);
    window.addEventListener('resize', checkOrientation);

    return () => {
      window.removeEventListener('orientationchange', checkOrientation);
      window.removeEventListener('resize', checkOrientation);
    };
  }, []);

  // Calculate safe area insets
  useEffect(() => {
    if (isMobile) {
      const computedStyle = getComputedStyle(document.documentElement);
      setSafeAreaInsets({
        top: parseInt(computedStyle.getPropertyValue('--safe-area-inset-top') || '0'),
        bottom: parseInt(computedStyle.getPropertyValue('--safe-area-inset-bottom') || '0'),
        left: parseInt(computedStyle.getPropertyValue('--safe-area-inset-left') || '0'),
        right: parseInt(computedStyle.getPropertyValue('--safe-area-inset-right') || '0'),
      });
    }
  }, [isMobile]);

  // Haptic feedback
  const triggerHaptic = useCallback((type: 'light' | 'medium' | 'heavy' = 'light') => {
    if ('vibrate' in navigator && isMobile) {
      const patterns = {
        light: 10,
        medium: 20,
        heavy: 50
      };
      navigator.vibrate(patterns[type]);
    }
  }, [isMobile]);

  // Prevent zoom on double tap
  const preventZoom = useCallback((element: HTMLElement) => {
    if (isMobile) {
      element.addEventListener('touchend', (e) => {
        e.preventDefault();
        e.target?.dispatchEvent(new MouseEvent('click', {
          bubbles: true,
          cancelable: true
        }));
      }, { passive: false });
    }
  }, [isMobile]);

  // Enhanced Progressive Web App features for scaling
  const enablePWA = useCallback(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          setIsPWAEnabled(true);

          // Enable background sync for offline transactions
          if ('sync' in window.ServiceWorkerRegistration.prototype) {
            registration.sync.register('background-transaction-sync');
          }

          // Enable push notifications for transaction alerts
          if ('PushManager' in window) {
            registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: process.env.VITE_VAPID_PUBLIC_KEY
            });
          }
        })
        .catch(console.error);
    }
  }, []);

  return {
    isMobile,
    isPortrait,
    safeAreaInsets,
    triggerHaptic,
    preventZoom
  };
}