/**
 * @license
 * Copyright 2025 AionUi (aura.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { randomUUID } from 'node:crypto';
import { ipcBridge } from '@/common';
import type { TWorkspaceMemory, AddWorkspaceMemoryRequest } from '@/common/types/project/memoryTypes';
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

export function initWorkspaceMemoryBridge(): void {
  // List global workspace memories
  ipcBridge.workspaceMemory.list.provider(async () => {
    return runDb((db) => {
      const stmt = db.prepare('SELECT * FROM workspace_memory ORDER BY created_at DESC');
      const rows = stmt.all() as any[];
      return rows.map((r) => ({
        id: r.id,
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

  // Add workspace memory
  ipcBridge.workspaceMemory.add.provider(async (req: AddWorkspaceMemoryRequest) => {
    return runDb((db) => {
      const now = Date.now();
      const newMemory: TWorkspaceMemory = {
        id: randomUUID(),
        content: req.content,
        importance: req.importance ?? 0.5,
        tags: req.tags ?? [],
        source: req.source ?? 'user',
        created_at: now,
        updated_at: now,
      };

      db.prepare(
        `INSERT INTO workspace_memory (id, content, importance, tags, source, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        newMemory.id,
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

  // Update workspace memory
  ipcBridge.workspaceMemory.update.provider(async (p: { id: string; updates: Partial<AddWorkspaceMemoryRequest> }) => {
    return runDb((db) => {
      const existing = db.prepare('SELECT * FROM workspace_memory WHERE id = ?').get(p.id) as any;
      if (!existing) {
        throw new Error(`Workspace memory entry with ID ${p.id} not found.`);
      }

      const now = Date.now();
      const content = p.updates.content ?? existing.content;
      const importance = p.updates.importance ?? existing.importance;
      const tags = p.updates.tags ?? JSON.parse(existing.tags || '[]');
      const source = p.updates.source ?? existing.source;

      db.prepare(
        `UPDATE workspace_memory
           SET content = ?, importance = ?, tags = ?, source = ?, updated_at = ?
           WHERE id = ?`
      ).run(content, importance, JSON.stringify(tags), source, now, p.id);

      return {
        id: p.id,
        content,
        importance,
        tags,
        source,
        vector_id: existing.vector_id,
        embedding_status: existing.embedding_status,
        created_at: existing.created_at,
        updated_at: now,
      };
    });
  });

  // Delete workspace memory
  ipcBridge.workspaceMemory.delete.provider(async (p: { id: string }) => {
    return runDb((db) => {
      db.prepare('DELETE FROM workspace_memory WHERE id = ?').run(p.id);
    });
  });
}
