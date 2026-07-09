/**
 * @license
 * Copyright 2026 AionUi (aura.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { getClientBusinessSetting } from '@/renderer/services/clientBusinessSettings';
import type { LiveVoiceState, LiveVoiceErrorType, LiveVoiceSession } from './types';
import { GeminiLiveProvider } from './providers/GeminiLiveProvider';
import type { VoiceConfig } from '@/common/types/provider/voice';
import { DEFAULT_VOICE_CONFIG } from '@/common/types/provider/voice';

type StateChangeListener = (state: LiveVoiceState) => void;
type ErrorListener = (err: { type: LiveVoiceErrorType; message: string }) => void;

class LiveVoiceManagerImpl {
  private state: LiveVoiceState = 'disconnected';
  private errorType: LiveVoiceErrorType | null = null;
  private session: LiveVoiceSession | null = null;
  private stateListeners = new Set<StateChangeListener>();
  private errorListeners = new Set<ErrorListener>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectTimer: any = null;
  private activeConfig: VoiceConfig = DEFAULT_VOICE_CONFIG;

  getState(): LiveVoiceState {
    return this.state;
  }

  getErrorType(): LiveVoiceErrorType | null {
    return this.errorType;
  }

  subscribeState(listener: StateChangeListener): () => void {
    this.stateListeners.add(listener);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  subscribeError(listener: ErrorListener): () => void {
    this.errorListeners.add(listener);
    return () => {
      this.errorListeners.delete(listener);
    };
  }

  private setState(state: LiveVoiceState) {
    if (this.state === state) return;
    this.state = state;
    this.stateListeners.forEach((listener) => listener(state));
  }

  private setError(type: LiveVoiceErrorType, message: string) {
    this.errorType = type;
    this.setState('error');
    this.errorListeners.forEach((listener) => listener({ type, message }));
  }

  async toggle(): Promise<void> {
    if (this.state === 'disconnected' || this.state === 'error') {
      await this.connect();
    } else {
      await this.disconnect();
    }
  }

  async connect(): Promise<void> {
    this.setState('connecting');
    this.errorType = null;

    let config: VoiceConfig = DEFAULT_VOICE_CONFIG;
    try {
      const stored = await getClientBusinessSetting('tools.voice');
      if (stored) {
        config = { ...DEFAULT_VOICE_CONFIG, ...stored };
      }
    } catch (e) {
      console.warn('Failed to load voice config settings, using defaults', e);
    }
    this.activeConfig = config;

    // Check Microphone Permission
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
    } catch (e) {
      this.setError('permission-denied', 'Microphone access denied');
      return;
    }

    // Resolve API Credentials
    let providers = [];
    try {
      providers = (await ipcBridge.mode.listProviders.invoke()) || [];
    } catch (e) {
      this.setError('network', 'Failed to retrieve providers config');
      return;
    }

    const geminiProvider = providers.find((p) => p.platform === 'gemini' && p.enabled !== false);
    const apiKey = geminiProvider?.api_key || '';
    if (!apiKey) {
      this.setError('no-api-key', 'Gemini API key is not configured');
      return;
    }

    const provider = new GeminiLiveProvider();
    const model = config.liveModel || 'gemini-2.0-flash';

    try {
      this.session = await provider.connect({
        apiKey,
        model,
        voiceConfig: {
          echoCancellation: config.echoCancellation,
          noiseSuppression: config.noiseSuppression,
        },
      });

      this.session.on('stateChange', (s: LiveVoiceState) => {
        this.setState(s);
      });

      this.session.on('error', (err: { type: LiveVoiceErrorType; message: string }) => {
        this.handleSessionError(err);
      });

      this.session.on('close', () => {
        this.handleSessionClose();
      });

      this.reconnectAttempts = 0;
    } catch (error: any) {
      this.handleSessionError({
        type: 'connection-failed',
        message: error?.message || 'Connection failed',
      });
    }
  }

  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.session) {
      const s = this.session;
      this.session = null;
      await s.close();
    }
    this.setState('disconnected');
    this.errorType = null;
  }

  private handleSessionError(err: { type: LiveVoiceErrorType; message: string }) {
    console.error('Live Voice Session Error:', err);
    this.setError(err.type, err.message);

    if (err.type === 'connection-failed' || err.type === 'network') {
      this.attemptReconnect();
    }
  }

  private handleSessionClose() {
    if (this.state !== 'disconnected') {
      this.setState('disconnected');
      this.attemptReconnect();
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.setState('disconnected');
      return;
    }
    this.reconnectAttempts++;
    this.setState('connecting');

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch((err) => {
        console.error('Reconnection attempt failed:', err);
      });
    }, 2000 * this.reconnectAttempts);
  }
}

export const LiveVoiceManager = new LiveVoiceManagerImpl();
export { DEFAULT_VOICE_CONFIG };
