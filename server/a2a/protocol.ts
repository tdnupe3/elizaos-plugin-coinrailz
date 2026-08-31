import type { AgentCard, AgentSkill, Artifact, Task, TextPart } from '@a2a-js/sdk';
import { serviceCatalogService } from '../services/serviceCatalogService';
import { PUBLIC_DISCOVERY_VERSIONS } from '../config/publicDiscoveryConfig';

export const SUPPORTED_A2A_VERSION = PUBLIC_DISCOVERY_VERSIONS.a2aProtocol;

const DEFAULT_INPUT_MODES = ['text/plain', 'application/json'];
const DEFAULT_OUTPUT_MODES = ['text/plain', 'application/json'];

function buildSkillExample(skill: {
  name: string;
  capabilities?: string[];
}): string {
  const capability = skill.capabilities?.find(value => value.trim().length > 0);
  return capability
    ? `Find the best Coin Railz service for ${capability}.`
    : `Tell me how to use ${skill.name}.`;
}

export function buildCoinRailzAgentCard(baseUrl: string): AgentCard {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
  const catalog = serviceCatalogService.getCatalog();
  const skills: AgentSkill[] = catalog.services.map(service => ({
    id: service.id,
    name: service.name,
    description: service.description,
    tags: Array.from(new Set([
      service.category,
      ...(service.capabilities ?? []),
      'x402',
    ])),
    inputModes: DEFAULT_INPUT_MODES,
    outputModes: DEFAULT_OUTPUT_MODES,
    examples: [buildSkillExample(service)],
  }));

  return {
    protocolVersion: SUPPORTED_A2A_VERSION,
    name: 'Coin Railz',
    description: `Multi-chain x402 micropayment infrastructure for AI agents with ${catalog.totalServices} pay-per-call services.`,
    url: `${normalizedBaseUrl}/a2a/v1`,
    version: PUBLIC_DISCOVERY_VERSIONS.manifest,
    preferredTransport: 'JSONRPC',
    capabilities: {
      streaming: false,
      pushNotifications: false,
      stateTransitionHistory: false,
    },
    defaultInputModes: DEFAULT_INPUT_MODES,
    defaultOutputModes: DEFAULT_OUTPUT_MODES,
    skills,
    provider: {
      organization: 'Coin Railz',
      url: normalizedBaseUrl,
    },
    documentationUrl: `${normalizedBaseUrl}/.well-known/agent-instructions.json`,
    iconUrl: `${normalizedBaseUrl}/favicon.ico`,
    supportsAuthenticatedExtendedCard: false,
  };
}

export function buildCompletedTask(
  taskId: string,
  artifactParts: Array<{ parts: Array<{ text: string }> }>,
  metadata: Record<string, unknown>,
  contextId = taskId,
): Task {
  const artifacts: Artifact[] = artifactParts.map((artifact, artifactIndex) => ({
    artifactId: `${taskId}-artifact-${artifactIndex + 1}`,
    parts: artifact.parts.map((part): TextPart => ({
      kind: 'text',
      text: part.text,
    })),
  }));

  return {
    kind: 'task',
    id: taskId,
    contextId,
    status: {
      state: 'completed',
      timestamp: new Date().toISOString(),
    },
    artifacts,
    metadata,
  };
}