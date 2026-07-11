/**
 * @license
 * Copyright 2025 AionUi (aura.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useHierarchicalMemory } from './useHierarchicalMemory';
import { useConversationSummarizer } from './useConversationSummarizer';
import { ipcBridge } from '@/common';

// Mock ipcBridge
vi.mock('@/common', () => {
  return {
    ipcBridge: {
      workspaceMemory: {
        list: {
          invoke: vi.fn(),
        },
      },
      conversationMemory: {
        list: {
          invoke: vi.fn(),
        },
        add: {
          invoke: vi.fn(),
        },
      },
      projects: {
        listMemory: {
          invoke: vi.fn(),
        },
      },
      database: {
        getConversationMessages: {
          invoke: vi.fn(),
        },
      },
    },
  };
});

// Mock SessionMemoryContext
vi.mock('../context/SessionMemoryContext', () => {
  return {
    useSessionMemory: () => ({
      sessionNotes: {
        'conv-123': ['Temporary session note A', 'Temporary session note B'],
      },
    }),
  };
});

// Mock ClientFactory and RotatingClient
vi.mock('@/common/api', () => {
  const mockRotatingClient = {
    createChatCompletion: vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: 'Mocked background summary content',
          },
        },
      ],
    }),
  };
  return {
    ClientFactory: {
      createRotatingClient: vi.fn().mockResolvedValue(mockRotatingClient),
    },
  };
});

// Mock getConversationOrNull
vi.mock('@/renderer/pages/conversation/utils/conversationCache', () => {
  return {
    getConversationOrNull: vi.fn().mockResolvedValue({
      id: 'conv-123',
      model: {
        id: 'provider-1',
        name: 'provider-name',
        api_key: 'test-key',
        use_model: 'gpt-4o',
      },
      extra: {
        project_id: 'proj-456',
        last_token_usage: {
          total_tokens: 5000,
        },
      },
    }),
  };
});

describe('Hierarchical Memory Pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('compiles hierarchical prompt context in the correct strict order', async () => {
    // 1. Mock Workspace memories
    vi.mocked(ipcBridge.workspaceMemory.list.invoke).mockResolvedValue([
      {
        id: 'm1',
        content: 'Workspace Fact 1',
        importance: 0.8,
        tags: [],
        source: 'user',
        created_at: 0,
        updated_at: 0,
      },
    ] as any);

    // 2. Mock Project memories
    vi.mocked(ipcBridge.projects.listMemory.invoke).mockResolvedValue([
      {
        id: 'pm1',
        content: 'Project Memory Fact 1',
        importance: 0.9,
        tags: [],
        source: 'user',
        created_at: 0,
        updated_at: 0,
      },
    ] as any);

    // 3. Mock Conversation summaries (latest versioned summary)
    vi.mocked(ipcBridge.conversationMemory.list.invoke).mockResolvedValue([
      {
        id: 'cm1',
        conversation_id: 'conv-123',
        content: 'Latest history summary version',
        importance: 0.7,
        tags: [],
        source: 'agent',
        created_at: 1000,
        updated_at: 1000,
      },
    ] as any);

    const { getHierarchicalMemoryContext } = useHierarchicalMemory();

    const compiled = await getHierarchicalMemoryContext('conv-123', 'proj-456', 'System Prompt Baseline');

    // Verify sections exist
    expect(compiled).toContain('# SYSTEM PROMPT');
    expect(compiled).toContain('# WORKSPACE MEMORY');
    expect(compiled).toContain('# PROJECT MEMORY');
    expect(compiled).toContain('# CONVERSATION SUMMARY');
    expect(compiled).toContain('# SESSION MEMORY');

    // Verify strict requested ordering:
    // System Prompt -> Workspace Memory -> Project Memory -> Conversation Summary -> Session Memory
    const systemIdx = compiled.indexOf('# SYSTEM PROMPT');
    const workspaceIdx = compiled.indexOf('# WORKSPACE MEMORY');
    const projectIdx = compiled.indexOf('# PROJECT MEMORY');
    const summaryIdx = compiled.indexOf('# CONVERSATION SUMMARY');
    const sessionIdx = compiled.indexOf('# SESSION MEMORY');

    expect(systemIdx).toBeLessThan(workspaceIdx);
    expect(workspaceIdx).toBeLessThan(projectIdx);
    expect(projectIdx).toBeLessThan(summaryIdx);
    expect(summaryIdx).toBeLessThan(sessionIdx);

    // Verify content matching
    expect(compiled).toContain('System Prompt Baseline');
    expect(compiled).toContain('Workspace Fact 1 (importance: 0.8)');
    expect(compiled).toContain('Project Memory Fact 1 (importance: 0.9)');
    expect(compiled).toContain('Latest history summary version');
    expect(compiled).toContain('Temporary session note A');
    expect(compiled).toContain('Temporary session note B');
  });

  it('triggers summarization based on dynamic context token budgets and deltas', async () => {
    // Mock getConversationMessages returning high character count (> 15000 chars)
    vi.mocked(ipcBridge.database.getConversationMessages.invoke).mockResolvedValue({
      data: [
        {
          id: 'msg-1',
          type: 'text',
          position: 'right',
          content: 'A'.repeat(8000),
        },
        {
          id: 'msg-2',
          type: 'text',
          position: 'left',
          content: 'B'.repeat(8000),
        },
      ],
      cursor: null,
    } as any);

    // Mock no previous summary generated yet
    vi.mocked(ipcBridge.conversationMemory.list.invoke).mockResolvedValue([]);

    const { summarizeConversation } = useConversationSummarizer();
    await summarizeConversation('conv-123');

    // Verify the summarizer made the LLM call and saved the versioned summary to the database
    expect(ipcBridge.conversationMemory.add.invoke).toHaveBeenCalledWith(
      expect.objectContaining({
        conversation_id: 'conv-123',
        content: 'Mocked background summary content',
        tags: [expect.stringContaining('chars:')],
        source: 'agent',
      })
    );
  });
});
