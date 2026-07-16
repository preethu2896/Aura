/**
 * @license
 * Copyright 2025 AionUi (aura.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Describes a single dependency requirement for an agent.
 *
 * Type discriminants:
 *  - `binary`   — a CLI tool that must be on PATH (e.g. "officecli", "claude")
 *  - `provider` — an LLM provider row with a matching platform and non-empty key
 *  - `env_var`  — an environment variable that must be set
 *  - `platform` — the host OS must match a given platform identifier
 *  - `auth`     — the agent requires authentication beyond a simple API key
 */
export type DependencyType = 'binary' | 'provider' | 'env_var' | 'platform' | 'auth';

/**
 * Static descriptor stored in the main-process catalog.
 * Defines what is required — checked before any session is started.
 */
export type DependencySpec = {
  type: DependencyType;
  /** Human-readable dependency name (binary name, provider platform, env var name, …) */
  name: string;
  /** Optional short explanation shown to the user in the setup panel. */
  description?: string;
  /** Shell command to install the dependency (for `binary` deps). */
  installCommand?: string;
  /** Documentation URL for the dependency. */
  installUrl?: string;
  /**
   * For `provider` deps: the environment variable key that will be populated
   * from the resolved provider's API key (e.g. "ANTHROPIC_API_KEY").
   */
  envKey?: string;
  /**
   * For `platform` deps: comma-separated OS platform identifiers that are
   * supported (e.g. "darwin,linux"). Uses Node.js `process.platform` values.
   */
  platforms?: string;
};

/**
 * Runtime check result for a single dependency — produced by the main-process
 * probe and returned through the `agentHealth` IPC channel.
 */
export type DependencyCheckResult = {
  type: DependencyType;
  name: string;
  satisfied: boolean;
  /** For binary deps: the resolved absolute path of the executable. */
  resolvedPath?: string;
  /** Populated from the DependencySpec for UI rendering. */
  description?: string;
  installCommand?: string;
  installUrl?: string;
  envKey?: string;
};

/**
 * Health snapshot for a single agent — keyed on `agent_metadata.backend` in
 * the main-process catalog.
 */
export type AgentHealthEntry = {
  /** Matches `AgentMetadata.backend` (e.g. "claude", "goose", "officecli"). */
  agentBackend: string;
  /** Aggregate status derived from all dependency checks. */
  status: 'available' | 'missing_dependency' | 'auth_required' | 'provider_missing' | 'unknown';
  /** Individual dependency results in declaration order. */
  dependencies: DependencyCheckResult[];
  /** Epoch ms of when the check was performed. */
  checkedAt: number;
};
