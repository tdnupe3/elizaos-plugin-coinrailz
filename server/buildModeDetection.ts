/**
 * BUILD MODE DETECTION
 * Disable background services only during actual BUILD phases, not production runtime
 * 
 * CRITICAL FIX: REPLIT_DEPLOYMENT=1 is set BOTH during build AND runtime on autoscale.
 * We must only disable services during the actual bundling/compilation, NOT runtime.
 * 
 * DEV LITE MODE: In development, defer heavy background services to prevent
 * Vite HMR WebSocket connection drops. Services like Discord, XMTP, discovery
 * adapters can block the event loop during initialization, starving HMR heartbeats.
 */

// BUILD PHASE detection - these indicate bundling/compilation is happening
// NOTE: REPLIT_DEPLOYMENT alone is NOT sufficient - it's also set during production runtime!
const IS_BUILD_PROCESS = process.env.npm_lifecycle_event === 'build';  
const IS_ESBUILD_PROCESS = process.argv.includes('--bundle') || process.argv.includes('esbuild');
const IS_VITE_BUILD = process.argv.includes('vite') && process.argv.includes('build');

// Normalize REPLIT_DEPLOYMENT (can be "1" or "true" depending on deploy phase)
const deploymentFlag = process.env.REPLIT_DEPLOYMENT?.toLowerCase();
const IS_DEPLOYMENT_SET = deploymentFlag === '1' || deploymentFlag === 'true';

// REPLIT_DEPLOYMENT is only a BUILD indicator when combined with build tooling
// During runtime, dist/index.js runs directly without these build args
const IS_REPLIT_BUILD_PHASE = IS_DEPLOYMENT_SET && (IS_BUILD_PROCESS || IS_ESBUILD_PROCESS || IS_VITE_BUILD);

// RUNTIME detection - these are for logging only, NOT for disabling services
const IS_PRODUCTION_STARTUP = process.env.NODE_ENV === 'production';
const IS_DIST_EXECUTION = process.argv[1]?.includes('dist/index.js') || process.argv[1]?.includes('dist\\index.js');
const IS_BUNDLED_EXECUTION = process.argv[1]?.endsWith('dist/index.js');
const IS_REPLIT_CONTAINER = !!(process.env.REPL_ID && process.env.NODE_ENV === 'production');
const IS_AUTOSCALE_DEPLOYMENT = process.env.deploymentTarget === 'autoscale' || process.env.DEPLOYMENT_TARGET === 'autoscale';
const IS_DEPLOYMENT_RUNTIME = IS_DEPLOYMENT_SET && IS_DIST_EXECUTION;

// DEV LITE MODE: Disable heavy background services in development to keep Vite HMR stable
// Can be overridden by setting DEV_FULL_SERVICES=true if you need all services during dev
const IS_DEVELOPMENT = process.env.NODE_ENV !== 'production' && !IS_DEPLOYMENT_SET;
const DEV_FULL_SERVICES = process.env.DEV_FULL_SERVICES === 'true';
export const DEV_LITE_MODE = IS_DEVELOPMENT && !DEV_FULL_SERVICES;

// Only disable during actual BUILD phases, allow production RUNTIME to work normally
// CRITICAL: Do NOT include REPLIT_DEPLOYMENT alone - that would break production runtime!
export const DISABLE_BACKGROUND_SERVICES = 
  IS_REPLIT_BUILD_PHASE || 
  IS_BUILD_PROCESS || 
  IS_ESBUILD_PROCESS || 
  IS_VITE_BUILD;

// Disable heavy outreach/discovery services in dev to prevent Vite HMR drops
// These services (Discord, XMTP, discovery, outreach) block the event loop during init
export const DISABLE_HEAVY_SERVICES = DISABLE_BACKGROUND_SERVICES || DEV_LITE_MODE;

// Global flag that can be checked anywhere
export const isBackgroundServicesDisabled = () => DISABLE_BACKGROUND_SERVICES;
export const isHeavyServicesDisabled = () => DISABLE_HEAVY_SERVICES;

// Console logging for debugging - only in verbose mode to reduce log noise
if (process.env.VERBOSE_BUILD_MODE === 'true') {
  console.log('🔍 BUILD MODE DETECTION:', {
    REPLIT_DEPLOYMENT: process.env.REPLIT_DEPLOYMENT,
    IS_REPLIT_BUILD_PHASE,
    IS_BUILD_PROCESS,
    IS_ESBUILD_PROCESS,
    IS_VITE_BUILD,
    IS_DEPLOYMENT_RUNTIME,
    IS_PRODUCTION_RUNTIME: IS_PRODUCTION_STARTUP,
    DEV_LITE_MODE,
    DISABLE_BACKGROUND_SERVICES,
    DISABLE_HEAVY_SERVICES
  });
}

if (DISABLE_BACKGROUND_SERVICES) {
  console.log('🚫 BUILD PHASE: Background services disabled during build');
} else if (DEV_LITE_MODE) {
  console.log('🧪 DEV LITE MODE: Heavy services disabled for stable Vite HMR');
  console.log('   Set DEV_FULL_SERVICES=true to enable all services in dev');
} else {
  console.log('✅ PRODUCTION MODE: All services enabled');
}

// Export individual flags for specific checks
export {
  IS_REPLIT_BUILD_PHASE,
  IS_BUILD_PROCESS,
  IS_PRODUCTION_STARTUP,
  IS_DIST_EXECUTION,
  IS_BUNDLED_EXECUTION,
  IS_REPLIT_CONTAINER,
  IS_AUTOSCALE_DEPLOYMENT,
  IS_DEPLOYMENT_RUNTIME,
  IS_DEVELOPMENT
  // DEV_LITE_MODE already exported inline above
};