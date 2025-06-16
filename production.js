import { execSync } from 'child_process';

// Build if needed
try {
  execSync('vite build', { stdio: 'inherit' });
} catch (error) {
  console.log('Build failed, continuing with existing assets');
}

// Start production server
import('./start.js');