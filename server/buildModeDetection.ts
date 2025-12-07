/**
 * BUILD MODE DETECTION - NUCLEAR APPROACH  
 * Comprehensive system to prevent ALL background services during deployment builds
 */

// NUCLEAR: Multiple detection methods for maximum coverage
const IS_DEPLOYMENT_BUILD = process.env.REPLIT_DEPLOYMENT === '1';
const IS_BUILD_PROCESS = process.env.npm_lifecycle_event === 'build';  
const IS_BUNDLING = process.env.NODE_ENV === 'production' && !process.env.DEPLOYMENT_COMPLETE;
const IS_ESBUILD_PROCESS = process.argv.includes('--bundle') || process.argv.includes('esbuild');
const IS_VITE_BUILD = process.argv.includes('vite') && process.argv.includes('build');

// ENHANCED NUCLEAR DETECTION - Catch ALL deployment scenarios
const IS_PRODUCTION_STARTUP = process.env.NODE_ENV === 'production';
const IS_DIST_EXECUTION = process.argv[1]?.includes('dist/index.js') || process.argv[1]?.includes('dist\\index.js');
const IS_BUNDLED_EXECUTION = process.argv[1]?.endsWith('dist/index.js');
const IS_REPLIT_CONTAINER = process.env.REPL_ID && process.env.NODE_ENV === 'production';
const IS_AUTOSCALE_DEPLOYMENT = process.env.deploymentTarget === 'autoscale' || process.env.DEPLOYMENT_TARGET === 'autoscale';

// ULTRA NUCLEAR: Disable if ANY condition is detected  
export const DISABLE_BACKGROUND_SERVICES = 
  IS_DEPLOYMENT_BUILD || 
  IS_BUILD_PROCESS || 
  IS_BUNDLING || 
  IS_ESBUILD_PROCESS || 
  IS_VITE_BUILD ||
  IS_PRODUCTION_STARTUP ||           // ANY production mode
  IS_DIST_EXECUTION ||               // Running from dist folder
  IS_BUNDLED_EXECUTION ||            // Bundled output execution
  IS_REPLIT_CONTAINER ||             // Replit production container
  IS_AUTOSCALE_DEPLOYMENT;

// Global flag that can be checked anywhere
export const isBackgroundServicesDisabled = () => DISABLE_BACKGROUND_SERVICES;

// ENHANCED Console logging for debugging
console.log('🔍 NUCLEAR BUILD DETECTION:', {
  IS_DEPLOYMENT_BUILD,
  IS_BUILD_PROCESS,
  IS_BUNDLING,
  IS_ESBUILD_PROCESS,
  IS_VITE_BUILD,
  IS_PRODUCTION_STARTUP,
  IS_DIST_EXECUTION,
  IS_BUNDLED_EXECUTION,
  IS_REPLIT_CONTAINER,
  IS_AUTOSCALE_DEPLOYMENT,
  FINAL_RESULT: DISABLE_BACKGROUND_SERVICES
});

if (DISABLE_BACKGROUND_SERVICES) {
  console.log('🚫 NUCLEAR MODE: ALL BACKGROUND SERVICES DISABLED');
  console.log('🔧 REPLIT_DEPLOYMENT:', process.env.REPLIT_DEPLOYMENT);
  console.log('🔧 npm_lifecycle_event:', process.env.npm_lifecycle_event);
  console.log('🔧 NODE_ENV:', process.env.NODE_ENV);
  console.log('🔧 Current executable:', process.argv[1]);
  console.log('🔧 All args:', process.argv);
} else {
  console.log('✅ DEVELOPMENT MODE: Background services enabled');
}

// Export individual flags for specific checks
export {
  IS_DEPLOYMENT_BUILD,
  IS_BUILD_PROCESS,
  IS_BUNDLING,
  IS_PRODUCTION_STARTUP,
  IS_DIST_EXECUTION,
  IS_BUNDLED_EXECUTION,
  IS_REPLIT_CONTAINER,
  IS_AUTOSCALE_DEPLOYMENT
};