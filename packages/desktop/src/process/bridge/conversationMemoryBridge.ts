import { randomUUID } from 'node:crypto';
import { ipcBridge } from '@/common';
import type { TConversationMemory, AddConversationMemoryRequest } from '@/common/types/project/memoryTypes';
import { resolveLegacyDatabasePath } from '@process/services/database/runLegacyDatabaseMigrations';
import { BetterSqlite3Driver } from '@process/services/database/drivers/BetterSqlite3Driver';
import { ClientFactory } from '@/common/api';
import { normalizeTextMessageContent } from '@/common/chat/chatLib';

function getMessageText(m: any): string {
  if (m.type !== 'text') return '';
  try {
    const parsed = normalizeTextMessageContent(m.content);
    return parsed?.content || '';
  } catch {
    return typeof m.content === 'string' ? m.content : '';
  }
}

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

  // Generate conversation summary version
  ipcBridge.conversationMemory.summarize.provider(async (p: { conversationId: string }) => {
    // 1. Fetch conversation details to get model/provider configuration
    const conversation = runDb((db) => {
      return db.prepare('SELECT * FROM conversations WHERE id = ?').get(p.conversationId) as any;
    });
    if (!conversation || conversation.type !== 'aionrs') return null;

    const provider = conversation.model ? JSON.parse(conversation.model) : null;
    if (!provider || !provider.api_key) return null;

    const extra = conversation.extra ? JSON.parse(conversation.extra) : null;
    const totalTokens = extra?.last_token_usage?.total_tokens ?? 0;

    // 2. Fetch recent messages in conversation
    const messages = runDb((db) => {
      return db
        .prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT 100')
        .all(p.conversationId) as any[];
    });
    if (messages.length === 0) return null;

    let totalChars = 0;
    const parsedMessages = messages.map((m: any) => {
      const text = getMessageText(m);
      totalChars += text.length;
      return {
        position: m.position,
        text,
      };
    });

    const tokenThresholdExceeded = totalTokens > 4000;
    const charThresholdExceeded = totalChars > 15000;

    if (!tokenThresholdExceeded && !charThresholdExceeded) {
      return null; // Below context budget threshold
    }

    // 3. Fetch latest summary to check delta
    const summaries = runDb((db) => {
      const stmt = db.prepare('SELECT * FROM conversation_memory WHERE conversation_id = ? ORDER BY created_at DESC');
      return stmt.all(p.conversationId) as any[];
    });
    let lastChars = 0;
    if (summaries.length > 0) {
      const latest = summaries[0];
      const tags = JSON.parse(latest.tags || '[]') as string[];
      const charTag = tags?.find((t) => t.startsWith('chars:'));
      if (charTag) {
        lastChars = parseInt(charTag.split(':')[1] || '0', 10);
      }
    }

    const charDelta = totalChars - lastChars;
    // Trigger new summary version only if delta exceeds 3000 characters (~750-1000 tokens)
    if (summaries.length > 0 && charDelta < 3000) {
      return null;
    }

    // 4. Compile messages transcript for prompt
    const transcript = parsedMessages
      .filter((m) => m.text)
      .map((m) => `${m.position === 'right' ? 'User' : 'Assistant'}: ${m.text}`)
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
    if (!summaryContent) return null;

    // 6. Insert new versioned summary row in SQLite
    const now = Date.now();
    const id = randomUUID();
    const tags = JSON.stringify([`chars:${totalChars}`]);
    runDb((db) => {
      db.prepare(
        `INSERT INTO conversation_memory (id, conversation_id, content, importance, tags, source, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(id, p.conversationId, summaryContent, 0.5, tags, 'agent', now, now);
    });

    return summaryContent;
  });
}
