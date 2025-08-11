import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { X, Download, Smartphone, Wifi, WifiOff } from '@/lib/icons';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

export function ProgressiveWebApp() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showOfflineNotice, setShowOfflineNotice] = useState(false);

  useEffect(() => {
    // PWA install prompt handling
    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
      
      // Show install prompt after a short delay (not immediately on page load)
      setTimeout(() => {
        setShowInstallPrompt(true);
      }, 3000);
    };

    // Network status handling
    const handleOnline = () => {
      setIsOnline(true);
      setShowOfflineNotice(false);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowOfflineNotice(true);
    };

    // Service worker registration
    const registerServiceWorker = async () => {
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.register('/sw.js');
          console.log('Service Worker registered:', registration);

          // Listen for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New content is available, notify user
                  console.log('New content available - please refresh');
                }
              });
            }
          });
        } catch (error) {
          console.log('Service Worker registration failed:', error);
        }
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    registerServiceWorker();

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
      }
      
      setDeferredPrompt(null);
      setShowInstallPrompt(false);
    } catch (error) {
      console.error('Error during install prompt:', error);
    }
  };

  const dismissInstallPrompt = () => {
    setShowInstallPrompt(false);
    setDeferredPrompt(null);
  };

  const dismissOfflineNotice = () => {
    setShowOfflineNotice(false);
  };

  return (
    <>
      {/* Install Prompt */}
      {showInstallPrompt && deferredPrompt && (
        <div className="fixed top-4 right-4 z-50 max-w-sm">
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center">
                  <Smartphone className="w-5 h-5 text-blue-600 mr-2" />
                  <h3 className="font-semibold text-blue-900">Install Coin Railz</h3>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={dismissInstallPrompt}
                  className="h-6 w-6 p-0 text-blue-600 hover:text-blue-800"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              <p className="text-sm text-blue-800 mb-4">
                Install our app for faster access, offline support, and a native mobile experience.
              </p>
              
              <div className="flex space-x-2">
                <Button 
                  onClick={handleInstallClick}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Download className="w-4 h-4 mr-1" />
                  Install
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={dismissInstallPrompt}
                  className="border-blue-300 text-blue-700 hover:bg-blue-100"
                >
                  Not Now
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Offline Notice */}
      {showOfflineNotice && !isOnline && (
        <div className="fixed top-4 left-4 z-50 max-w-sm">
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center">
                  <WifiOff className="w-5 h-5 text-orange-600 mr-2" />
                  <h3 className="font-semibold text-orange-900">You're Offline</h3>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={dismissOfflineNotice}
                  className="h-6 w-6 p-0 text-orange-600 hover:text-orange-800"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              <p className="text-sm text-orange-800 mb-2">
                Some features may be limited. You can still browse cached content.
              </p>
              
              <div className="flex items-center text-xs text-orange-700">
                <WifiOff className="w-3 h-3 mr-1" />
                <span>Check your connection</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Connection Status Indicator */}
      <div className="fixed bottom-4 right-4 z-40">
        {!isOnline && (
          <div className="flex items-center bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-xs">
            <WifiOff className="w-3 h-3 mr-1" />
            <span>Offline</span>
          </div>
        )}
      </div>

      {/* Service Worker Update Prompt */}
      {/* This would be implemented based on specific update detection logic */}
    </>
  );
}

// Service Worker Registration Script (to be added to public/sw.js)
export const serviceWorkerScript = `
const CACHE_NAME = 'coin-railz-v1';
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
`;

// Web App Manifest Generator
export const generateManifest = () => ({
  name: "Coin Railz",
  short_name: "CoinRailz",
  description: "AI-Powered Fintech Platform for Cross-Platform P2P Payments and Cryptocurrency Gateway",
  start_url: "/",
  display: "standalone",
  theme_color: "#2563eb",
  background_color: "#ffffff",
  icons: [
    {
      src: "/icon-192x192.png",
      sizes: "192x192",
      type: "image/png"
    },
    {
      src: "/icon-512x512.png",
      sizes: "512x512",
      type: "image/png"
    }
  ],
  categories: ["finance", "business"],
  screenshots: [
    {
      src: "/screenshot-wide.png",
      sizes: "1280x720",
      type: "image/png",
      form_factor: "wide"
    },
    {
      src: "/screenshot-narrow.png", 
      sizes: "720x1280",
      type: "image/png",
      form_factor: "narrow"
    }
  ]
});