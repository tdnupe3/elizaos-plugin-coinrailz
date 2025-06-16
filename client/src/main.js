// Bypass React plugin issue with pure JavaScript solution
import './index.css';

// Import the full React app component dynamically
async function loadApp() {
  try {
    const { default: App } = await import('./App.tsx');
    const React = await import('react');
    const { createRoot } = await import('react-dom/client');
    
    const root = createRoot(document.getElementById('root'));
    root.render(React.createElement(App));
  } catch (error) {
    console.error('Failed to load React app:', error);
    // Keep fallback content if React fails
  }
}

// Load the app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadApp);
} else {
  loadApp();
}