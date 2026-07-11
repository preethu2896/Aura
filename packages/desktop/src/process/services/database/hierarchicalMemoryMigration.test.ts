/**
 * @license
 * Copyright 2025 AionUi (aura.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import { ALL_MIGRATIONS } from './migrations';

describe('Database Migration v28', () => {
  it('implements up and down migrations correctly', () => {
    const migration = ALL_MIGRATIONS.find((m) => m.version === 28);
    expect(migration).toBeDefined();

    const mockDb = {
      exec: vi.fn(),
    };

    migration!.up(mockDb as any);
    expect(mockDb.exec).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS workspace_memory'));
    expect(mockDb.exec).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS conversation_memory'));

    migration!.down(mockDb as any);
    expect(mockDb.exec).toHaveBeenCalledWith(expect.stringContaining('DROP TABLE IF EXISTS workspace_memory'));
    expect(mockDb.exec).toHaveBeenCalledWith(expect.stringContaining('DROP TABLE IF EXISTS conversation_memory'));
  });
});
