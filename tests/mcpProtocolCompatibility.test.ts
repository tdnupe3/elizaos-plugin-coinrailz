import { describe, test, expect, beforeAll } from '@jest/globals';
import axios from 'axios';

const BASE_URL = process.env.API_URL || 'http://localhost:5000';
const MCP_URL = `${BASE_URL}/mcp`;
const CURRENT_VERSION = '2026-07-28';

beforeAll(async () => {
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      await axios.post(
        MCP_URL,
        { jsonrpc: '2.0', id: 0, method: 'server/discover', params: {} },
        { timeout: 3_000, validateStatus: () => true },
      );
      return;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 2_000));
    }
  }
  throw new Error(`MCP server at ${MCP_URL} did not become ready in time`);
}, 30_000);

describe('MCP 2026-07-28 discovery and negotiation', () => {
  test.each(['get', 'delete'] as const)(
    '%s /mcp is rejected as a non-transport method instead of returning frontend HTML',
    async method => {
      const res = await axios[method](
        MCP_URL,
        { validateStatus: () => true },
      );

      expect(res.status).toBe(405);
      expect(res.headers.allow).toBe('POST');
      expect(res.headers['content-type']).toMatch(/^application\/json/);
      expect(res.data).toMatchObject({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32600,
          message: 'MCP transport only supports POST requests at /mcp',
        },
      });
    },
  );

  test('server/discover returns versions, capabilities, identity, and cache hints', async () => {
    const res = await axios.post(
      MCP_URL,
      {
        jsonrpc: '2.0',
        id: 'discover-1',
        method: 'server/discover',
        params: {
          _meta: {
            'io.modelcontextprotocol/protocolVersion': CURRENT_VERSION,
          },
        },
      },
      {
        headers: {
          'MCP-Protocol-Version': CURRENT_VERSION,
          'Mcp-Method': 'server/discover',
        },
        validateStatus: () => true,
      },
    );

    expect(res.status).toBe(200);
    expect(res.headers['mcp-protocol-version']).toBe(CURRENT_VERSION);
    expect(res.data).toMatchObject({
      jsonrpc: '2.0',
      id: 'discover-1',
      result: {
        resultType: 'complete',
        supportedVersions: expect.arrayContaining([CURRENT_VERSION, '2025-11-25', '2024-11-05']),
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
        _meta: {
          'io.modelcontextprotocol/serverInfo': {
            name: 'coinrailz-mcp',
          },
        },
        ttlMs: 3_600_000,
        cacheScope: 'public',
      },
    });
  });

  test('legacy initialize negotiates the requested supported version', async () => {
    const res = await axios.post(
      MCP_URL,
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2024-11-05', capabilities: {} },
      },
      { validateStatus: () => true },
    );

    expect(res.status).toBe(200);
    expect(res.data.result.protocolVersion).toBe('2024-11-05');
    expect(res.headers['mcp-protocol-version']).toBe('2024-11-05');
  });

  test('legacy initialize rejects an unsupported requested version', async () => {
    const res = await axios.post(
      MCP_URL,
      {
        jsonrpc: '2.0',
        id: 11,
        method: 'initialize',
        params: { protocolVersion: '1900-01-01', capabilities: {} },
      },
      { validateStatus: () => true },
    );

    expect(res.status).toBe(400);
    expect(res.data).toMatchObject({
      jsonrpc: '2.0',
      id: 11,
      error: {
        code: -32022,
        data: {
          requested: '1900-01-01',
          supported: expect.arrayContaining([CURRENT_VERSION]),
        },
      },
    });
  });

  test('legacy initialize rejects disagreement with transport metadata', async () => {
    const res = await axios.post(
      MCP_URL,
      {
        jsonrpc: '2.0',
        id: 12,
        method: 'initialize',
        params: { protocolVersion: '2024-11-05', capabilities: {} },
      },
      {
        headers: {
          'MCP-Protocol-Version': '2025-11-25',
          'Mcp-Method': 'initialize',
        },
        validateStatus: () => true,
      },
    );

    expect(res.status).toBe(400);
    expect(res.data).toMatchObject({
      jsonrpc: '2.0',
      id: 12,
      error: { code: -32020 },
    });
  });

  test('rejects unsupported protocol versions deterministically', async () => {
    const res = await axios.post(
      MCP_URL,
      {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {
          _meta: {
            'io.modelcontextprotocol/protocolVersion': '1900-01-01',
          },
        },
      },
      {
        headers: {
          'MCP-Protocol-Version': '1900-01-01',
          'Mcp-Method': 'tools/list',
        },
        validateStatus: () => true,
      },
    );

    expect(res.status).toBe(400);
    expect(res.data).toMatchObject({
      jsonrpc: '2.0',
      id: 2,
      error: {
        code: -32022,
        data: {
          requested: '1900-01-01',
          supported: expect.arrayContaining([CURRENT_VERSION]),
        },
      },
    });
  });

  test('rejects mismatched mirrored transport metadata deterministically', async () => {
    const res = await axios.post(
      MCP_URL,
      {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/list',
        params: {
          _meta: {
            'io.modelcontextprotocol/protocolVersion': CURRENT_VERSION,
          },
        },
      },
      {
        headers: {
          'MCP-Protocol-Version': '2025-11-25',
          'Mcp-Method': 'tools/list',
        },
        validateStatus: () => true,
      },
    );

    expect(res.status).toBe(400);
    expect(res.data).toMatchObject({
      jsonrpc: '2.0',
      id: 3,
      error: { code: -32020 },
    });
  });
});

describe('MCP discovery-to-payment regression', () => {
  test('lists tools and issues a machine-readable unpaid challenge', async () => {
    const list = await axios.post(
      MCP_URL,
      { jsonrpc: '2.0', id: 4, method: 'tools/list', params: {} },
      { validateStatus: () => true },
    );

    expect(list.status).toBe(200);
    expect(list.data.result.tools.length).toBeGreaterThan(0);

    const paidTool = list.data.result.tools.find((tool: any) => tool?._meta?.priceUsd > 0);
    expect(paidTool).toBeDefined();

    const call = await axios.post(
      MCP_URL,
      {
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: { name: paidTool.name, arguments: {} },
      },
      { validateStatus: () => true },
    );

    expect(call.status).toBe(402);
    expect(call.headers['payment-required']).toBeTruthy();
    expect(call.data).toMatchObject({
      jsonrpc: '2.0',
      id: 5,
      x402Version: 2,
      accepts: expect.any(Array),
    });
    expect(call.data.accepts.length).toBeGreaterThan(0);
  });
});