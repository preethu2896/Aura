/**
 * @license
 * Copyright 2025 AionUi (aura.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Generic agent runtime preparation layer.
 *
 * This module is intentionally agent-agnostic.  It reads dependency
 * requirements from the cached main-process health snapshot via IPC, then:
 *  1. Verifies all dependencies are satisfied.
 *  2. For `provider` dependencies with an `envKey`: resolves the API key from
 *     the already-loaded providers list (no extra network request) and returns
 *     it for the caller to inject via `setAgentOverrides`.
 *  3. Returns a typed result — the caller decides what to do (inject env vars,
 *     store missing deps for the in-conversation panel, etc.).
 *
 * No agent names, IDs, or backends are hard-coded here.
 */

import { ipcBridge } from '@/common';
import type { IProvider } from '@/common/config/storage';
import type { AgentHealthEntry, DependencyCheckResult } from '@/common/types/agent/agentHealthTypes';

export type PrepareSuccess = {
  ok: true;
  /** Map of environment variable name → value to inject before conversation create. */
  envInjected: Record<string, string>;
};

export type PrepareMissingDeps = {
  ok: false;
  missingDeps: DependencyCheckResult[];
};

export type PrepareResult = PrepareSuccess | PrepareMissingDeps;

/**
 * Prepares the runtime environment for the given assistant's backend agent.
 *
 * @param agentBackend - The `backend` field from the selected assistant's
 *   `AgentMetadata` (e.g. "claude", "goose", "officecli").  Pass an empty
 *   string or undefined when the assistant has no backend agent — the function
 *   returns `{ ok: true, envInjected: {} }` immediately.
 * @param providers - The caller's already-loaded provider list; used to
 *   resolve API keys for `provider`-type dependencies.
 */
export async function prepareAgentRuntime(
  agentBackend: string | undefined,
  providers: IProvider[]
): Promise<PrepareResult> {
  if (!agentBackend) {
    return { ok: true, envInjected: {} };
  }

  // Fetch the cached snapshot — no OS probing occurs here.
  let snapshot: AgentHealthEntry[];
  try {
    const result = await ipcBridge.agentHealth.list.invoke();
    snapshot = Array.isArray(result) ? result : [];
  } catch {
    // If IPC fails (e.g. web-only mode without Electron), proceed without check.
    return { ok: true, envInjected: {} };
  }

  const entry = snapshot.find((e) => e.agentBackend === agentBackend);
  if (!entry) {
    // No catalog entry for this backend — no special preparation needed.
    return { ok: true, envInjected: {} };
  }

  const missing: DependencyCheckResult[] = [];
  const envInjected: Record<string, string> = {};

  for (const dep of entry.dependencies) {
    if (dep.satisfied) {
      continue;
    }

    // For provider deps: attempt to resolve the key from the in-memory list.
    if (dep.type === 'provider' && dep.envKey) {
      const match = providers.find(
        (p) => p.platform === dep.name && p.api_key && (p as { enabled?: boolean }).enabled !== false
      );
      if (match) {
        envInjected[dep.envKey] = match.api_key;
        // Treat as satisfied — key was resolved from renderer state.
        continue;
      }
    }

    missing.push(dep);
  }

  if (missing.length > 0) {
    return { ok: false, missingDeps: missing };
  }

  return { ok: true, envInjected };
}
