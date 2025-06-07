import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Comprehensive unhandled rejection prevention
window.addEventListener('unhandledrejection', (event) => {
  event.preventDefault(); // Always prevent unhandled rejections
  
  const reason = String(event.reason?.message || event.reason || '');
  
  // Only log non-development related errors
  const developmentErrors = [
    'ChromeTransport', 'connectChrome', 'MetaMask', 'Extension context',
    'WebSocket', 'vite', 'connecting', 'HMR', 'hot-reload', 'ws://localhost',
    'Loading chunk', 'Script error', 'fetch', 'network'
  ];
  
  const isDevelopmentError = developmentErrors.some(error => 
    reason.toLowerCase().includes(error.toLowerCase())
  );
  
  if (!isDevelopmentError && reason.trim()) {
    console.warn('Application promise rejected:', reason);
  }
});

createRoot(document.getElementById("root")!).render(<App />);
