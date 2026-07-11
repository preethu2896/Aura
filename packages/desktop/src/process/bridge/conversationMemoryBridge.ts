/**
 * @license
 * Copyright 2025 AionUi (aura.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { randomUUID } from 'node:crypto';
import { ipcBridge } from '@/common';
import type { TConversationMemory, AddConversationMemoryRequest } from '@/common/types/project/memoryTypes';
import { resolveLegacyDatabasePath } from '@process/services/database/runLegacyDatabaseMigrations';
import { BetterSqlite3Driver } from '@process/services/database/drivers/BetterSqlite3Driver';

function runDb<T>(fn: (driver: BetterSqlite3Driver) => T): T {
  const dbPath = resolveLegacyDatabasePath();
  const driver = new BetterSqlite3Driver(dbPath);
  try {
    return fn(driver);
  } finally {
    driver.close();
  }
}

export function initConversationMemoryBridge(): void {
  // List versioned summaries for a conversation (newest first)
  ipcBridge.conversationMemory.list.provider(async (p: { conversationId: string }) => {
    return runDb((db) => {
      const stmt = db.prepare('SELECT * FROM conversation_memory WHERE conversation_id = ? ORDER BY created_at DESC');
      const rows = stmt.all(p.conversationId) as any[];
      return rows.map((r) => ({
        id: r.id,
        conversation_id: r.conversation_id,
        content: r.content,
        importance: r.importance,
        tags: JSON.parse(r.tags || '[]') as string[],
        source: r.source,
        vector_id: r.vector_id,
        embedding_status: r.embedding_status,
        created_at: r.created_at,
        updated_at: r.updated_at,
      }));
    });
  });

  // Add a new versioned summary to a conversation
  ipcBridge.conversationMemory.add.provider(async (req: AddConversationMemoryRequest) => {
    return runDb((db) => {
      const now = Date.now();
      const newMemory: TConversationMemory = {
        id: randomUUID(),
        conversation_id: req.conversation_id,
        content: req.content,
        importance: req.importance ?? 0.5,
        tags: req.tags ?? [],
        source: req.source ?? 'agent',
        created_at: now,
        updated_at: now,
      };

      db.prepare(
        `INSERT INTO conversation_memory (id, conversation_id, content, importance, tags, source, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        newMemory.id,
        newMemory.conversation_id,
        newMemory.content,
        newMemory.importance,
        JSON.stringify(newMemory.tags),
        newMemory.source,
        newMemory.created_at,
        newMemory.updated_at
      );

      return newMemory;
    });
  });

  // Delete a specific summary version
  ipcBridge.conversationMemory.delete.provider(async (p: { id: string }) => {
    return runDb((db) => {
      db.prepare('DELETE FROM conversation_memory WHERE id = ?').run(p.id);
    });
  });
}
