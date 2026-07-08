/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@shared/(.*)$': '<rootDir>/shared/$1',
    '^@/(.*)$': '<rootDir>/client/src/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^cbor$': '<rootDir>/tests/support/cborMock.cjs',
  },
  transform: {
    '^.+\\.tsx?$': '<rootDir>/tests/support/importMetaTransformer.cjs',
  },
  testTimeout: 20000,
  clearMocks: false,
  resetModules: false,
};
