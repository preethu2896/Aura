/**
 * @license
 * Copyright 2026 AURA (aura.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ModelMetadata } from '../types/provider/modelMetadata';

/**
 * Standard registry database of known model specifications.
 */
export const KNOWN_MODELS_METADATA: Record<string, Omit<ModelMetadata, 'id' | 'provider'>> = {
  // Gemini Models (Reference Implementation)
  'gemini-2.0-flash': {
    displayName: 'Gemini 2.0 Flash',
    contextWindow: 1048576,
    supportsVision: true,
    supportsVoice: true,
    supportsRealtimeVoice: true,
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsReasoning: false,
    supportsEmbeddings: false,
    supportsImages: true,
    maxOutputTokens: 8192,
  },
  'gemini-2.0-flash-lite': {
    displayName: 'Gemini 2.0 Flash Lite',
    contextWindow: 1048576,
    supportsVision: true,
    supportsVoice: true,
    supportsRealtimeVoice: true,
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsReasoning: false,
    supportsEmbeddings: false,
    supportsImages: true,
    maxOutputTokens: 8192,
  },
  'gemini-2.0-pro': {
    displayName: 'Gemini 2.0 Pro (Experimental)',
    contextWindow: 2097152,
    supportsVision: true,
    supportsVoice: true,
    supportsRealtimeVoice: true,
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsReasoning: false,
    supportsEmbeddings: false,
    supportsImages: true,
    maxOutputTokens: 8192,
  },
  'gemini-1.5-pro': {
    displayName: 'Gemini 1.5 Pro',
    contextWindow: 2097152,
    supportsVision: true,
    supportsVoice: true,
    supportsRealtimeVoice: true,
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsReasoning: false,
    supportsEmbeddings: false,
    supportsImages: true,
    maxOutputTokens: 8192,
  },
  'gemini-1.5-flash': {
    displayName: 'Gemini 1.5 Flash',
    contextWindow: 1048576,
    supportsVision: true,
    supportsVoice: true,
    supportsRealtimeVoice: true,
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsReasoning: false,
    supportsEmbeddings: false,
    supportsImages: true,
    maxOutputTokens: 8192,
  },

  // OpenAI Models
  'gpt-4o': {
    displayName: 'GPT-4o',
    contextWindow: 128000,
    supportsVision: true,
    supportsVoice: true,
    supportsRealtimeVoice: false,
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsReasoning: false,
    supportsEmbeddings: false,
    supportsImages: true,
    maxOutputTokens: 4096,
  },
  'gpt-4o-mini': {
    displayName: 'GPT-4o Mini',
    contextWindow: 128000,
    supportsVision: true,
    supportsVoice: true,
    supportsRealtimeVoice: false,
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsReasoning: false,
    supportsEmbeddings: false,
    supportsImages: true,
    maxOutputTokens: 16384,
  },
  'o1-preview': {
    displayName: 'O1 Preview',
    contextWindow: 128000,
    supportsVision: false,
    supportsVoice: false,
    supportsRealtimeVoice: false,
    supportsStreaming: true,
    supportsToolCalling: false,
    supportsReasoning: true,
    supportsEmbeddings: false,
    supportsImages: false,
    maxOutputTokens: 32768,
  },
  'o1-mini': {
    displayName: 'O1 Mini',
    contextWindow: 128000,
    supportsVision: false,
    supportsVoice: false,
    supportsRealtimeVoice: false,
    supportsStreaming: true,
    supportsToolCalling: false,
    supportsReasoning: true,
    supportsEmbeddings: false,
    supportsImages: false,
    maxOutputTokens: 65536,
  },

  // Anthropic Models
  'claude-3-5-sonnet': {
    displayName: 'Claude 3.5 Sonnet',
    contextWindow: 200000,
    supportsVision: true,
    supportsVoice: false,
    supportsRealtimeVoice: false,
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsReasoning: false,
    supportsEmbeddings: false,
    supportsImages: true,
    maxOutputTokens: 8192,
  },
  'claude-3-5-haiku': {
    displayName: 'Claude 3.5 Haiku',
    contextWindow: 200000,
    supportsVision: false,
    supportsVoice: false,
    supportsRealtimeVoice: false,
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsReasoning: false,
    supportsEmbeddings: false,
    supportsImages: false,
    maxOutputTokens: 8192,
  },
  'claude-3-opus': {
    displayName: 'Claude 3 Opus',
    contextWindow: 200000,
    supportsVision: true,
    supportsVoice: false,
    supportsRealtimeVoice: false,
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsReasoning: false,
    supportsEmbeddings: false,
    supportsImages: true,
    maxOutputTokens: 4096,
  },

  // DeepSeek Models
  'deepseek-chat': {
    displayName: 'DeepSeek V3',
    contextWindow: 64000,
    supportsVision: false,
    supportsVoice: false,
    supportsRealtimeVoice: false,
    supportsStreaming: true,
    supportsToolCalling: true,
    supportsReasoning: false,
    supportsEmbeddings: false,
    supportsImages: false,
    maxOutputTokens: 4096,
  },
  'deepseek-reasoner': {
    displayName: 'DeepSeek R1',
    contextWindow: 64000,
    supportsVision: false,
    supportsVoice: false,
    supportsRealtimeVoice: false,
    supportsStreaming: true,
    supportsToolCalling: false,
    supportsReasoning: true,
    supportsEmbeddings: false,
    supportsImages: false,
    maxOutputTokens: 8192,
  },
};

/**
 * Format modelId into a readable display name.
 */
function formatDisplayName(modelId: string): string {
  return modelId
    .split(/[-_]/)
    .map((word) => {
      if (!word) return '';
      if (word.match(/^(gpt|gemini|claude|api|id)$/i)) {
        return word.toUpperCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .filter(Boolean)
    .join(' ');
}

/**
 * Resolve rich metadata parameters for any model.
 */
export function resolveModelMetadata(platform: string, modelId: string): ModelMetadata {
  const normalizedId = modelId.toLowerCase().trim();
  const known = KNOWN_MODELS_METADATA[normalizedId];

  if (known) {
    return {
      ...known,
      id: modelId,
      provider: platform,
    };
  }

  // Fallback for custom / local / unknown models
  const provider = platform || 'custom';
  const displayName = formatDisplayName(modelId);

  // Fallback heuristics based on naming conventions
  const supportsVision = /vision|vl|multimodal|clip/i.test(normalizedId);
  const supportsReasoning = /reason|think|o1|r1|deepseek-r/i.test(normalizedId);
  const supportsEmbeddings = /embed|retrieval/i.test(normalizedId);
  const supportsRealtimeVoice = platform === 'gemini' && /gemini-2\.0|gemini-1\.5/i.test(normalizedId);
  const supportsVoice = platform === 'gemini' || /voice|audio/i.test(normalizedId);

  let contextWindow = 16384;
  if (/128k/i.test(normalizedId)) {
    contextWindow = 128000;
  } else if (/32k/i.test(normalizedId)) {
    contextWindow = 32768;
  } else if (/gpt-4/i.test(normalizedId)) {
    contextWindow = 128000;
  } else if (/claude/i.test(normalizedId)) {
    contextWindow = 200000;
  } else if (/gemini/i.test(normalizedId)) {
    contextWindow = 1048576;
  }

  return {
    id: modelId,
    displayName,
    provider,
    contextWindow,
    supportsVision,
    supportsVoice,
    supportsRealtimeVoice,
    supportsStreaming: !/non-stream/i.test(normalizedId),
    supportsToolCalling: !/no-tools/i.test(normalizedId) && !supportsReasoning,
    supportsReasoning,
    supportsEmbeddings,
    supportsImages: supportsVision,
    maxOutputTokens: /mini/i.test(normalizedId) ? 16384 : 4096,
  };
}
