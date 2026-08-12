/**
 * MCP Notifications handler integration tests
 *
 * Verifies that MCP notification methods (notifications/initialized, etc.)
 * receive HTTP 202 Accepted with an empty body — per JSON-RPC 2.0 §4 and
 * the MCP Streamable HTTP transport spec, notifications must NOT receive a
 * JSON-RPC response envelope.
 *
 * Prior behaviour: notifications/initialized returned HTTP 404 with a
 * JSON-RPC error envelope, which caused strict MCP clients (e.g.
 * agent-tools.cloud-crawler) to abort before attempting any tool calls.
 *
 * Run: npm test -- mcpNotifications.test.ts
 * Requires: dev server running on localhost:5000
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import axios from 'axios';

const BASE_URL = process.env.API_URL || 'http://localhost:5000';
const MCP_URL  = `${BASE_URL}/mcp`;

// Wait for server to be ready before running tests
beforeAll(async () => {
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      await axios.post(
        MCP_URL,
        { jsonrpc: '2.0', id: 0, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {} } },
        { timeout: 3_000, validateStatus: () => true },
      );
      return;
    } catch {
      await new Promise(r => setTimeout(r, 2_000));
    }
  }
  throw new Error(`MCP server at ${MCP_URL} did not become ready in time`);
}, 30_000);

// ---------------------------------------------------------------------------
// Core: notifications must return 202 with no JSON-RPC envelope
// ---------------------------------------------------------------------------

describe('MCP notifications/initialized', () => {
  test('returns HTTP 202 Accepted with empty body', async () => {
    const res = await axios.post(
      MCP_URL,
      // Notifications intentionally omit `id` per JSON-RPC 2.0 §4
      { jsonrpc: '2.0', method: 'notifications/initialized', params: {} },
      { validateStatus: () => true },
    );

    expect(res.status).toBe(202);
    // Express sendStatus(202) puts "Accepted" as the body text — any non-JSON
    // body confirms no JSON-RPC envelope was returned.
    expect(typeof res.data === 'object' ? JSON.stringify(res.data) : String(res.data))
      .not.toContain('"jsonrpc"');
  });

  test('does not return a JSON-RPC error envelope for notifications/initialized', async () => {
    const res = await axios.post(
      MCP_URL,
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      { validateStatus: () => true },
    );

    // Must not be 404 (old broken behaviour)
    expect(res.status).not.toBe(404);

    // Must not contain a JSON-RPC error field
    const body = typeof res.data === 'string' ? res.data : JSON.stringify(res.data ?? '');
    expect(body).not.toContain('"error"');
  });
});

// ---------------------------------------------------------------------------
// Generalisation: any notifications/* method must also return 202
// ---------------------------------------------------------------------------

describe('MCP notifications/* catch-all', () => {
  test('notifications/cancelled returns HTTP 202', async () => {
    const res = await axios.post(
      MCP_URL,
      { jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId: 'abc', reason: 'test' } },
      { validateStatus: () => true },
    );
    expect(res.status).toBe(202);
  });

  test('notifications/progress returns HTTP 202', async () => {
    const res = await axios.post(
      MCP_URL,
      { jsonrpc: '2.0', method: 'notifications/progress', params: { progressToken: 'tok', progress: 0.5 } },
      { validateStatus: () => true },
    );
    expect(res.status).toBe(202);
  });
});

// ---------------------------------------------------------------------------
// Regression guard: unknown non-notification method still returns 404
// ---------------------------------------------------------------------------

describe('MCP unknown non-notification method', () => {
  test('sampling/createMessage still returns HTTP 404 with JSON-RPC error', async () => {
    const res = await axios.post(
      MCP_URL,
      { jsonrpc: '2.0', id: 42, method: 'sampling/createMessage', params: {} },
      { validateStatus: () => true },
    );
    expect(res.status).toBe(404);
    expect(res.data).toMatchObject({ jsonrpc: '2.0', error: { code: -32601 } });
  });
});
