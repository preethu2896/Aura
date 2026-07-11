import { GoogleGenAI, Modality } from '@google/genai';
import type { LiveVoiceProvider, LiveVoiceSession } from '../types';
import { pcmToBase64 } from '../audioEncoder';

export class GeminiLiveSession implements LiveVoiceSession {
  private conn: any = null;
  private callbacks: Record<string, Function[]> = {
    audio: [],
    text: [],
    stateChange: [],
    error: [],
    close: [],
    resumptionUpdate: [],
  };

  constructor(session: any) {
    this.conn = session;
  }

  async sendAudioChunk(chunk: Uint8Array): Promise<void> {
    if (this.conn) {
      const base64Data = pcmToBase64(chunk);
      this.conn.sendRealtimeInput({
        media: {
          data: base64Data,
          mimeType: 'audio/pcm;rate=24000',
        },
      });
    }
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
    // C3: reset all listener arrays so that any SDK callbacks (onerror, onclose)
    // that fire after this point during WebSocket teardown are silently discarded
    // and cannot trigger state changes in LiveVoiceManager.
    this.callbacks = { audio: [], text: [], stateChange: [], error: [], close: [], resumptionUpdate: [] };
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
  readonly sampleRate = 24000;
  readonly mimeType = 'audio/pcm';

  async connect(options: {
    apiKey: string;
    model: string;
    voiceConfig: {
      echoCancellation?: boolean;
      noiseSuppression?: boolean;
      // M6: device selection forwarded from VoiceConfig; reserved for Phase 2
      microphoneId?: string;
    };
    voiceName?: string;
    sessionResumptionHandle?: string;
  }): Promise<LiveVoiceSession> {
    const ai = new GoogleGenAI({ apiKey: options.apiKey });

    // H4: liveSession is assigned only after `await ai.live.connect(...)` resolves.
    // Some WebSocket implementations fire `onopen` (or even `onerror`) synchronously
    // before the promise settles.  Queue those events and replay them once the
    // GeminiLiveSession wrapper exists.
    let liveSession: GeminiLiveSession | null = null;
    const pendingEvents: Array<{ event: string; args: unknown[] }> = [];

    const emitOrQueue = (event: string, ...args: unknown[]): void => {
      if (liveSession) {
        liveSession.emit(event, ...args);
      } else {
        pendingEvents.push({ event, args });
      }
    };

    const config: any = {
      generationConfig: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: options.voiceName || 'Aoede',
            },
          },
        },
      },
      sessionResumption: {},
    };

    if (options.sessionResumptionHandle) {
      config.sessionResumption.handle = options.sessionResumptionHandle;
    }

    const session = await ai.live.connect({
      model: options.model,
      config,
      callbacks: {
        onopen: () => {
          emitOrQueue('stateChange', 'listening');
        },
        onmessage: (message: any) => {
          if (message.sessionResumptionUpdate) {
            emitOrQueue('resumptionUpdate', message.sessionResumptionUpdate);
          }
          if (message.serverContent) {
            const turn = message.serverContent.modelTurn;
            if (turn && turn.parts) {
              for (const part of turn.parts) {
                if (part.text) {
                  emitOrQueue('text', part.text);
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
                    emitOrQueue('audio', bytes);
                  }
                }
              }
            }

            if (message.serverContent.interrupted) {
              emitOrQueue('stateChange', 'listening');
            } else if (message.serverContent.turnComplete) {
              emitOrQueue('stateChange', 'listening');
            } else if (message.serverContent.modelTurn) {
              emitOrQueue('stateChange', 'speaking');
            }
          }
        },
        onerror: (err: any) => {
          emitOrQueue('error', { type: 'connection-failed', message: err?.message || 'Connection error' });
        },
        onclose: (_e: any) => {
          emitOrQueue('close');
        },
      },
    });

    liveSession = new GeminiLiveSession(session);

    // H4: replay any events that were queued before liveSession was assigned
    for (const { event, args } of pendingEvents) {
      liveSession.emit(event, ...args);
    }

    return liveSession;
  }
}
