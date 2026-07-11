/**
 * @license
 * Copyright 2025 AionUi (aura.com)
 * SPDX-License-Identifier: Apache-2.0
 */

export interface TWorkspaceMemory {
  /** Stable UUID */
  id: string;
  /** Plain-text memory content */
  content: string;
  /** Importance score (0–1). */
  importance: number;
  /** Freeform tags for categorisation and retrieval. */
  tags: string[];
  /** Origin of the memory: 'user' | 'agent' | etc. */
  source: string;
  /** Nullable vector identifier for future search integration. */
  vector_id?: string | null;
  /** Nullable status for future embedding calculations. */
  embedding_status?: string | null;
  /** Unix ms — creation timestamp */
  created_at: number;
  /** Unix ms — last update timestamp */
  updated_at: number;
}

export interface TConversationMemory {
  /** Stable UUID */
  id: string;
  /** FK to conversations.id */
  conversation_id: string;
  /** Plain-text memory content (typically summary) */
  content: string;
  /** Importance score (0–1). */
  importance: number;
  /** Freeform tags for categorisation and retrieval. */
  tags: string[];
  /** Origin of the memory: 'user' | 'agent' | etc. */
  source: string;
  /** Nullable vector identifier for future search integration. */
  vector_id?: string | null;
  /** Nullable status for future embedding calculations. */
  embedding_status?: string | null;
  /** Unix ms — creation timestamp */
  created_at: number;
  /** Unix ms — last update timestamp */
  updated_at: number;
}

export interface AddWorkspaceMemoryRequest {
  content: string;
  tags?: string[];
  importance?: number;
  source?: string;
}

export interface AddConversationMemoryRequest {
  conversation_id: string;
  content: string;
  tags?: string[];
  importance?: number;
  source?: string;
}
