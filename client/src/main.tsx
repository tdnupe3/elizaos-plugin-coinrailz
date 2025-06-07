import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initializeGlobalPromiseHandler } from "./utils/promiseHandler";

// Initialize comprehensive promise handler
initializeGlobalPromiseHandler();

// Enhanced global error handling for unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  // Suppress all development-related connection errors and API rate limiting
  const suppressedErrors = [
    'ChromeTransport',
    'connectChrome',
    'WebSocket',
    'vite',
    'connecting',
    'HMR',
    'hot-reload',
    'ws://localhost',
    '429',
    'rate limit',
    'too many requests',
    '403',
    'forbidden',
    'ip blocked',
    '502',
    'bad gateway',
    'network stats',
    'api/public/network',
    'fetch'
  ];
  
  const errorMessage = String(event.reason?.message || event.reason || '');
  const errorName = String(event.reason?.name || '');
  const errorStack = String(event.reason?.stack || '');
  
  // Check if this is a suppressible error
  const isSuppressibleError = suppressedErrors.some(keyword => 
    errorMessage.toLowerCase().includes(keyword.toLowerCase()) ||
    errorName.toLowerCase().includes(keyword.toLowerCase()) ||
    errorStack.toLowerCase().includes(keyword.toLowerCase())
  );
  
  if (isSuppressibleError) {
    event.preventDefault();
    return;
  }
  
  // Only log genuine application errors
  console.error('Application error:', event.reason);
  event.preventDefault();
});

// Global error handling for general errors
window.addEventListener('error', (event) => {
  // Suppress development-related errors
  const suppressedErrors = [
    'ChromeTransport',
    'connectChrome',
    'WebSocket',
    'vite',
    'connecting',
    'HMR',
    'hot-reload',
    'Script error',
    'Loading chunk'
  ];
  
  const errorMessage = String(event.message || event.error?.message || '');
  const errorFilename = String(event.filename || '');
  
  const isDevelopmentError = suppressedErrors.some(keyword => 
    errorMessage.toLowerCase().includes(keyword.toLowerCase()) ||
    errorFilename.toLowerCase().includes(keyword.toLowerCase())
  );
  
  if (isDevelopmentError) {
    event.preventDefault();
    return;
  }
  
  console.error('Application error:', event.error);
});

createRoot(document.getElementById("root")!).render(<App />);
