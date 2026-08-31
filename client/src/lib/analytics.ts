// Define the gtag function globally
declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}

// Initialize Google Analytics with proper duplicate prevention
let gaInitialized = false;

export const initGA = () => {
  const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;

  if (!measurementId) {
    if (import.meta.env.DEV) {
      console.log('Google Analytics disabled in development mode');
    }
    return;
  }

  // Prevent duplicate initialization
  if (gaInitialized || document.querySelector(`script[src*="googletagmanager.com/gtag/js"]`)) {
    return;
  }

  // Add Google Analytics script to the head with proper load timing
  const script1 = document.createElement('script');
  script1.async = true;
  script1.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  
  // Initialize gtag and Core Web Vitals only after script loads
  script1.onload = () => {
    // Initialize gtag with proper global setup
    window.dataLayer = window.dataLayer || [];
    window.gtag = function() {
      window.dataLayer.push(arguments);
    };
    
    window.gtag('js', new Date());
    window.gtag('config', measurementId, {
      send_page_view: false, // Manually track page views for SPA
      custom_map: { 
        'dimension1': 'fintech_action',
        'dimension2': 'user_type', 
        'dimension3': 'service_type'
      },
      // Enhanced conversion tracking
      enhanced_conversions: true
    });

    gaInitialized = true;
    
    // Initialize Core Web Vitals tracking after GA is fully ready
    trackWebVitals();
  };
  
  document.head.appendChild(script1);
};

// Track page views - useful for single-page applications
export const trackPageView = (url: string) => {
  if (typeof window === 'undefined' || !window.gtag) return;
  
  const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;
  if (!measurementId) return;
  
  window.gtag('config', measurementId, {
    page_path: url,
    page_title: document.title
  });
};

// Track events
export const trackEvent = (
  action: string, 
  category?: string, 
  label?: string, 
  value?: number
) => {
  if (typeof window === 'undefined' || !window.gtag) return;
  
  window.gtag('event', action, {
    event_category: category,
    event_label: label,
    value: value,
  });
};

// Track business events for fintech analytics with proper GA4 ecommerce structure
export const trackBusinessEvent = (
  eventName: string,
  parameters: {
    currency?: string;
    value?: number;
    transaction_id?: string;
    payment_method?: string;
    user_type?: string;
    service_type?: string;
    source?: string;
    items?: Array<{
      item_id: string;
      item_name: string;
      item_category: string;
      price: number;
      quantity: number;
    }>;
  } = {}
) => {
  if (typeof window === 'undefined' || !window.gtag) return;
  
  // GA4-compliant ecommerce event structure with proper custom parameters
  const eventData: any = {
    currency: parameters.currency || 'USD',
    value: parameters.value || 0,
    payment_method: parameters.payment_method,
    // Use the exact custom parameter names defined in custom_map
    fintech_action: eventName,
    user_type: parameters.user_type,
    service_type: parameters.service_type,
    event_category: 'fintech',
    event_label: eventName
  };

  // Add transaction ID if provided
  if (parameters.transaction_id) {
    eventData.transaction_id = parameters.transaction_id;
  }

  // Add ecommerce items if provided
  if (parameters.items && parameters.items.length > 0) {
    eventData.items = parameters.items;
  }
  
  window.gtag('event', eventName, eventData);
};

// Enhanced conversion tracking for business flows
export const trackConversion = (
  conversionType: 'signup' | 'login' | 'payment' | 'agent_hire' | 'p2p_transfer',
  data: {
    value?: number;
    currency?: string;
    transaction_id?: string;
    user_id?: string;
    service_details?: any;
  } = {}
) => {
  trackBusinessEvent('conversion', {
    currency: data.currency || 'USD',
    value: data.value,
    transaction_id: data.transaction_id,
    service_type: conversionType,
    user_type: 'customer',
    items: data.service_details ? [{
      item_id: data.transaction_id || 'unknown',
      item_name: conversionType,
      item_category: 'fintech_service',
      price: data.value || 0,
      quantity: 1
    }] : undefined
  });
};

// Track Core Web Vitals for Google ranking with GA4-standard event naming
export const trackWebVitals = () => {
  if (typeof window === 'undefined' || !window.gtag) return;
  
  // Track Largest Contentful Paint (LCP) - GA4 standard event name
  const lcpObserver = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.entryType === 'largest-contentful-paint') {
        const value = Math.round(entry.startTime);
        const rating = value < 2500 ? 'good' : value < 4000 ? 'needs_improvement' : 'poor';
        window.gtag('event', 'lcp', {
          event_category: 'Web Vitals',
          value: value,
          non_interaction: true,
          fintech_action: 'core_web_vitals',
          user_type: 'visitor',
          service_type: 'performance_monitoring',
          metric_rating: rating
        });
      }
    }
  });
  
  // Track First Input Delay (FID) - GA4 standard event name
  const fidObserver = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const fidEntry = entry as any;
      if (fidEntry.processingStart) {
        const value = Math.round(fidEntry.processingStart - fidEntry.startTime);
        const rating = value < 100 ? 'good' : value < 300 ? 'needs_improvement' : 'poor';
        window.gtag('event', 'fid', {
          event_category: 'Web Vitals',
          value: value,
          non_interaction: true,
          fintech_action: 'core_web_vitals',
          user_type: 'visitor',
          service_type: 'performance_monitoring',
          metric_rating: rating
        });
      }
    }
  });
  
  // Track Cumulative Layout Shift (CLS) - GA4 standard event name
  const clsObserver = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const clsEntry = entry as any;
      if (!clsEntry.hadRecentInput) {
        const value = Math.round(clsEntry.value * 1000);
        const rating = value < 100 ? 'good' : value < 250 ? 'needs_improvement' : 'poor';
        window.gtag('event', 'cls', {
          event_category: 'Web Vitals',
          value: value,
          non_interaction: true,
          fintech_action: 'core_web_vitals',
          user_type: 'visitor',
          service_type: 'performance_monitoring',
          metric_rating: rating
        });
      }
    }
  });
  
  try {
    lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
    fidObserver.observe({ entryTypes: ['first-input'] });
    clsObserver.observe({ entryTypes: ['layout-shift'] });
  } catch (e) {
    console.log('Web Vitals tracking not supported in this browser');
  }
};