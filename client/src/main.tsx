import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Global error handling for unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  // Handle Chrome transport errors specifically
  if (event.reason?.message?.includes('ChromeTransport') || 
      event.reason?.name === 'ChromeTransport' ||
      event.reason?.stack?.includes('ChromeTransport')) {
    event.preventDefault();
    return;
  }
  
  // Handle WebSocket connection errors
  if (event.reason?.message?.includes('WebSocket') || 
      event.reason?.type === 'error' ||
      event.reason?.message?.includes('connectChrome')) {
    event.preventDefault();
    return;
  }
  
  // Handle Vite HMR connection errors
  if (event.reason?.message?.includes('vite') || 
      event.reason?.message?.includes('connecting') ||
      event.reason?.type === 'unhandledrejection') {
    event.preventDefault();
    return;
  }
  
  console.error('Unhandled promise rejection:', event.reason);
  event.preventDefault();
});

// Global error handling for general errors
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  
  // Handle script loading errors gracefully
  if (event.error?.message?.includes('Loading chunk')) {
    console.warn('Chunk loading error - may need refresh');
    return;
  }
});

createRoot(document.getElementById("root")!).render(<App />);
