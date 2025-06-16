/**
 * Environment Configuration Setup for Coin Railz Production
 * Interactive script to configure environment variables
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');

class EnvironmentSetup {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    this.envVars = {};
    this.requiredVars = [
      'NODE_ENV',
      'DATABASE_URL',
      'STRIPE_SECRET_KEY',
      'REPLIT_CLIENT_ID',
      'REPLIT_CLIENT_SECRET'
    ];
  }

  ask(question) {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer.trim());
      });
    });
  }

  async setupEnvironment() {
    console.log('🔧 Coin Railz Production Environment Setup\n');
    
    // Set NODE_ENV
    this.envVars.NODE_ENV = 'production';
    console.log('✓ NODE_ENV set to production');

    // Check for existing database
    if (process.env.DATABASE_URL) {
      this.envVars.DATABASE_URL = process.env.DATABASE_URL;
      console.log('✓ Using existing DATABASE_URL');
    } else {
      console.log('⚠️  DATABASE_URL not found in current environment');
      const dbUrl = await this.ask('Enter production DATABASE_URL (or press Enter to skip): ');
      if (dbUrl) {
        this.envVars.DATABASE_URL = dbUrl;
      }
    }

    // Domain configuration
    this.envVars.REPLIT_DOMAINS = 'coinrailz.com,www.coinrailz.com';
    this.envVars.FRONTEND_URL = 'https://coinrailz.com';
    this.envVars.BACKEND_URL = 'https://coinrailz.com';
    console.log('✓ Domain configuration set for coinrailz.com');

    // Port configuration
    this.envVars.PORT = '5000';
    console.log('✓ PORT set to 5000');

    return this.envVars;
  }

  generateEnvFile() {
    const envContent = Object.entries(this.envVars)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    const envPath = path.join(process.cwd(), '.env.production');
    fs.writeFileSync(envPath, envContent);
    console.log(`✓ Environment file created: ${envPath}`);
  }

  displayStatus() {
    console.log('\n=== PRODUCTION ENVIRONMENT STATUS ===');
    
    const required = this.requiredVars.map(varName => ({
      name: varName,
      value: this.envVars[varName] || process.env[varName],
      configured: !!(this.envVars[varName] || process.env[varName])
    }));

    required.forEach(env => {
      const status = env.configured ? '✓' : '✗';
      const value = env.configured ? 'Configured' : 'Missing';
      console.log(`${status} ${env.name}: ${value}`);
    });

    const configuredCount = required.filter(env => env.configured).length;
    const percentage = Math.round((configuredCount / required.length) * 100);
    
    console.log(`\nEnvironment Configuration: ${percentage}% (${configuredCount}/${required.length})`);
    
    return percentage;
  }

  displayNextSteps() {
    console.log('\n=== NEXT STEPS FOR PRODUCTION ===');
    console.log('1. Configure missing environment variables');
    console.log('2. Set up production database');
    console.log('3. Configure Stripe production keys');
    console.log('4. Set up Replit OAuth application');
    console.log('5. Run production build: npm run build');
    console.log('6. Deploy to coinrailz.com domain');
  }

  close() {
    this.rl.close();
  }

  async run() {
    try {
      await this.setupEnvironment();
      this.generateEnvFile();
      const percentage = this.displayStatus();
      this.displayNextSteps();
      
      if (percentage >= 80) {
        console.log('\n🟢 Environment configuration ready for production');
      } else {
        console.log('\n🟡 Additional configuration needed for production');
      }
      
    } catch (error) {
      console.error('Setup failed:', error);
    } finally {
      this.close();
    }
  }
}

// Check current environment status
function checkCurrentEnvironment() {
  console.log('📊 Current Environment Status\n');
  
  const criticalVars = [
    'NODE_ENV',
    'DATABASE_URL', 
    'STRIPE_SECRET_KEY',
    'REPLIT_CLIENT_ID',
    'REPLIT_CLIENT_SECRET'
  ];

  const configured = criticalVars.filter(varName => process.env[varName]);
  const missing = criticalVars.filter(varName => !process.env[varName]);

  console.log('Configured variables:');
  configured.forEach(varName => {
    const value = varName.includes('SECRET') || varName.includes('KEY') ? 
      '[HIDDEN]' : process.env[varName];
    console.log(`✓ ${varName}: ${value}`);
  });

  if (missing.length > 0) {
    console.log('\nMissing variables:');
    missing.forEach(varName => {
      console.log(`✗ ${varName}`);
    });
  }

  const percentage = Math.round((configured.length / criticalVars.length) * 100);
  console.log(`\nConfiguration Status: ${percentage}%`);
  
  return percentage;
}

if (require.main === module) {
  const percentage = checkCurrentEnvironment();
  
  if (percentage < 100) {
    console.log('\n🔧 Starting interactive environment setup...\n');
    const setup = new EnvironmentSetup();
    setup.run();
  } else {
    console.log('\n🟢 All critical environment variables configured');
  }
}

module.exports = { EnvironmentSetup, checkCurrentEnvironment };