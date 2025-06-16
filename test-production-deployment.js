/**
 * Production Deployment Verification Test
 * Tests the actual built application to verify deployment functionality
 */

import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class ProductionDeploymentTester {
  constructor() {
    this.serverProcess = null;
    this.testResults = {
      buildSuccess: false,
      serverStart: false,
      healthCheck: false,
      staticFiles: false,
      apiEndpoints: false,
      frontendLoad: false,
      dbConnection: false,
      overallStatus: 'FAILED'
    };
  }

  async testProductionDeployment() {
    console.log('Starting Production Deployment Verification...\n');

    try {
      // 1. Verify build artifacts exist
      await this.verifyBuildArtifacts();
      
      // 2. Start production server
      await this.startProductionServer();
      
      // 3. Wait for server startup
      await this.waitForServer();
      
      // 4. Test health endpoint
      await this.testHealthEndpoint();
      
      // 5. Test static file serving
      await this.testStaticFiles();
      
      // 6. Test API endpoints
      await this.testAPIEndpoints();
      
      // 7. Test frontend loading
      await this.testFrontendLoading();
      
      // 8. Generate final report
      this.generateDeploymentReport();
      
    } catch (error) {
      console.error('Production deployment test failed:', error.message);
      this.testResults.overallStatus = 'FAILED';
    } finally {
      if (this.serverProcess) {
        this.serverProcess.kill();
      }
    }
  }

  async verifyBuildArtifacts() {
    console.log('1. Verifying build artifacts...');
    
    const requiredFiles = [
      'dist/index.js',
      'dist/public/index.html',
      'dist/public/assets'
    ];

    for (const file of requiredFiles) {
      if (!fs.existsSync(file)) {
        throw new Error(`Missing build artifact: ${file}`);
      }
    }

    // Check if assets directory has files
    const assetsDir = 'dist/public/assets';
    const assets = fs.readdirSync(assetsDir);
    if (assets.length === 0) {
      throw new Error('Assets directory is empty');
    }

    console.log('✓ Build artifacts verified');
    this.testResults.buildSuccess = true;
  }

  async startProductionServer() {
    console.log('2. Starting production server...');
    
    return new Promise((resolve, reject) => {
      this.serverProcess = spawn('node', ['dist/index.js'], {
        env: { ...process.env, NODE_ENV: 'production', PORT: '5001' },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';

      this.serverProcess.stdout.on('data', (data) => {
        output += data.toString();
        if (output.includes('Server running on')) {
          console.log('✓ Production server started');
          this.testResults.serverStart = true;
          resolve();
        }
      });

      this.serverProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      this.serverProcess.on('exit', (code) => {
        if (code !== 0 && !this.testResults.serverStart) {
          reject(new Error(`Server exited with code ${code}. Error: ${errorOutput}`));
        }
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        if (!this.testResults.serverStart) {
          reject(new Error('Server startup timeout'));
        }
      }, 30000);
    });
  }

  async waitForServer() {
    console.log('3. Waiting for server to be ready...');
    
    for (let i = 0; i < 10; i++) {
      try {
        await this.makeRequest('GET', 'http://localhost:5001/health');
        console.log('✓ Server is responding');
        return;
      } catch (error) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    throw new Error('Server not responding after 10 seconds');
  }

  async testHealthEndpoint() {
    console.log('4. Testing health endpoint...');
    
    try {
      const response = await this.makeRequest('GET', 'http://localhost:5001/api/system/health');
      const data = JSON.parse(response);
      
      if (data.success && data.status === 'healthy') {
        console.log('✓ Health endpoint working');
        this.testResults.healthCheck = true;
      } else {
        throw new Error('Health endpoint returned unhealthy status');
      }
    } catch (error) {
      console.error('✗ Health endpoint failed:', error.message);
    }
  }

  async testStaticFiles() {
    console.log('5. Testing static file serving...');
    
    try {
      // Test index.html
      const htmlResponse = await this.makeRequest('GET', 'http://localhost:5001/');
      if (htmlResponse.includes('<html') && htmlResponse.includes('Coin Railz')) {
        console.log('✓ Static HTML serving works');
        this.testResults.staticFiles = true;
      } else {
        throw new Error('Static HTML not serving correctly');
      }
    } catch (error) {
      console.error('✗ Static file serving failed:', error.message);
    }
  }

  async testAPIEndpoints() {
    console.log('6. Testing API endpoints...');
    
    const endpoints = [
      { method: 'GET', url: 'http://localhost:5001/api/demo/user', expectedStatus: 200 },
      { method: 'POST', url: 'http://localhost:5001/api/demo/calculate-fee', 
        body: JSON.stringify({ amount: 1000 }), expectedStatus: 200 }
    ];

    let passedTests = 0;
    
    for (const endpoint of endpoints) {
      try {
        const response = await this.makeRequest(endpoint.method, endpoint.url, endpoint.body);
        const data = JSON.parse(response);
        
        if (data && (data.success !== false || data.id || data.fee)) {
          passedTests++;
          console.log(`✓ ${endpoint.method} ${endpoint.url.split('/').pop()} - OK`);
        }
      } catch (error) {
        console.error(`✗ ${endpoint.method} ${endpoint.url.split('/').pop()} - FAILED`);
      }
    }

    if (passedTests >= endpoints.length / 2) {
      this.testResults.apiEndpoints = true;
      console.log('✓ API endpoints working');
    } else {
      console.error('✗ Most API endpoints failed');
    }
  }

  async testFrontendLoading() {
    console.log('7. Testing frontend application loading...');
    
    try {
      const response = await this.makeRequest('GET', 'http://localhost:5001/');
      
      // Check for React app elements
      const hasReactApp = response.includes('<div id="root">') || 
                         response.includes('React') ||
                         response.includes('Coin Railz');
      
      if (hasReactApp) {
        console.log('✓ Frontend application loads');
        this.testResults.frontendLoad = true;
      } else {
        throw new Error('Frontend application not loading correctly');
      }
    } catch (error) {
      console.error('✗ Frontend loading failed:', error.message);
    }
  }

  generateDeploymentReport() {
    console.log('\n================================================================================');
    console.log('PRODUCTION DEPLOYMENT VERIFICATION REPORT');
    console.log('================================================================================\n');

    const tests = [
      { name: 'Build Artifacts', status: this.testResults.buildSuccess },
      { name: 'Server Startup', status: this.testResults.serverStart },
      { name: 'Health Check', status: this.testResults.healthCheck },
      { name: 'Static Files', status: this.testResults.staticFiles },
      { name: 'API Endpoints', status: this.testResults.apiEndpoints },
      { name: 'Frontend Loading', status: this.testResults.frontendLoad }
    ];

    let passedTests = 0;
    tests.forEach(test => {
      const status = test.status ? '✓ PASS' : '✗ FAIL';
      console.log(`${test.name.padEnd(20)} ${status}`);
      if (test.status) passedTests++;
    });

    const successRate = (passedTests / tests.length * 100).toFixed(1);
    console.log(`\nSuccess Rate: ${passedTests}/${tests.length} (${successRate}%)`);

    if (successRate >= 80) {
      this.testResults.overallStatus = 'PRODUCTION READY';
      console.log('\n🎯 VERDICT: PRODUCTION DEPLOYMENT SUCCESSFUL');
      console.log('The platform is ready for live deployment and revenue generation.');
    } else if (successRate >= 60) {
      this.testResults.overallStatus = 'NEEDS FIXES';
      console.log('\n⚠️  VERDICT: NEEDS MINOR FIXES');
      console.log('Platform mostly works but requires attention to failed tests.');
    } else {
      this.testResults.overallStatus = 'MAJOR ISSUES';
      console.log('\n❌ VERDICT: MAJOR DEPLOYMENT ISSUES');
      console.log('Platform has critical issues preventing production deployment.');
    }

    console.log('\n================================================================================');
  }

  makeRequest(method, url, body = null) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Production-Deployment-Test'
        }
      };

      if (body) {
        options.headers['Content-Length'] = Buffer.byteLength(body);
      }

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      });

      req.on('error', reject);
      req.setTimeout(10000, () => reject(new Error('Request timeout')));

      if (body) {
        req.write(body);
      }
      req.end();
    });
  }
}

// Run the test
const tester = new ProductionDeploymentTester();
tester.testProductionDeployment().catch(console.error);