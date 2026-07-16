/**
 * @license
 * Copyright 2025 AionUi (aura.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { logger } from '@office-ai/platform';
import { initAllBridges } from '../bridge';
import { runStartupChecks } from '../services/agentHealthService';

logger.config({ print: true });

initAllBridges();

// Fire agent health checks in the background — does not block app startup.
void runStartupChecks().catch((err: unknown) => {
  console.warn('[AgentHealth] Startup check failed:', err);
});
