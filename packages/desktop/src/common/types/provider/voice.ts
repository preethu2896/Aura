/**
 * @license
 * Copyright 2026 AionUi (aura.com)
 * SPDX-License-Identifier: Apache-2.0
 */

export type VoiceConfig = {
  enabled: boolean;
  preferredProvider: string;
  liveModel: string;
  microphoneId: string;
  speakerId: string;
  noiseSuppression: boolean;
  echoCancellation: boolean;
  voiceActivityDetection: boolean;
  autoInterrupt: boolean;
};

export const DEFAULT_VOICE_CONFIG: VoiceConfig = {
  enabled: false,
  preferredProvider: 'gemini',
  liveModel: 'gemini-2.0-flash',
  microphoneId: 'default',
  speakerId: 'default',
  noiseSuppression: true,
  echoCancellation: true,
  voiceActivityDetection: true,
  autoInterrupt: true,
};
