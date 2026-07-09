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

/** Minimal shape returned by ipcBridge.mode.listProviders.invoke(). */
type ProviderInfo = {
  platform: string;
  api_key?: string;
  enabled?: boolean;
};

class LiveVoiceManagerImpl {
  private state: LiveVoiceState = 'disconnected';
  private errorType: LiveVoiceErrorType | null = null;
  private session: LiveVoiceSession | null = null;
  private stateListeners = new Set<StateChangeListener>();
  private errorListeners = new Set<ErrorListener>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  // H5: use the correct renderer-process timer type instead of `any`
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private activeConfig: VoiceConfig = DEFAULT_VOICE_CONFIG;
  // H3: cache the mic-permission check so reconnects don't re-prompt the user
  private micPermissionGranted = false;
  // C2: explicit flag so the internal reconnect timer can always call connect()
  // while external concurrent callers are blocked.
  private isConnecting = false;

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
    // H3: if permission was revoked externally, invalidate the cache
    if (type === 'permission-denied') {
      this.micPermissionGranted = false;
    }
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
    // C2: re-entrancy guard — if an external caller fires connect() while a
    // connect() coroutine is already in-flight, silently ignore the duplicate.
    // We use an explicit boolean rather than checking state so that the internal
    // reconnect timer callback (which runs after state is already 'connecting')
    // can still proceed normally.
    if (this.isConnecting) return;
    this.isConnecting = true;

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

    // H3: request mic permission only on the first connect; cache the result so
    // automatic reconnect attempts do not re-prompt the operating system.
    if (!this.micPermissionGranted) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
        this.micPermissionGranted = true;
      } catch (e) {
        this.setError('permission-denied', 'Microphone access denied');
        return;
      }
    }

    // Resolve API Credentials
    let providers: ProviderInfo[] = [];
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
          // M6: forward the user's device selection so the provider can act on it
          microphoneId: config.microphoneId,
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
    } catch (error: unknown) {
      this.handleSessionError({
        type: 'connection-failed',
        message: error instanceof Error ? error.message : 'Connection failed',
      });
    } finally {
      this.isConnecting = false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = 0;
    this.isConnecting = false;

    // M3: set state to 'disconnected' BEFORE calling s.close().  If the SDK fires
    // the onclose callback synchronously inside close(), handleSessionClose() will
    // see state === 'disconnected' and exit immediately without scheduling a reconnect.
    this.setState('disconnected');
    this.errorType = null;

    if (this.session) {
      const s = this.session;
      this.session = null;
      await s.close();
    }
  }

  /**
   * H1: full teardown — releases all timers, closes the active session, and clears
   * all listener sets.  Called by Vite HMR on module reload to prevent listener
   * accumulation across hot-reload cycles.
   */
  destroy(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.session) {
      void this.session.close();
      this.session = null;
    }
    this.stateListeners.clear();
    this.errorListeners.clear();
    this.state = 'disconnected';
    this.errorType = null;
    this.reconnectAttempts = 0;
    this.micPermissionGranted = false;
    this.isConnecting = false;
  }

  private handleSessionError(err: { type: LiveVoiceErrorType; message: string }) {
    console.error('Live Voice Session Error:', err);
    this.setError(err.type, err.message);

    if (err.type === 'connection-failed' || err.type === 'network') {
      this.attemptReconnect();
    }
  }

  private handleSessionClose() {
    if (this.state === 'disconnected') return;
    // C1: if a reconnect timer is already pending (scheduled by handleSessionError),
    // do not stack a second one.  The timer is set synchronously in attemptReconnect
    // so this check is safe even when onerror and onclose fire back-to-back.
    if (this.reconnectTimer !== null) return;
    this.setState('disconnected');
    this.attemptReconnect();
  }

  private attemptReconnect() {
    // C1: prevent duplicate timers when both onerror and onclose fire for the same
    // failure (the common WebSocket teardown pattern).
    if (this.reconnectTimer !== null) return;

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.setState('disconnected');
      return;
    }
    this.reconnectAttempts++;
    this.setState('connecting');

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      // Reset state to 'disconnected' so connect()'s isConnecting guard allows
      // re-entry from the timer callback path.
      this.setState('disconnected');
      this.connect().catch((err) => {
        console.error('Reconnection attempt failed:', err);
      });
    }, 2000 * this.reconnectAttempts);
  }
}

export const LiveVoiceManager = new LiveVoiceManagerImpl();
export { DEFAULT_VOICE_CONFIG };

// H1: dispose the singleton when Vite hot-reloads this module so that stale
// listener references from the previous module instance are released.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    LiveVoiceManager.destroy();
  });
}
