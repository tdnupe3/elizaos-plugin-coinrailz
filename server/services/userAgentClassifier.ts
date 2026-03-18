/**
 * Classifies incoming User-Agent strings into known AI agent frameworks.
 * Used for funnel segmentation — stored as metadata.agentFramework.
 */

export type AgentFramework =
  | 'python-httpx'
  | 'python-requests'
  | 'langchain'
  | 'crewai'
  | 'autogen'
  | 'openai-sdk'
  | 'curl'
  | 'node-fetch'
  | 'axios'
  | 'go-http'
  | 'ruby-net'
  | 'java-http'
  | 'unknown';

const PATTERNS: Array<{ pattern: RegExp; framework: AgentFramework }> = [
  { pattern: /langchain/i,        framework: 'langchain' },
  { pattern: /crewai/i,           framework: 'crewai' },
  { pattern: /autogen/i,          framework: 'autogen' },
  { pattern: /openai-python/i,    framework: 'openai-sdk' },
  { pattern: /python-httpx/i,     framework: 'python-httpx' },
  { pattern: /python-requests/i,  framework: 'python-requests' },
  { pattern: /^curl\//i,          framework: 'curl' },
  { pattern: /node-fetch/i,       framework: 'node-fetch' },
  { pattern: /axios/i,            framework: 'axios' },
  { pattern: /^Go-http-client/i,  framework: 'go-http' },
  { pattern: /Ruby/i,             framework: 'ruby-net' },
  { pattern: /Java\//i,           framework: 'java-http' },
];

export function classifyUserAgent(ua: string | undefined | null): AgentFramework {
  if (!ua) return 'unknown';
  for (const { pattern, framework } of PATTERNS) {
    if (pattern.test(ua)) return framework;
  }
  return 'unknown';
}
