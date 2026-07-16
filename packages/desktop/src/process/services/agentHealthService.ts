/**
 * @license
 * Copyright 2025 AionUi (aura.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Main-process agent health service.
 *
 * Responsibility: probe CLI binaries and resolve provider-based dependencies
 * once at startup, cache results, and expose them via the `agentHealth` IPC
 * bridge.  The renderer never probes the OS directly.
 *
 * Design constraints:
 *  - No DOM APIs (main-process only).
 *  - Dependencies are declared generically via `DependencySpec[]`; no
 *    agent-specific logic lives outside the catalog below.
 *  - Binary probes use Node's `child_process` with a hard 3-second timeout.
 *  - Results are cached in-memory; refreshed only on startup or explicit
 *    `refresh()` call from the renderer.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { AgentHealthEntry, DependencyCheckResult, DependencySpec } from '@/common/types/agent/agentHealthTypes';

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Static dependency catalog
// Keyed on `agent_metadata.backend` values reported by aioncore.
// ---------------------------------------------------------------------------

type AgentDependencyCatalogEntry = {
  specs: DependencySpec[];
};

/**
 * Central, generic catalog of agent dependency requirements.
 *
 * To add a new agent: append an entry here — no renderer code changes needed.
 * Keys match the `backend` field on `AgentMetadata` / `ManagedAgent`.
 */
const AGENT_DEPENDENCY_CATALOG: Record<string, AgentDependencyCatalogEntry> = {
  claude: {
    specs: [
      {
        type: 'binary',
        name: 'claude',
        description: 'Claude Code CLI — required to run Claude Code sessions',
        installCommand: 'npm install -g @anthropic-ai/claude-code',
        installUrl: 'https://claude.ai/code',
      },
      {
        type: 'provider',
        name: 'anthropic',
        description: 'An Anthropic provider with a valid API key',
        envKey: 'ANTHROPIC_API_KEY',
        installUrl: 'https://console.anthropic.com/settings/keys',
      },
    ],
  },
  officecli: {
    specs: [
      {
        type: 'binary',
        name: 'officecli',
        description: 'OfficeCLI — required for document generation agents (PPT, Word, etc.)',
        installCommand: 'pip install officecli',
        installUrl: 'https://pypi.org/project/officecli/',
      },
    ],
  },
  goose: {
    specs: [
      {
        type: 'binary',
        name: 'goose',
        description: 'Goose CLI — open-source AI agent by Block',
        installCommand:
          'curl -fsSL https://github.com/block/goose/releases/latest/download/download.sh | CONFIGURE=false bash',
        installUrl: 'https://block.github.io/goose',
      },
    ],
  },
  droid: {
    specs: [
      {
        type: 'binary',
        name: 'droid',
        description: 'Droid CLI agent',
        installCommand: 'npm install -g @droid-ai/cli',
        installUrl: 'https://github.com/droid-ai/droid',
      },
    ],
  },
  hermes: {
    specs: [
      {
        type: 'binary',
        name: 'hermes',
        description: 'Hermes agent CLI',
        installCommand: 'npm install -g @hermes-agent/cli',
        installUrl: 'https://github.com/hermes-agent',
      },
    ],
  },
  snow: {
    specs: [
      {
        type: 'binary',
        name: 'snow',
        description: 'Snow CLI agent',
        installCommand: 'npm install -g @snow-agent/cli',
        installUrl: 'https://github.com/snow-agent',
      },
    ],
  },
  kimi: {
    specs: [
      {
        type: 'binary',
        name: 'kimi',
        description: 'Kimi CLI agent',
        installCommand: 'pip install kimi-agent',
        installUrl: 'https://github.com/kimi-agent',
      },
    ],
  },
  qwen: {
    specs: [
      {
        type: 'binary',
        name: 'qwen',
        description: 'Qwen CLI agent',
        installCommand: 'pip install qwen-agent',
        installUrl: 'https://github.com/QwenLM/Qwen-Agent',
      },
    ],
  },
  openclaw: {
    specs: [
      {
        type: 'binary',
        name: 'openclaw',
        description: 'OpenClaw gateway CLI',
        installCommand: 'npm install -g @openclaw/cli',
        installUrl: 'https://github.com/openclaw',
      },
    ],
  },
  vibe: {
    specs: [
      {
        type: 'binary',
        name: 'vibe',
        description: 'Vibe CLI agent',
        installCommand: 'npm install -g @vibe-agent/cli',
        installUrl: 'https://github.com/vibe-agent',
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// Binary resolution helpers
// ---------------------------------------------------------------------------

const BINARY_PROBE_TIMEOUT_MS = 3000;

/**
 * Resolves the absolute path of a binary on PATH.
 * Returns `undefined` if the binary is not found.
 */
async function resolveBinaryPath(binaryName: string): Promise<string | undefined> {
  const isWindows = process.platform === 'win32';
  const command = isWindows ? 'where' : 'which';
  try {
    const { stdout } = await execFileAsync(command, [binaryName], { timeout: BINARY_PROBE_TIMEOUT_MS });
    const resolved = stdout.trim().split('\n')[0]?.trim();
    return resolved || undefined;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Provider check helpers
// ---------------------------------------------------------------------------

/**
 * Checks whether a provider with the given platform and a non-empty API key
 * exists in the backend.
 *
 * Uses fetch against the local aioncore HTTP port — safe in the main process.
 */
async function resolveProviderApiKey(platformName: string): Promise<string | undefined> {
  const port = (globalThis as typeof globalThis & { __backendPort?: number }).__backendPort;
  if (!port) return undefined;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/providers`);
    if (!res.ok) return undefined;
    const json = (await res.json()) as { data?: Array<{ platform: string; api_key: string; enabled?: boolean }> };
    const providers = json.data ?? [];
    const match = providers.find((p) => p.platform === platformName && p.api_key && p.enabled !== false);
    return match?.api_key;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Core probe logic
// ---------------------------------------------------------------------------

async function checkDependency(spec: DependencySpec): Promise<DependencyCheckResult> {
  const base: DependencyCheckResult = {
    type: spec.type,
    name: spec.name,
    satisfied: false,
    description: spec.description,
    installCommand: spec.installCommand,
    installUrl: spec.installUrl,
    envKey: spec.envKey,
  };

  switch (spec.type) {
    case 'binary': {
      const resolvedPath = await resolveBinaryPath(spec.name);
      return { ...base, satisfied: Boolean(resolvedPath), resolvedPath };
    }
    case 'provider': {
      const key = await resolveProviderApiKey(spec.name);
      return { ...base, satisfied: Boolean(key) };
    }
    case 'env_var': {
      const value = process.env[spec.name];
      return { ...base, satisfied: Boolean(value) };
    }
    case 'platform': {
      const supported = (spec.platforms ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      return { ...base, satisfied: supported.length === 0 || supported.includes(process.platform) };
    }
    case 'auth': {
      // Auth deps require human interaction; report unsatisfied to trigger guidance.
      return { ...base, satisfied: false };
    }
    default:
      return base;
  }
}

function deriveStatus(results: DependencyCheckResult[]): AgentHealthEntry['status'] {
  if (results.every((r) => r.satisfied)) return 'available';
  const failed = results.filter((r) => !r.satisfied);
  if (failed.some((r) => r.type === 'provider')) return 'provider_missing';
  if (failed.some((r) => r.type === 'auth')) return 'auth_required';
  return 'missing_dependency';
}

async function probeAgent(agentBackend: string, entry: AgentDependencyCatalogEntry): Promise<AgentHealthEntry> {
  const results = await Promise.all(entry.specs.map(checkDependency));
  return {
    agentBackend,
    status: deriveStatus(results),
    dependencies: results,
    checkedAt: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Singleton service
// ---------------------------------------------------------------------------

let _cache: AgentHealthEntry[] = [];

/**
 * Run all dependency probes defined in AGENT_DEPENDENCY_CATALOG.
 * Stores results in the in-memory cache.
 *
 * Safe to call multiple times; subsequent calls update the cache.
 * Non-blocking callers should `void runStartupChecks()` and not await.
 */
export async function runStartupChecks(): Promise<AgentHealthEntry[]> {
  const entries = Object.entries(AGENT_DEPENDENCY_CATALOG);
  const results = await Promise.allSettled(entries.map(([backend, entry]) => probeAgent(backend, entry)));

  const healthy: AgentHealthEntry[] = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r && r.status === 'fulfilled') {
      healthy.push(r.value);
    } else if (r && r.status === 'rejected') {
      const backend = entries[i]?.[0] ?? 'unknown';
      console.warn(`[AgentHealth] Probe failed for backend="${backend}":`, r.reason);
      healthy.push({
        agentBackend: backend,
        status: 'unknown',
        dependencies: [],
        checkedAt: Date.now(),
      });
    }
  }

  _cache = healthy;
  console.log(`[AgentHealth] Startup check complete. ${healthy.length} agents probed.`);
  return healthy;
}

/**
 * Returns the cached health snapshot without re-probing.
 * Returns an empty array if `runStartupChecks` has not yet completed.
 */
export function getHealthSnapshot(): AgentHealthEntry[] {
  return _cache;
}

/**
 * Re-probes all agents and updates the cache.
 * Called when the renderer requests a manual refresh via `agentHealth.refresh`.
 */
export async function refreshChecks(): Promise<AgentHealthEntry[]> {
  return runStartupChecks();
}
