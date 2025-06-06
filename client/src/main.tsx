import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Global error handling for unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  
  // Handle Chrome transport errors specifically
  if (event.reason?.message?.includes('ChromeTransport') || 
      event.reason?.name === 'ChromeTransport') {
    console.warn('Chrome transport connection issue - non-critical');
    event.preventDefault();
    return;
  }
  
  // Handle WebSocket connection errors
  if (event.reason?.message?.includes('WebSocket') || 
      event.reason?.type === 'error') {
    console.warn('WebSocket connection issue - attempting reconnection');
    event.preventDefault();
    return;
  }
  
  event.preventDefault(); // Prevent default browser behavior
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
