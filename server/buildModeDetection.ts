/**
 * BUILD MODE DETECTION
 * Disable background services only during actual BUILD phases, not production runtime
 */

// BUILD PHASE detection - these indicate bundling/compilation is happening
const IS_DEPLOYMENT_BUILD = process.env.REPLIT_DEPLOYMENT === '1';
const IS_BUILD_PROCESS = process.env.npm_lifecycle_event === 'build';  
const IS_ESBUILD_PROCESS = process.argv.includes('--bundle') || process.argv.includes('esbuild');
const IS_VITE_BUILD = process.argv.includes('vite') && process.argv.includes('build');

// RUNTIME detection - these are for logging only, NOT for disabling services
const IS_PRODUCTION_STARTUP = process.env.NODE_ENV === 'production';
const IS_DIST_EXECUTION = process.argv[1]?.includes('dist/index.js') || process.argv[1]?.includes('dist\\index.js');
const IS_BUNDLED_EXECUTION = process.argv[1]?.endsWith('dist/index.js');
const IS_REPLIT_CONTAINER = !!(process.env.REPL_ID && process.env.NODE_ENV === 'production');
const IS_AUTOSCALE_DEPLOYMENT = process.env.deploymentTarget === 'autoscale' || process.env.DEPLOYMENT_TARGET === 'autoscale';

// Only disable during actual BUILD phases, allow production RUNTIME to work normally
export const DISABLE_BACKGROUND_SERVICES = 
  IS_DEPLOYMENT_BUILD || 
  IS_BUILD_PROCESS || 
  IS_ESBUILD_PROCESS || 
  IS_VITE_BUILD;

// Global flag that can be checked anywhere
export const isBackgroundServicesDisabled = () => DISABLE_BACKGROUND_SERVICES;

// Console logging for debugging
console.log('🔍 BUILD MODE DETECTION:', {
  IS_DEPLOYMENT_BUILD,
  IS_BUILD_PROCESS,
  IS_ESBUILD_PROCESS,
  IS_VITE_BUILD,
  IS_PRODUCTION_RUNTIME: IS_PRODUCTION_STARTUP,
  DISABLE_BACKGROUND_SERVICES
});

if (DISABLE_BACKGROUND_SERVICES) {
  console.log('🚫 BUILD PHASE: Background services disabled during build');
} else {
  console.log('✅ RUNTIME MODE: Background services enabled');
}

// Export individual flags for specific checks
export {
  IS_DEPLOYMENT_BUILD,
  IS_BUILD_PROCESS,
  IS_PRODUCTION_STARTUP,
  IS_DIST_EXECUTION,
  IS_BUNDLED_EXECUTION,
  IS_REPLIT_CONTAINER,
  IS_AUTOSCALE_DEPLOYMENT
};