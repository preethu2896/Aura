/**
 * @license
 * Copyright 2025 AionUi (aura.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useRef } from 'react';
import { ipcBridge } from '@/common';
import { ClientFactory } from '@/common/api';
import { getConversationOrNull } from '@/renderer/pages/conversation/utils/conversationCache';

export function useConversationSummarizer() {
  const summarizingRef = useRef<Record<string, boolean>>({});

  const summarizeConversation = useCallback(async (conversationId: string) => {
    if (summarizingRef.current[conversationId]) return;

    try {
      // 1. Fetch conversation details to get model/provider configuration and last token usage
      const conversation = await getConversationOrNull(conversationId);
      if (!conversation || conversation.type !== 'aionrs') return;
      const provider = conversation.model;
      if (!provider || !provider.api_key) return;

      const totalTokens = conversation.extra?.last_token_usage?.total_tokens ?? 0;

      // 2. Fetch recent messages in conversation
      const messagesResult = await ipcBridge.database.getConversationMessages.invoke({
        conversation_id: conversationId,
        limit: 100,
      });
      const messages = messagesResult.items ?? [];
      if (messages.length === 0) return;

      const totalChars = messages.reduce((sum: number, m: any) => sum + (m.content?.length || 0), 0);

      // Check threshold: total tokens > 4000 OR total characters > 15000
      const tokenThresholdExceeded = totalTokens > 4000;
      const charThresholdExceeded = totalChars > 15000;

      if (!tokenThresholdExceeded && !charThresholdExceeded) {
        return; // Below context budget threshold
      }

      // 3. Fetch latest summary to check delta
      const summaries = await ipcBridge.conversationMemory.list.invoke({ conversationId });
      let lastChars = 0;
      if (summaries.length > 0) {
        const latest = summaries[0];
        // Parse char count from tags
        const charTag = latest.tags?.find((t) => t.startsWith('chars:'));
        if (charTag) {
          lastChars = parseInt(charTag.split(':')[1] || '0', 10);
        }
      }

      const charDelta = totalChars - lastChars;
      // Trigger new summary version only if delta exceeds 3000 characters (~750-1000 tokens)
      if (summaries.length > 0 && charDelta < 3000) {
        return;
      }

      summarizingRef.current[conversationId] = true;

      // 4. Compile messages transcript for prompt
      const transcript = messages
        .filter((m: any) => m.type === 'text' || m.type === 'content')
        .map((m: any) => `${m.position === 'right' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n');

      const prompt = `Analyze this conversation history and output a concise, bulleted summary of key facts, user preferences, writing style instructions, and important outcomes established during the chat.
This summary will be injected into future system prompts. Output only the summarized list, no introductory greetings or explanations.

[Conversation History]
${transcript}`;

      // 5. Instantiate LLM Client and request summary
      const client = await ClientFactory.createRotatingClient(provider);
      const response = await (client as any).createChatCompletion({
        model: provider.use_model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const summaryContent = response.choices?.[0]?.message?.content?.trim();
      if (!summaryContent) return;

      // 6. Insert new versioned summary row in SQLite
      await ipcBridge.conversationMemory.add.invoke({
        conversation_id: conversationId,
        content: summaryContent,
        tags: [`chars:${totalChars}`],
        source: 'agent',
      });

      console.log(`[ConversationSummarizer] Summary version created for conversation ${conversationId}`);
    } catch (err) {
      console.error('[ConversationSummarizer] Failed to summarize conversation', err);
    } finally {
      summarizingRef.current[conversationId] = false;
    }
  }, []);

  return { summarizeConversation };
}
