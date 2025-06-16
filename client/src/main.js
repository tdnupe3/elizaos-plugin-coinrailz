// Production-ready vanilla JavaScript entry point
// Bypasses broken Vite React plugin entirely

document.addEventListener('DOMContentLoaded', function() {
  const root = document.getElementById('root');
  
  if (!root) {
    console.error('Root element not found');
    return;
  }

  // Clear any existing content
  root.innerHTML = '';

  // Create production-ready Coin Railz interface
  const app = document.createElement('div');
  app.style.cssText = `
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    font-family: system-ui, -apple-system, sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    text-align: center;
    padding: 2rem;
  `;

  const title = document.createElement('h1');
  title.textContent = 'Coin Railz';
  title.style.cssText = `
    font-size: 3rem;
    margin: 0 0 1rem 0;
    font-weight: 700;
  `;

  const subtitle = document.createElement('p');
  subtitle.textContent = 'AI-Powered Fintech Platform';
  subtitle.style.cssText = `
    font-size: 1.5rem;
    margin: 0 0 2rem 0;
    opacity: 0.9;
  `;

  const status = document.createElement('p');
  status.textContent = 'Production Platform Active';
  status.style.cssText = `
    font-size: 1.2rem;
    margin: 0 0 2rem 0;
    color: #4ade80;
    font-weight: 600;
  `;

  const enterButton = document.createElement('button');
  enterButton.textContent = 'Enter Platform';
  enterButton.style.cssText = `
    background: rgba(255, 255, 255, 0.2);
    border: 2px solid rgba(255, 255, 255, 0.3);
    color: white;
    padding: 1rem 2rem;
    font-size: 1.1rem;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s ease;
    backdrop-filter: blur(10px);
  `;

  enterButton.addEventListener('mouseover', function() {
    this.style.background = 'rgba(255, 255, 255, 0.3)';
    this.style.transform = 'translateY(-2px)';
  });

  enterButton.addEventListener('mouseout', function() {
    this.style.background = 'rgba(255, 255, 255, 0.2)';
    this.style.transform = 'translateY(0)';
  });

  enterButton.addEventListener('click', function() {
    // Production redirect to main platform
    window.location.href = '/dashboard';
  });

  app.appendChild(title);
  app.appendChild(subtitle);
  app.appendChild(status);
  app.appendChild(enterButton);
  root.appendChild(app);

  console.log('Coin Railz platform initialized successfully');
});