/**
 * @license
 * Copyright 2026 AionUi (aura.com)
 * SPDX-License-Identifier: Apache-2.0
 */

export type LiveVoiceState =
  | 'disconnected'
  | 'connecting'
  | 'listening'
  | 'thinking'
  | 'executing'
  | 'speaking'
  | 'error';

export type LiveVoiceErrorType =
  | 'no-api-key'
  | 'permission-denied'
  | 'network'
  | 'connection-failed'
  | 'timeout'
  | 'unknown';

export interface LiveVoiceSession {
  sendAudioChunk(chunk: Uint8Array): Promise<void>;
  sendTextMessage(text: string): Promise<void>;
  close(): Promise<void>;
  on(event: 'audio', callback: (data: Uint8Array) => void): void;
  on(event: 'text', callback: (text: string) => void): void;
  on(event: 'stateChange', callback: (state: LiveVoiceState) => void): void;
  on(event: 'error', callback: (err: { type: LiveVoiceErrorType; message: string }) => void): void;
  on(event: 'close', callback: () => void): void;
  on(event: 'resumptionUpdate', callback: (update: any) => void): void;
}

export interface LiveVoiceProvider {
  readonly sampleRate: number;
  readonly mimeType: string;
  connect(options: {
    apiKey: string;
    model: string;
    voiceConfig: {
      echoCancellation?: boolean;
      noiseSuppression?: boolean;
      // M6: device selection forwarded from VoiceConfig; reserved for Phase 2 audio capture
      microphoneId?: string;
    };
    voiceName?: string;
    sessionResumptionHandle?: string;
  }): Promise<LiveVoiceSession>;
}
