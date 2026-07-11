/**
 * @license
 * Copyright 2025 AionUi (aura.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TProviderWithModel } from '@/common/config/storage';

// ---------------------------------------------------------------------------
// Project core types
// ---------------------------------------------------------------------------

/**
 * Provider configuration stored on a project.
 * Structured as a single object so future fields (reasoning mode, context
 * window, etc.) can be added without altering schema column layout.
 */
export interface TProjectProviderConfig {
  /** Full provider + model snapshot, same shape as TProviderWithModel */
  provider?: TProviderWithModel;
  /** Sampling temperature (0–2). Overrides global default when set. */
  temperature?: number;
  /** Reasoning mode identifier (e.g. 'low' | 'medium' | 'high'). Future use. */
  reasoning_mode?: string;
  /** TTS voice identifier. */
  tts_voice?: string;
  /** STT language code (e.g. 'en-US'). */
  stt_language?: string;
  /**
   * Extensible bag for future provider options (top_p, max_tokens, etc.).
   * Kept as a plain record so backward-compatible additions need no migration.
   */
  extra?: Record<string, unknown>;
}

/**
 * Project entity — stored in the `projects` table.
 *
 * Design notes for future cloud compatibility:
 * - `id` is always a stable UUID; never derived from name.
 * - No `user_id` column at the app-level type (the DB row has one for the
 *   current local multi-user architecture, but cloud sync layers can key
 *   on `id` independently).
 * - `created_at` / `updated_at` are millisecond epoch integers.
 */
export interface TProject {
  /** Stable UUID — never changes after creation */
  id: string;
  /** Human-readable project name */
  name: string;
  /** Optional short description */
  description?: string;
  /**
   * System-level instructions injected into every new conversation in this
   * project (analogous to ChatGPT project instructions).
   */
  instructions?: string;
  /** Accent colour for sidebar badge, e.g. "#FF5733" */
  color?: string;
  /** Icon identifier: emoji string or icon-park icon name */
  icon?: string;
  /** Whether this project is pinned to the top of the sidebar */
  pinned?: boolean;
  /** Unix ms when the project was pinned */
  pinned_at?: number;
  /** Whether this project is archived (hidden by default) */
  archived?: boolean;
  /** Unix ms when the project was archived */
  archived_at?: number;
  /**
   * Provider/model/voice configuration stored as a single structured object
   * for forward compatibility with future provider options.
   */
  provider_config?: TProjectProviderConfig;
  /**
   * System prompt that is injected on top of instructions.
   * Stored separately so instructions and system prompt can be edited
   * independently.
   */
  system_prompt?: string;
  /** IDs of MCP servers enabled by default for new conversations */
  enabled_mcp_server_ids?: string[];
  /** IDs of agents (ACP agents / assistants) enabled by default */
  enabled_agent_ids?: string[];
  /** Display order in the sidebar (lower = higher) */
  sort_order?: number;
  /**
   * Whether this project is the built-in "General" project.
   * The General project cannot be deleted.
   */
  is_default?: boolean;
  /** Unix ms — creation timestamp */
  created_at: number;
  /** Unix ms — last update timestamp */
  updated_at: number;
}

// ---------------------------------------------------------------------------
// Project file types
// ---------------------------------------------------------------------------

/**
 * File attached to a project.
 * Physical location: `workDir/projects/<project_id>/files/<id>_<name>`.
 */
export interface TProjectFile {
  /** Stable UUID */
  id: string;
  /** FK to projects.id */
  project_id: string;
  /** Original file name (display only) */
  name: string;
  /** Absolute path to the file on disk */
  path: string;
  /** File size in bytes */
  size: number;
  /** MIME type, e.g. "text/plain" */
  mime_type?: string;
  /**
   * SHA-256 hex checksum for integrity verification and deduplication.
   * NULL until computed.
   */
  checksum?: string;
  /**
   * Whether the file has been indexed for search.
   * NULL = not yet indexed. Future use.
   */
  indexed?: boolean;
  /**
   * Embedding status for semantic search.
   * NULL = not embedded. Future use.
   */
  embedding_status?: 'pending' | 'done' | 'failed';
  /** Unix ms — upload timestamp */
  created_at: number;
}

// ---------------------------------------------------------------------------
// Project memory types
// ---------------------------------------------------------------------------

/**
 * A single scoped memory record attached to a project.
 * Memory is always project-scoped and never leaks across projects.
 */
export interface TProjectMemory {
  /** Stable UUID */
  id: string;
  /** FK to projects.id */
  project_id: string;
  /** Plain-text memory content */
  content: string;
  /**
   * Freeform tags for categorisation and retrieval.
   * Future intelligent memory retrieval will filter on tags.
   */
  tags?: string[];
  /**
   * Importance score (0–1). Future use for ranked retrieval.
   * NULL = unscored.
   */
  importance?: number;
  /**
   * Origin of the memory: 'user' | 'agent' | 'import' | etc.
   * Future use for attribution and filtering. NULL = unknown.
   */
  source?: string;
  /** Unix ms — creation timestamp */
  created_at: number;
  /** Unix ms — last update timestamp */
  updated_at: number;
}

// ---------------------------------------------------------------------------
// API request / response shapes (used by ipcBridge helpers)
// ---------------------------------------------------------------------------

export interface CreateProjectRequest {
  name: string;
  description?: string;
  instructions?: string;
  color?: string;
  icon?: string;
  system_prompt?: string;
  provider_config?: TProjectProviderConfig;
  enabled_mcp_server_ids?: string[];
  enabled_agent_ids?: string[];
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  instructions?: string;
  color?: string;
  icon?: string;
  pinned?: boolean;
  archived?: boolean;
  system_prompt?: string;
  provider_config?: TProjectProviderConfig;
  enabled_mcp_server_ids?: string[];
  enabled_agent_ids?: string[];
  sort_order?: number;
}

export interface AddProjectMemoryRequest {
  content: string;
  tags?: string[];
  importance?: number;
  source?: string;
}

export interface UpdateProjectMemoryRequest {
  content?: string;
  tags?: string[];
  importance?: number;
  source?: string;
}
