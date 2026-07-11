/**
 * @license
 * Copyright 2025 AionUi (aura.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback } from 'react';
import { ipcBridge } from '@/common';
import { useSessionMemory } from '../context/SessionMemoryContext';

export function useHierarchicalMemory() {
  const { sessionNotes } = useSessionMemory();

  const getHierarchicalMemoryContext = useCallback(
    async (conversationId: string, projectId?: string, baseSystemPrompt?: string): Promise<string> => {
      // 1. Fetch Workspace Memory
      let workspaceText = '';
      try {
        const workspaceMemories = await ipcBridge.workspaceMemory.list.invoke();
        if (workspaceMemories.length > 0) {
          workspaceText = workspaceMemories.map((m) => `- ${m.content} (importance: ${m.importance})`).join('\n');
        }
      } catch (err) {
        console.error('[HierarchicalMemory] Failed to load workspace memory', err);
      }

      // 2. Fetch Project Memory (only if project is specified)
      let projectText = '';
      if (projectId) {
        try {
          const projectMemories = await ipcBridge.projects.listMemory.invoke({ id: projectId });
          if (projectMemories.length > 0) {
            projectText = projectMemories.map((m) => `- ${m.content} (importance: ${m.importance})`).join('\n');
          }
        } catch (err) {
          console.error('[HierarchicalMemory] Failed to load project memory', err);
        }
      }

      // 3. Fetch Conversation Memory (latest versioned summary)
      let summaryText = '';
      try {
        const summaries = await ipcBridge.conversationMemory.list.invoke({ conversationId });
        if (summaries.length > 0) {
          const latest = summaries[0]; // ordered DESC, so index 0 is newest
          const dateStr = new Date(latest.created_at).toLocaleString();
          summaryText = `[Versioned summary generated at ${dateStr}]:\n${latest.content}`;
        }
      } catch (err) {
        console.error('[HierarchicalMemory] Failed to load conversation summary', err);
      }

      // 4. Fetch Ephemeral Session Notes
      let sessionText = '';
      const notes = sessionNotes[conversationId] ?? [];
      if (notes.length > 0) {
        sessionText = notes.map((note) => `- ${note}`).join('\n');
      }

      // 5. Assemble in strict requested order:
      // System Prompt -> Workspace Memory -> Project Memory -> Conversation Summary -> Session Memory
      const blocks: string[] = [];

      // Base System Prompt (starts the sequence)
      if (baseSystemPrompt && baseSystemPrompt.trim()) {
        blocks.push(`# SYSTEM PROMPT\n${baseSystemPrompt.trim()}`);
      }

      if (workspaceText) {
        blocks.push(`# WORKSPACE MEMORY\n${workspaceText}`);
      }

      if (projectText) {
        blocks.push(`# PROJECT MEMORY\n${projectText}`);
      }

      if (summaryText) {
        blocks.push(`# CONVERSATION SUMMARY\n${summaryText}`);
      }

      if (sessionText) {
        blocks.push(`# SESSION MEMORY\n${sessionText}`);
      }

      return blocks.join('\n\n');
    },
    [sessionNotes]
  );

  return { getHierarchicalMemoryContext };
}
