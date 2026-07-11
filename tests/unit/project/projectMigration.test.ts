/**
 * @license
 * Copyright 2025 AionUi (aura.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import { ALL_MIGRATIONS } from '@/process/services/database/migrations';
import type { ISqliteDriver } from '@/process/services/database/drivers/ISqliteDriver';

describe('Project Database Migration (v27)', () => {
  const migration = ALL_MIGRATIONS.find((m) => m.version === 27);

  it('should find migration v27', () => {
    expect(migration).toBeDefined();
    expect(migration?.name).toBe('Add Projects feature');
  });

  it('runs up migration successfully', () => {
    if (!migration) return;

    const mockDb = {
      exec: vi.fn(),
      prepare: vi.fn(() => ({
        get: vi.fn(() => ({ id: 'user-1' })),
        run: vi.fn(),
      })),
    } as unknown as ISqliteDriver;

    migration.up(mockDb);

    // Verify projects table creation
    expect(mockDb.exec).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS projects'));
    // Verify project_files table creation
    expect(mockDb.exec).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS project_files'));
    // Verify project_memory table creation
    expect(mockDb.exec).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS project_memory'));
    // Verify conversation project_id column addition
    expect(mockDb.exec).toHaveBeenCalledWith(
      expect.stringContaining('ALTER TABLE conversations ADD COLUMN project_id')
    );
  });

  it('runs down migration successfully', () => {
    if (!migration) return;

    const mockDb = {
      exec: vi.fn(),
    } as unknown as ISqliteDriver;

    migration.down(mockDb);

    // Verify dropping new tables in down migration
    expect(mockDb.exec).toHaveBeenCalledWith(expect.stringContaining('DROP TABLE IF EXISTS project_memory'));
    expect(mockDb.exec).toHaveBeenCalledWith(expect.stringContaining('DROP TABLE IF EXISTS project_files'));
    expect(mockDb.exec).toHaveBeenCalledWith(expect.stringContaining('DROP TABLE IF EXISTS projects'));
  });
});
