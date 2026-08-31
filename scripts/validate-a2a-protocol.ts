import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { A2AClient } from '@a2a-js/sdk/client';
import {
  buildCoinRailzAgentCard,
  buildCompletedTask,
  SUPPORTED_A2A_VERSION,
} from '../server/a2a/protocol';

const textPartSchema = z.object({
  kind: z.literal('text'),
  text: z.string(),
  metadata: z.record(z.unknown()).optional(),
}).strict();

const artifactSchema = z.object({
  artifactId: z.string().min(1),
  name: z.string().optional(),
  description: z.string().optional(),
  parts: z.array(textPartSchema).min(1),
  metadata: z.record(z.unknown()).optional(),
  extensions: z.array(z.string()).optional(),
}).strict();

const taskSchema = z.object({
  kind: z.literal('task'),
  id: z.string().min(1),
  contextId: z.string().min(1),
  status: z.object({
    state: z.literal('completed'),
    timestamp: z.string().datetime(),
  }).strict(),
  artifacts: z.array(artifactSchema).min(1),
  metadata: z.record(z.unknown()).optional(),
}).strict();

const skillSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  tags: z.array(z.string()).min(1),
  inputModes: z.array(z.string()).optional(),
  outputModes: z.array(z.string()).optional(),
  examples: z.array(z.string()).optional(),
}).strict();

const agentCardSchema = z.object({
  protocolVersion: z.literal(SUPPORTED_A2A_VERSION),
  name: z.string().min(1),
  description: z.string().min(1),
  url: z.string().url(),
  version: z.string().min(1),
  preferredTransport: z.literal('JSONRPC'),
  capabilities: z.object({
    streaming: z.boolean(),
    pushNotifications: z.boolean(),
    stateTransitionHistory: z.boolean(),
  }).strict(),
  defaultInputModes: z.array(z.string()).min(1),
  defaultOutputModes: z.array(z.string()).min(1),
  skills: z.array(skillSchema).min(1),
  provider: z.object({
    organization: z.string().min(1),
    url: z.string().url(),
  }).strict().optional(),
  documentationUrl: z.string().url().optional(),
  iconUrl: z.string().url().optional(),
  supportsAuthenticatedExtendedCard: z.boolean().optional(),
}).strict();

const jsonRpcTaskResponseSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number(), z.null()]),
  result: taskSchema,
}).strict();

const jsonRpcErrorResponseSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number(), z.null()]),
  error: z.object({
    code: z.number(),
    message: z.string(),
    data: z.record(z.unknown()).optional(),
  }).strict(),
}).strict();

const jsonRpcRequest = {
  jsonrpc: '2.0',
  id: 'strict-client-fixture',
  method: 'message/send',
  params: {
    message: {
      kind: 'message',
      messageId: randomUUID(),
      role: 'user',
      parts: [{ kind: 'text', text: 'What is the current gas price on Base?' }],
    },
  },
} as const;

function validateLocalBuilders() {
  const card = agentCardSchema.parse(buildCoinRailzAgentCard('https://coinrailz.com'));
  const task = taskSchema.parse(buildCompletedTask(
    randomUUID(),
    [{ parts: [{ text: 'Strict A2A fixture response' }] }],
    { fixture: true },
  ));
  jsonRpcTaskResponseSchema.parse({
    jsonrpc: '2.0',
    id: jsonRpcRequest.id,
    result: task,
  });

  for (const skill of card.skills) {
    if (!skill.examples?.every(example => typeof example === 'string')) {
      throw new Error(`Skill ${skill.id} has a non-string A2A example`);
    }
  }
}

async function validateRuntime(baseUrl: string) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
  const cardResponse = await fetch(`${normalizedBaseUrl}/.well-known/agent-card.json`);
  if (!cardResponse.ok) {
    throw new Error(`Agent card returned HTTP ${cardResponse.status}`);
  }
  const card = agentCardSchema.parse(await cardResponse.json());

  const messageResponse = await fetch(card.url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(jsonRpcRequest),
  });
  if (!messageResponse.ok) {
    throw new Error(`A2A message endpoint returned HTTP ${messageResponse.status}`);
  }
  jsonRpcTaskResponseSchema.parse(await messageResponse.json());

  const nullIdResponse = await fetch(card.url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...jsonRpcRequest, id: null }),
  });
  const nullIdBody = jsonRpcTaskResponseSchema.parse(await nullIdResponse.json());
  if (nullIdBody.id !== null) {
    throw new Error('A2A endpoint did not preserve a null JSON-RPC id');
  }

  const notificationResponse = await fetch(card.url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'message/send',
      params: jsonRpcRequest.params,
    }),
  });
  if (notificationResponse.status !== 204) {
    throw new Error(`A2A notification returned HTTP ${notificationResponse.status} instead of 204`);
  }

  for (const notification of [
    {
      jsonrpc: '2.0',
      method: 'unknown/method',
      params: jsonRpcRequest.params,
    },
    {
      jsonrpc: '2.0',
      method: 'message/send',
      params: { message: { kind: 'message', parts: [] } },
    },
  ]) {
    const invalidNotificationResponse = await fetch(card.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(notification),
    });
    if (invalidNotificationResponse.status !== 204) {
      throw new Error(
        `Invalid A2A notification returned HTTP ${invalidNotificationResponse.status} instead of 204`,
      );
    }
  }

  const malformedResponse = await fetch(card.url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'malformed-fixture',
      method: 'message/send',
      params: { message: { kind: 'message', parts: [] } },
    }),
  });
  const malformedBody = jsonRpcErrorResponseSchema.parse(await malformedResponse.json());
  if (malformedBody.error.code !== -32602) {
    throw new Error(`Malformed A2A fixture returned JSON-RPC code ${malformedBody.error.code}`);
  }

  const officialClient = await A2AClient.fromCardUrl(
    `${normalizedBaseUrl}/.well-known/agent-card.json`,
  );
  const officialClientResponse = await officialClient.sendMessage({
    message: {
      kind: 'message',
      messageId: randomUUID(),
      role: 'user',
      parts: [{ kind: 'text', text: 'What is the current gas price on Base?' }],
    },
  });
  jsonRpcTaskResponseSchema.parse(officialClientResponse);

  const aliasResponse = await fetch(`${normalizedBaseUrl}/a2a/v1/message/send`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      message: {
        parts: [{ text: 'What is the current gas price on Base?' }],
      },
    }),
  });
  if (!aliasResponse.ok) {
    throw new Error(`A2A compatibility alias returned HTTP ${aliasResponse.status}`);
  }
  taskSchema.parse(await aliasResponse.json());
}

validateLocalBuilders();
const runtimeBaseUrl = process.argv[2]
  || (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : undefined);
if (runtimeBaseUrl) {
  await validateRuntime(runtimeBaseUrl);
}

console.log(`A2A ${SUPPORTED_A2A_VERSION} strict fixtures passed${runtimeBaseUrl ? ' (including runtime routes)' : ''}.`);