/**
 * @license
 * Copyright 2026 AionUi (aura.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Modality } from '@google/genai';
import type { LiveVoiceProvider, LiveVoiceSession } from '../types';
import { LiveVoiceState, LiveVoiceErrorType } from '../types';

export class GeminiLiveSession implements LiveVoiceSession {
  private conn: any = null;
  private callbacks: Record<string, Function[]> = {
    audio: [],
    text: [],
    stateChange: [],
    error: [],
    close: [],
  };

  constructor(session: any) {
    this.conn = session;
  }

  async sendAudioChunk(_chunk: Uint8Array): Promise<void> {
    // Phase 1: Stubbed, not implemented
  }

  async sendTextMessage(text: string): Promise<void> {
    if (this.conn) {
      this.conn.sendClientContent({
        turns: [{ role: 'user', parts: [{ text }] }],
        turnComplete: true,
      });
    }
  }

  async close(): Promise<void> {
    if (this.conn) {
      this.conn.close();
      this.conn = null;
    }
  }

  on(event: string, callback: any): void {
    if (this.callbacks[event]) {
      this.callbacks[event].push(callback);
    }
  }

  emit(event: string, ...args: any[]): void {
    const list = this.callbacks[event];
    if (list) {
      list.forEach((cb) => cb(...args));
    }
  }
}

export class GeminiLiveProvider implements LiveVoiceProvider {
  async connect(options: {
    apiKey: string;
    model: string;
    voiceConfig: {
      echoCancellation?: boolean;
      noiseSuppression?: boolean;
    };
  }): Promise<LiveVoiceSession> {
    const ai = new GoogleGenAI({ apiKey: options.apiKey });

    let liveSession: GeminiLiveSession | null = null;

    const session = await ai.live.connect({
      model: options.model,
      config: {
        generationConfig: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: 'Aoede',
              },
            },
          },
        },
      },
      callbacks: {
        onopen: () => {
          if (liveSession) {
            liveSession.emit('stateChange', 'listening');
          }
        },
        onmessage: (message: any) => {
          if (!liveSession) return;

          if (message.serverContent) {
            const turn = message.serverContent.modelTurn;
            if (turn && turn.parts) {
              for (const part of turn.parts) {
                if (part.text) {
                  liveSession.emit('text', part.text);
                }
                if (part.inlineData && part.inlineData.mimeType?.startsWith('audio/')) {
                  const base64Data = part.inlineData.data;
                  if (base64Data) {
                    const binaryString = atob(base64Data);
                    const len = binaryString.length;
                    const bytes = new Uint8Array(len);
                    for (let i = 0; i < len; i++) {
                      bytes[i] = binaryString.charCodeAt(i);
                    }
                    liveSession.emit('audio', bytes);
                  }
                }
              }
            }

            if (message.serverContent.interrupted) {
              liveSession.emit('stateChange', 'listening');
            } else if (message.serverContent.turnComplete) {
              liveSession.emit('stateChange', 'listening');
            } else if (message.serverContent.modelTurn) {
              liveSession.emit('stateChange', 'speaking');
            }
          }
        },
        onerror: (err: any) => {
          if (liveSession) {
            liveSession.emit('error', { type: 'connection-failed', message: err?.message || 'Connection error' });
          }
        },
        onclose: (e: any) => {
          if (liveSession) {
            liveSession.emit('close');
          }
        },
      },
    });

    liveSession = new GeminiLiveSession(session);
    return liveSession;
  }
}
