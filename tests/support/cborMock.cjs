/**
 * Minimal CBOR mock for Jest tests.
 * paymentOrchestrator.ts uses cbor to decode CBOR-encoded payment payloads.
 * In tests we pass JSON, so the CBOR decoder is never invoked on the hot path.
 */
module.exports = {
  decode: jest.fn((buf) => {
    throw new Error('cbor.decode called unexpectedly in test — use JSON payload instead');
  }),
  encode: jest.fn((obj) => Buffer.from(JSON.stringify(obj))),
  decodeFirst: jest.fn().mockResolvedValue([null, null]),
  decodeAll: jest.fn().mockResolvedValue([]),
};
