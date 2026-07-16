/**
 * @license
 * Copyright 2025 AionUi (aura.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { getHealthSnapshot, refreshChecks } from '@process/services/agentHealthService';

/**
 * Registers IPC providers for the `agentHealth` namespace.
 *
 * `list`    → returns the cached health snapshot (no OS probing).
 * `refresh` → re-runs all probes and returns the updated snapshot.
 */
export function initAgentHealthBridge(): void {
  ipcBridge.agentHealth.list.provider(async () => getHealthSnapshot());
  ipcBridge.agentHealth.refresh.provider(async () => refreshChecks());
}
