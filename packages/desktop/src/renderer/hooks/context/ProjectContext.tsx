/**
 * @license
 * Copyright 2025 AionUi (aura.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { DEFAULT_PROJECT_ID } from '@/common/config/storage';
import type { TProject } from '@/common/types/project/projectTypes';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACTIVE_PROJECT_STORAGE_KEY = 'project.activeId';

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

type ProjectContextValue = {
  /** All non-archived projects (sorted: pinned first, then by sort_order/updated_at) */
  projects: TProject[];
  /** Currently active project (falls back to General if missing) */
  activeProject: TProject | undefined;
  /** Active project ID — always set to the General project ID as fallback */
  activeProjectId: string;
  /** Switch the active project. Falls back to General if the ID does not exist. */
  setActiveProjectId: (id: string) => void;
  /** Lookup helper */
  getProject: (id: string) => TProject | undefined;
  /** True while the initial project list is loading */
  loading: boolean;
  /** Reload project list from the backend */
  refresh: () => Promise<void>;
};

const ProjectContext = createContext<ProjectContextValue>({
  projects: [],
  activeProject: undefined,
  activeProjectId: DEFAULT_PROJECT_ID,
  setActiveProjectId: () => {},
  getProject: () => undefined,
  loading: true,
  refresh: async () => {},
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sortProjects(list: TProject[]): TProject[] {
  return [...list].toSorted((a, b) => {
    // Pinned projects first
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    // General project always first within its pin group
    if (a.is_default !== b.is_default) return a.is_default ? -1 : 1;
    // Then sort_order ascending (lower index = higher position)
    if ((a.sort_order ?? Infinity) !== (b.sort_order ?? Infinity)) {
      return (a.sort_order ?? Infinity) - (b.sort_order ?? Infinity);
    }
    // Finally most recently updated
    return b.updated_at - a.updated_at;
  });
}

function readPersistedActiveId(): string {
  try {
    return localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY) ?? DEFAULT_PROJECT_ID;
  } catch {
    return DEFAULT_PROJECT_ID;
  }
}

function persistActiveId(id: string): void {
  try {
    localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, id);
  } catch {
    // ignore storage errors
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export const ProjectProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [projects, setProjects] = useState<TProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeProjectId, setActiveProjectIdState] = useState<string>(readPersistedActiveId);
  const mountedRef = useRef(true);

  // ------------------------------------------------------------------
  // Load / refresh
  // ------------------------------------------------------------------

  const loadProjects = useCallback(async () => {
    try {
      const list = await ipcBridge.projects.list.invoke();
      if (!mountedRef.current) return;
      setProjects(sortProjects(list));
    } catch (err) {
      console.error('[ProjectContext] Failed to load projects:', err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    await loadProjects();
  }, [loadProjects]);

  // ------------------------------------------------------------------
  // Initial load
  // ------------------------------------------------------------------

  useEffect(() => {
    mountedRef.current = true;
    void loadProjects();
    return () => {
      mountedRef.current = false;
    };
  }, [loadProjects]);

  // ------------------------------------------------------------------
  // Real-time updates via WebSocket
  // ------------------------------------------------------------------

  useEffect(() => {
    const unsub = ipcBridge.projects.listChanged.on(() => {
      void loadProjects();
    });
    return unsub;
  }, [loadProjects]);

  // ------------------------------------------------------------------
  // Active project resolution with fallback to General
  // ------------------------------------------------------------------

  const resolvedActiveId: string = (() => {
    if (!loading && projects.length > 0) {
      const exists = projects.some((p) => p.id === activeProjectId);
      if (!exists) return DEFAULT_PROJECT_ID;
    }
    return activeProjectId;
  })();

  const setActiveProjectId = useCallback(
    (id: string) => {
      const exists = projects.some((p) => p.id === id);
      const finalId = exists ? id : DEFAULT_PROJECT_ID;
      setActiveProjectIdState(finalId);
      persistActiveId(finalId);
    },
    [projects]
  );

  const getProject = useCallback((id: string): TProject | undefined => projects.find((p) => p.id === id), [projects]);

  const activeProject = getProject(resolvedActiveId);

  return (
    <ProjectContext.Provider
      value={{
        projects,
        activeProject,
        activeProjectId: resolvedActiveId,
        setActiveProjectId,
        getProject,
        loading,
        refresh,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export const useProject = (): ProjectContextValue => useContext(ProjectContext);

export default ProjectContext;
