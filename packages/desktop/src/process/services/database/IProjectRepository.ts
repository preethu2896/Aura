/**
 * @license
 * Copyright 2025 AionUi (aura.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TProject, TProjectFile, TProjectMemory } from '@/common/types/project/projectTypes';

/**
 * Repository interface for project data access.
 *
 * All methods are async (consistent with IConversationRepository).
 * The better-sqlite3 implementation is synchronous internally.
 */
export interface IProjectRepository {
  // ---------------------------------------------------------------------------
  // Project CRUD
  // ---------------------------------------------------------------------------

  getProject(id: string): Promise<TProject | undefined>;
  createProject(project: TProject): Promise<void>;
  updateProject(id: string, updates: Partial<TProject>): Promise<void>;
  deleteProject(id: string): Promise<void>;
  listProjects(): Promise<TProject[]>;

  // ---------------------------------------------------------------------------
  // Project Files
  // ---------------------------------------------------------------------------

  addProjectFile(file: TProjectFile): Promise<void>;
  removeProjectFile(id: string): Promise<void>;
  getProjectFile(id: string): Promise<TProjectFile | undefined>;
  listProjectFiles(project_id: string): Promise<TProjectFile[]>;
  updateProjectFile(id: string, updates: Partial<TProjectFile>): Promise<void>;

  // ---------------------------------------------------------------------------
  // Project Memory
  // ---------------------------------------------------------------------------

  addMemory(entry: TProjectMemory): Promise<void>;
  updateMemory(id: string, updates: Partial<TProjectMemory>): Promise<void>;
  removeMemory(id: string): Promise<void>;
  getMemory(id: string): Promise<TProjectMemory | undefined>;
  listMemory(project_id: string): Promise<TProjectMemory[]>;
}
