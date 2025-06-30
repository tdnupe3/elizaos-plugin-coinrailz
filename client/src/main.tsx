import { createRoot } from "react-dom/client";
import "./index.css";

// Simple debug app to test if React is working
function DebugApp() {
  return (
    <div style={{ 
      padding: '2rem', 
      textAlign: 'center',
      background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
      color: 'white',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚀 Coin Railz</h1>
      <p style={{ fontSize: '1.5rem', marginBottom: '2rem' }}>Platform Loading Successfully!</p>
      <div style={{ 
        background: 'rgba(255,255,255,0.1)', 
        padding: '1rem', 
        borderRadius: '8px',
        border: '1px solid rgba(255,255,255,0.2)'
      }}>
        <p>✅ React mounted successfully</p>
        <p>✅ Frontend system operational</p>
        <p>✅ Ready for full app restore</p>
      </div>
      <button 
        onClick={() => window.location.reload()}
        style={{
          marginTop: '2rem',
          padding: '1rem 2rem',
          background: '#10b981',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          fontSize: '1.1rem',
          cursor: 'pointer'
        }}
      >
        Refresh Platform
      </button>
    </div>
  );
}

try {
  const root = document.getElementById("root");
  if (!root) {
    throw new Error("Root element not found");
  }
  
  createRoot(root).render(<DebugApp />);
  console.log("✅ Debug app mounted successfully");
} catch (error) {
  console.error("❌ Failed to mount app:", error);
  document.body.innerHTML = `
    <div style="padding: 2rem; text-align: center; color: red;">
      <h1>Frontend Error</h1>
      <p>Error: ${error.message}</p>
    </div>
  `;
}
