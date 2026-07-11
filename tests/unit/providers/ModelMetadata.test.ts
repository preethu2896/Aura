/**
 * @license
 * Copyright 2026 AURA (aura.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { resolveModelMetadata } from '@/common/utils/modelMetadataRegistry';
import { ApiKeyManager } from '@/common/api/ApiKeyManager';
import { AuthType } from '@office-ai/aioncli-core';

describe('Model Metadata & Capability Discovery', () => {
  describe('Known Models Lookups', () => {
    it('resolves correct metadata for gemini-2.0-flash', () => {
      const meta = resolveModelMetadata('gemini', 'gemini-2.0-flash');
      expect(meta.id).toBe('gemini-2.0-flash');
      expect(meta.displayName).toBe('Gemini 2.0 Flash');
      expect(meta.provider).toBe('gemini');
      expect(meta.contextWindow).toBe(1048576);
      expect(meta.supportsVision).toBe(true);
      expect(meta.supportsRealtimeVoice).toBe(true);
      expect(meta.supportsToolCalling).toBe(true);
      expect(meta.maxOutputTokens).toBe(8192);
    });

    it('resolves correct metadata for gpt-4o', () => {
      const meta = resolveModelMetadata('openai', 'gpt-4o');
      expect(meta.id).toBe('gpt-4o');
      expect(meta.displayName).toBe('GPT-4o');
      expect(meta.provider).toBe('openai');
      expect(meta.contextWindow).toBe(128000);
      expect(meta.supportsVision).toBe(true);
      expect(meta.supportsRealtimeVoice).toBe(false);
      expect(meta.supportsReasoning).toBe(false);
      expect(meta.maxOutputTokens).toBe(4096);
    });

    it('resolves correct metadata for claude-3-5-sonnet', () => {
      const meta = resolveModelMetadata('anthropic', 'claude-3-5-sonnet');
      expect(meta.id).toBe('claude-3-5-sonnet');
      expect(meta.displayName).toBe('Claude 3.5 Sonnet');
      expect(meta.provider).toBe('anthropic');
      expect(meta.contextWindow).toBe(200000);
      expect(meta.supportsVision).toBe(true);
      expect(meta.supportsToolCalling).toBe(true);
      expect(meta.maxOutputTokens).toBe(8192);
    });

    it('resolves correct metadata for deepseek-reasoner', () => {
      const meta = resolveModelMetadata('deepseek', 'deepseek-reasoner');
      expect(meta.id).toBe('deepseek-reasoner');
      expect(meta.displayName).toBe('DeepSeek R1');
      expect(meta.provider).toBe('deepseek');
      expect(meta.contextWindow).toBe(64000);
      expect(meta.supportsVision).toBe(false);
      expect(meta.supportsReasoning).toBe(true);
      expect(meta.supportsToolCalling).toBe(false);
    });
  });

  describe('Fallback Heuristics for Unrecognized Custom/Local Models', () => {
    it('detects vision and image capabilities from suffix or name', () => {
      const meta = resolveModelMetadata('custom', 'my-local-llama-vision-model');
      expect(meta.displayName).toBe('My Local Llama Vision Model');
      expect(meta.supportsVision).toBe(true);
      expect(meta.supportsImages).toBe(true);
    });

    it('detects reasoning capability from suffix or name', () => {
      const meta = resolveModelMetadata('custom', 'ollama-r1-thinker');
      expect(meta.supportsReasoning).toBe(true);
      expect(meta.supportsToolCalling).toBe(false);
    });

    it('resolves default metadata for standard custom text models', () => {
      const meta = resolveModelMetadata('custom-provider', 'llama-3.2-3b');
      expect(meta.displayName).toBe('Llama 3.2 3b');
      expect(meta.provider).toBe('custom-provider');
      expect(meta.supportsStreaming).toBe(true);
      expect(meta.supportsVision).toBe(false);
      expect(meta.supportsReasoning).toBe(false);
      expect(meta.supportsToolCalling).toBe(true);
    });
  });
});

describe('Extended ApiKeyManager Support', () => {
  it('does not throw and falls back gracefully for unknown future auth types', () => {
    const customAuthType = 9999 as any;
    let manager: InstanceType<typeof ApiKeyManager> | undefined;
    expect(() => {
      manager = new ApiKeyManager('key1,key2', customAuthType);
    }).not.toThrow();
    // After construction the manager must return one of the configured keys
    const key = manager?.getCurrentKey();
    expect(['key1', 'key2']).toContain(key?.trim());
  });
});
