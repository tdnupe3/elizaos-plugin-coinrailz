/** @jsx React.createElement */
import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

// Simple error handler
window.addEventListener('error', (event) => {
  if (!event.message.includes('ChromeTransport') && !event.message.includes('vite')) {
    console.warn('Runtime error:', event.message);
  }
});

// Minimal App component to test React loading
function App() {
  return React.createElement('div', {
    style: {
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white'
    }
  }, [
    React.createElement('h1', { key: 'title' }, 'Coin Railz'),
    React.createElement('p', { key: 'subtitle' }, 'AI-Powered Fintech Platform'),
    React.createElement('p', { key: 'loading' }, 'Platform Initialized Successfully')
  ]);
}

const root = createRoot(document.getElementById("root")!);
root.render(React.createElement(App));
