/**
 * @license
 * Copyright 2025 AionUi (aura.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useRef } from 'react';
import { ipcBridge } from '@/common';

export function useConversationSummarizer() {
  const summarizingRef = useRef<Record<string, boolean>>({});

  const summarizeConversation = useCallback(async (conversationId: string) => {
    if (summarizingRef.current[conversationId]) return;

    try {
      summarizingRef.current[conversationId] = true;
      const summaryContent = await ipcBridge.conversationMemory.summarize.invoke({ conversationId });
      if (summaryContent) {
        console.log(`[ConversationSummarizer] Summary version created for conversation ${conversationId}`);
      }
    } catch (err) {
      console.error('[ConversationSummarizer] Failed to summarize conversation', err);
    } finally {
      summarizingRef.current[conversationId] = false;
    }
  }, []);

  return { summarizeConversation };
}
