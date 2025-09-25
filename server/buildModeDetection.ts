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

// NUCLEAR: Disable if ANY build condition is detected
export const DISABLE_BACKGROUND_SERVICES = IS_DEPLOYMENT_BUILD || IS_BUILD_PROCESS || IS_BUNDLING || IS_ESBUILD_PROCESS || IS_VITE_BUILD;

// Global flag that can be checked anywhere
export const isBackgroundServicesDisabled = () => DISABLE_BACKGROUND_SERVICES;

// Console logging for debugging
if (DISABLE_BACKGROUND_SERVICES) {
  console.log('🚫 BUILD MODE DETECTED - ALL BACKGROUND SERVICES DISABLED');
  console.log('🔧 REPLIT_DEPLOYMENT:', process.env.REPLIT_DEPLOYMENT);
  console.log('🔧 npm_lifecycle_event:', process.env.npm_lifecycle_event);
  console.log('🔧 NODE_ENV:', process.env.NODE_ENV);
  console.log('🔧 DEPLOYMENT_COMPLETE:', process.env.DEPLOYMENT_COMPLETE);
}

// Export individual flags for specific checks
export {
  IS_DEPLOYMENT_BUILD,
  IS_BUILD_PROCESS,
  IS_BUNDLING
};