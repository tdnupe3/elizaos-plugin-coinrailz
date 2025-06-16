import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

// Simple working React component
function App() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white'
    }}>
      <h1>Coin Railz</h1>
      <p>AI-Powered Fintech Platform</p>
      <p>Platform Loading Successfully</p>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
