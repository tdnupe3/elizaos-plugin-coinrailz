/**
 * Comprehensive Deployment Verification
 * Tests actual production deployment functionality
 */

import http from 'http';
import { spawn } from 'child_process';

class DeploymentVerifier {
  constructor() {
    this.results = {
      buildArtifacts: false,
      serverStartup: false,
      healthEndpoints: false,
      staticServing: false,
      apiEndpoints: false,
      frontendLoad: false
    };
  }

  async verifyDeployment() {
    console.log('🔍 Verifying Production Deployment Functionality\n');

    try {
      await this.checkBuildArtifacts();
      await this.testProductionServer();
      this.generateReport();
    } catch (error) {
      console.error('Deployment verification failed:', error.message);
    }
  }

  async checkBuildArtifacts() {
    console.log('1. Checking build artifacts...');
    
    const { execSync } = await import('child_process');
    const fs = await import('fs');
    
    try {
      // Check if production build exists
      if (!fs.existsSync('dist/production-server.js')) {
        throw new Error('Production server not built');
      }
      
      if (!fs.existsSync('dist/public/index.html')) {
        throw new Error('Frontend assets not built');
      }

      const stats = fs.statSync('dist/public/assets');
      if (!stats.isDirectory()) {
        throw new Error('Assets directory missing');
      }

      console.log('✓ Build artifacts verified');
      this.results.buildArtifacts = true;
    } catch (error) {
      console.log('✗ Build artifacts check failed:', error.message);
    }
  }

  async testProductionServer() {
    console.log('2. Testing production server...');
    
    let serverProcess;
    try {
      // Start production server
      serverProcess = spawn('node', ['dist/production-server.js'], {
        env: { ...process.env, NODE_ENV: 'production', PORT: '5001' },
        stdio: ['ignore', 'pipe', 'pipe']
      });

      // Wait for startup
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Server startup timeout')), 10000);
        
        serverProcess.stdout.on('data', (data) => {
          if (data.toString().includes('Production server running')) {
            clearTimeout(timeout);
            this.results.serverStartup = true;
            console.log('✓ Production server started');
            resolve();
          }
        });

        serverProcess.stderr.on('data', (data) => {
          console.log('Server error:', data.toString());
        });
      });

      // Wait a moment for server to be ready
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Test endpoints
      await this.testEndpoints();

    } catch (error) {
      console.log('✗ Production server test failed:', error.message);
    } finally {
      if (serverProcess) {
        serverProcess.kill();
      }
    }
  }

  async testEndpoints() {
    const tests = [
      { name: 'Health Check', url: 'http://localhost:5001/health', test: 'healthEndpoints' },
      { name: 'API Health', url: 'http://localhost:5001/api/system/health', test: 'healthEndpoints' },
      { name: 'Frontend', url: 'http://localhost:5001/', test: 'frontendLoad' },
      { name: 'Demo User API', url: 'http://localhost:5001/api/demo/user', test: 'apiEndpoints' }
    ];

    for (const testCase of tests) {
      try {
        const response = await this.makeRequest('GET', testCase.url);
        
        if (testCase.name === 'Frontend') {
          if (response.includes('<html') || response.includes('<!DOCTYPE html>')) {
            console.log(`✓ ${testCase.name}: Static serving works`);
            this.results.staticServing = true;
            this.results.frontendLoad = true;
          }
        } else {
          const data = JSON.parse(response);
          if (data && (data.status || data.success || data.id)) {
            console.log(`✓ ${testCase.name}: API responding`);
            this.results[testCase.test] = true;
          }
        }
      } catch (error) {
        console.log(`✗ ${testCase.name}: Failed (${error.message})`);
      }
    }
  }

  makeRequest(method, url) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname,
        method: method,
        timeout: 5000
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      });

      req.on('error', reject);
      req.on('timeout', () => reject(new Error('Request timeout')));
      req.end();
    });
  }

  generateReport() {
    console.log('\n================================================================================');
    console.log('DEPLOYMENT VERIFICATION RESULTS');
    console.log('================================================================================\n');

    const tests = [
      { name: 'Build Artifacts', result: this.results.buildArtifacts },
      { name: 'Server Startup', result: this.results.serverStartup },
      { name: 'Health Endpoints', result: this.results.healthEndpoints },
      { name: 'Static File Serving', result: this.results.staticServing },
      { name: 'API Endpoints', result: this.results.apiEndpoints },
      { name: 'Frontend Loading', result: this.results.frontendLoad }
    ];

    let passed = 0;
    tests.forEach(test => {
      const status = test.result ? '✓ PASS' : '✗ FAIL';
      console.log(`${test.name.padEnd(25)} ${status}`);
      if (test.result) passed++;
    });

    const successRate = (passed / tests.length * 100).toFixed(1);
    console.log(`\nOverall Success Rate: ${passed}/${tests.length} (${successRate}%)`);

    if (successRate >= 80) {
      console.log('\n🎯 DEPLOYMENT STATUS: VERIFIED AND FUNCTIONAL');
      console.log('The platform successfully builds and runs in production mode.');
      console.log('Ready for live deployment on hosting platforms.');
    } else if (successRate >= 60) {
      console.log('\n⚠️  DEPLOYMENT STATUS: MOSTLY FUNCTIONAL');
      console.log('Platform works but has some issues to address.');
    } else {
      console.log('\n❌ DEPLOYMENT STATUS: NEEDS FIXES');
      console.log('Critical deployment issues need resolution.');
    }

    console.log('\nDeployment Commands:');
    console.log('  Build: node build-production.js');
    console.log('  Start: NODE_ENV=production node dist/production-server.js');
    console.log('  Port: 5000 (configurable via PORT environment variable)');
    
    console.log('\n================================================================================');
  }
}

const verifier = new DeploymentVerifier();
verifier.verifyDeployment();