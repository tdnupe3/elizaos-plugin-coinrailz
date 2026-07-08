/**
 * Custom Jest transformer that handles two ESM-only patterns before ts-jest
 * compiles TypeScript to CommonJS:
 *
 * 1. `import.meta.url` → `__filename`
 * 2. `const require = createRequire(import.meta.url)` — in CJS mode `require`
 *    is already declared globally, so this declaration causes a SyntaxError.
 *    We replace the declaration so the subsequent `require("cbor")` call uses
 *    the CJS global `require` directly.
 */
const { TsJestTransformer } = require('ts-jest');

const tsJestInstance = new TsJestTransformer({
  tsconfig: 'tsconfig.jest.json',
});

function shim(source) {
  return source
    // Remove the createRequire declaration entirely (CJS already has `require`)
    .replace(/^\s*const\s+require\s*=\s*createRequire\s*\([^)]*\)\s*;?\s*$/gm, '')
    // Also handle the import.meta.url → __filename shim for any remaining uses
    .replace(/import\.meta\.url/g, '__filename');
}

module.exports = {
  process(sourceText, sourcePath, options) {
    return tsJestInstance.process(shim(sourceText), sourcePath, options);
  },
  getCacheKey(sourceText, sourcePath, options) {
    if (typeof tsJestInstance.getCacheKey === 'function') {
      return tsJestInstance.getCacheKey(shim(sourceText), sourcePath, options);
    }
    return `${sourcePath}:${Date.now()}`;
  },
};
