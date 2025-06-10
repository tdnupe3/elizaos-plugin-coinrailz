/**
 * Single, simple error handling system
 */

let isInitialized = false;

export function initializeErrorHandling() {
  if (isInitialized) return;

  // Simple promise rejection handler
  window.addEventListener('unhandledrejection', (event) => {
    event.preventDefault();

    const reason = String(event.reason?.message || event.reason || '');

    // Only filter out development noise
    const isDevNoise = [
      'ChromeTransport', 'vite', 'WebSocket', 'HMR', 'Script error'
    ].some(keyword => reason.includes(keyword));

    if (!isDevNoise && reason.trim()) {
      console.warn('Promise rejection:', reason);
    }
  });

  // Simple error handler
  window.addEventListener('error', (event) => {
    const message = event.message || '';

    if (!message.includes('ChromeTransport') && !message.includes('vite')) {
      console.warn('Runtime error:', message);
    }
  });

  isInitialized = true;
}

export function cleanupErrorHandling() {
  // No cleanup needed - simple handlers
}