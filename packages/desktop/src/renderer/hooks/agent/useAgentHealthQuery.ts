/**
 * @license
 * Copyright 2025 AionUi (aura.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { AgentHealthEntry } from '@/common/types/agent/agentHealthTypes';
import useSWR, { mutate } from 'swr';
import { useCallback } from 'react';

export const AGENT_HEALTH_SWR_KEY = 'agent.health.snapshot';

async function fetchAgentHealth(): Promise<AgentHealthEntry[]> {
  try {
    const entries = await ipcBridge.agentHealth.list.invoke();
    return Array.isArray(entries) ? entries : [];
  } catch {
    return [];
  }
}

/**
 * Returns the cached agent health snapshot from the main process.
 *
 * The data is fetched once and kept in the SWR cache for the lifetime of the
 * renderer.  Call `refresh()` to trigger a re-probe (e.g. after the user
 * installs a missing dependency).
 *
 * The renderer never probes the OS directly — all checks run in the main
 * process and are read here as a lightweight IPC call.
 */
export function useAgentHealthQuery(): {
  healthMap: Record<string, AgentHealthEntry>;
  isLoading: boolean;
  refresh: () => Promise<void>;
} {
  const { data, isLoading } = useSWR<AgentHealthEntry[]>(AGENT_HEALTH_SWR_KEY, fetchAgentHealth, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  const refresh = useCallback(async () => {
    try {
      const updated = await ipcBridge.agentHealth.refresh.invoke();
      await mutate<AgentHealthEntry[]>(AGENT_HEALTH_SWR_KEY, Array.isArray(updated) ? updated : [], {
        revalidate: false,
      });
    } catch (err) {
      console.error('[AgentHealth] Refresh failed:', err);
    }
  }, []);

  const healthMap: Record<string, AgentHealthEntry> = {};
  for (const entry of data ?? []) {
    healthMap[entry.agentBackend] = entry;
  }

  return { healthMap, isLoading, refresh };
}
