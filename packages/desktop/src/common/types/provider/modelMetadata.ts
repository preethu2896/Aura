/**
 * @license
 * Copyright 2026 AURA (aura.com)
 * SPDX-License-Identifier: Apache-2.0
 */

export type ModelMetadata = {
  id: string;
  displayName: string;
  provider: string;
  contextWindow: number;
  supportsVision: boolean;
  supportsVoice: boolean;
  supportsRealtimeVoice: boolean;
  supportsStreaming: boolean;
  supportsToolCalling: boolean;
  supportsReasoning: boolean;
  supportsEmbeddings: boolean;
  supportsImages: boolean;
  maxOutputTokens: number;
  pricing?: {
    inputCostPer1K?: number;
    outputCostPer1K?: number;
  };
};
