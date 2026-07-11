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
import { createPcmRecorder } from '@renderer/services/speech/pcmRecorder';
import type { PcmRecorderHandle } from '@renderer/services/speech/pcmRecorder';

type StateChangeListener = (state: LiveVoiceState) => void;
type ErrorListener = (err: { type: LiveVoiceErrorType; message: string }) => void;

/** Minimal shape returned by ipcBridge.mode.listProviders.invoke(). */
type ProviderInfo = {
  platform: string;
  api_key?: string;
  enabled?: boolean;
};

class AudioStreamPlayer {
  private ctx: AudioContext;
  private nextPlayTime = 0;
  private activeSources = new Set<AudioBufferSourceNode>();
  private gainNode: GainNode | null = null;
  private outputAnalyser: AnalyserNode | null = null;
  private speakerId = 'default';

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
    this.gainNode = this.ctx.createGain();
    this.outputAnalyser = this.ctx.createAnalyser();
    this.outputAnalyser.fftSize = 128;
    this.outputAnalyser.smoothingTimeConstant = 0.82;

    this.gainNode.connect(this.outputAnalyser);
    this.outputAnalyser.connect(this.ctx.destination);
  }

  async setSpeaker(speakerId: string) {
    this.speakerId = speakerId;
    if (typeof (this.ctx as any).setSinkId === 'function') {
      try {
        await (this.ctx as any).setSinkId(speakerId === 'default' ? '' : speakerId);
      } catch (e) {
        console.warn('Failed to set output device:', e);
      }
    }
  }

  getAnalyser(): AnalyserNode {
    return this.outputAnalyser!;
  }

  async playChunk(pcmBytes: Uint8Array, sampleRate = 24000) {
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    const int16 = new Int16Array(pcmBytes.buffer, pcmBytes.byteOffset, pcmBytes.byteLength / 2);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768.0;
    }

    const audioBuffer = this.ctx.createBuffer(1, float32.length, sampleRate);
    audioBuffer.getChannelData(0).set(float32);

    const now = this.ctx.currentTime;
    let startTime = this.nextPlayTime;
    if (startTime < now) {
      startTime = now + 0.03; // small 30ms lookahead to prevent gap
    }

    const source = this.ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.gainNode!);
    source.start(startTime);

    this.activeSources.add(source);
    source.onended = () => {
      this.activeSources.delete(source);
      source.disconnect();
    };

    this.nextPlayTime = startTime + audioBuffer.duration;
  }

  stop() {
    this.activeSources.forEach((src) => {
      try {
        src.stop();
      } catch {}
      src.disconnect();
    });
    this.activeSources.clear();
    this.nextPlayTime = 0;
  }

  destroy() {
    this.stop();
    if (this.gainNode) {
      this.gainNode.disconnect();
    }
    if (this.outputAnalyser) {
      this.outputAnalyser.disconnect();
    }
  }
}

class LiveVoiceManagerImpl {
  private state: LiveVoiceState = 'disconnected';
  private errorType: LiveVoiceErrorType | null = null;
  private session: LiveVoiceSession | null = null;
  private stateListeners = new Set<StateChangeListener>();
  private errorListeners = new Set<ErrorListener>();
  private volumeListeners = new Set<(vol: number) => void>();
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

  // Single shared AudioContext for the manager lifecycle
  private audioContext: AudioContext | null = null;
  private player: AudioStreamPlayer | null = null;
  private recorder: PcmRecorderHandle | null = null;

  // Real-time volume/VAD analysis
  private volumeInterval: ReturnType<typeof setInterval> | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private micSourceNode: MediaStreamAudioSourceNode | null = null;
  private currentVolume = 0.015;

  // Session resumption
  private lastResumptionHandle: string | null = null;
  private overrides: { tts_voice?: string; stt_language?: string } | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('aura:voice-config-changed', () => {
        void this.handleConfigChanged();
      });
    }
  }

  setOverrides(overrides: { tts_voice?: string; stt_language?: string } | null) {
    this.overrides = overrides;
  }

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

  subscribeVolume(listener: (vol: number) => void): () => void {
    this.volumeListeners.add(listener);
    return () => {
      this.volumeListeners.delete(listener);
    };
  }

  getCurrentVolume(): number {
    return this.currentVolume;
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

  private initAudioContext(sampleRate = 24000) {
    if (!this.audioContext) {
      const AudioContextCtor =
        typeof AudioContext !== 'undefined'
          ? AudioContext
          : typeof window !== 'undefined'
            ? (window as any).webkitAudioContext
            : undefined;
      if (AudioContextCtor) {
        this.audioContext = new AudioContextCtor({ sampleRate });
      } else {
        throw new Error('AudioContext not supported');
      }
      this.player = new AudioStreamPlayer(this.audioContext!);
    }
  }

  private setupVolumeAnalysis(stream: MediaStream) {
    if (!this.audioContext) return;
    try {
      this.cleanupMicAnalysis();

      this.micAnalyser = this.audioContext.createAnalyser();
      this.micAnalyser.fftSize = 128;
      this.micAnalyser.smoothingTimeConstant = 0.82;

      this.micSourceNode = this.audioContext.createMediaStreamSource(stream);
      this.micSourceNode.connect(this.micAnalyser);

      const analyserData = new Uint8Array(this.micAnalyser.fftSize);

      this.volumeInterval = setInterval(() => {
        let micRms = 0;
        let outputRms = 0;
        const threshold = this.activeConfig.autoInterruptThreshold ?? 0.04;

        // 1. Measure Mic Input Volume & Check VAD Interruption
        if ((this.state === 'listening' || this.state === 'speaking') && this.micAnalyser) {
          this.micAnalyser.getByteTimeDomainData(analyserData);
          let sum = 0;
          for (const sample of analyserData) {
            const normalized = (sample - 128) / 128;
            sum += normalized * normalized;
          }
          micRms = Math.sqrt(sum / analyserData.length);

          if (this.state === 'speaking' && micRms > threshold && this.activeConfig.autoInterrupt) {
            console.log('Local speech interruption detected, stopping playback...');
            if (this.player) {
              this.player.stop();
            }
            this.setState('listening');
          }
        }

        // 2. Measure Speaker Output Volume
        if (this.state === 'speaking' && this.player) {
          const outAnalyser = this.player.getAnalyser();
          outAnalyser.getByteTimeDomainData(analyserData);
          let sum = 0;
          for (const sample of analyserData) {
            const normalized = (sample - 128) / 128;
            sum += normalized * normalized;
          }
          outputRms = Math.sqrt(sum / analyserData.length);
        }

        // Scale and emit volume
        const activeRms = this.state === 'speaking' ? outputRms : micRms;
        const scaled = Math.max(0.015, Math.min(1.0, activeRms * 5.6));
        this.currentVolume = scaled;
        this.volumeListeners.forEach((listener) => listener(scaled));
      }, 50);
    } catch (e) {
      console.warn('Failed to set up volume analysis:', e);
    }
  }

  private cleanupMicAnalysis() {
    if (this.volumeInterval) {
      clearInterval(this.volumeInterval);
      this.volumeInterval = null;
    }
    if (this.micSourceNode) {
      this.micSourceNode.disconnect();
      this.micSourceNode = null;
    }
    this.micAnalyser = null;
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
    if (this.overrides?.tts_voice) {
      config = { ...config, voiceName: this.overrides.tts_voice };
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
        this.isConnecting = false;
        return;
      }
    }

    // Resolve API Credentials
    let providers: ProviderInfo[] = [];
    try {
      providers = (await ipcBridge.mode.listProviders.invoke()) || [];
    } catch (e) {
      this.setError('network', 'Failed to retrieve providers config');
      this.isConnecting = false;
      return;
    }

    const geminiProvider = providers.find((p) => p.platform === 'gemini' && p.enabled !== false);
    const apiKey = geminiProvider?.api_key || '';
    if (!apiKey) {
      this.setError('no-api-key', 'Gemini API key is not configured');
      this.isConnecting = false;
      return;
    }

    const provider = new GeminiLiveProvider();
    const model = config.liveModel || 'gemini-2.0-flash';
    const sampleRate = provider.sampleRate || 24000;

    try {
      this.initAudioContext(sampleRate);
    } catch (e) {
      this.setError('unknown', 'Failed to initialize AudioContext');
      this.isConnecting = false;
      return;
    }

    if (this.player && config.speakerId) {
      void this.player.setSpeaker(config.speakerId);
    }

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
        voiceName: config.voiceName || 'Aoede',
        sessionResumptionHandle: this.lastResumptionHandle || undefined,
      });

      this.session.on('stateChange', (s: LiveVoiceState) => {
        this.setState(s);
      });

      this.session.on('audio', (chunk: Uint8Array) => {
        if (this.player) {
          this.player.playChunk(chunk, sampleRate).catch((e) => console.error(e));
        }
      });

      this.session.on('resumptionUpdate', (update: any) => {
        if (update.resumable && update.newHandle) {
          this.lastResumptionHandle = update.newHandle;
        }
      });

      this.session.on('error', (err: { type: LiveVoiceErrorType; message: string }) => {
        this.handleSessionError(err);
      });

      this.session.on('close', () => {
        this.handleSessionClose();
      });

      this.reconnectAttempts = 0;

      this.recorder = await createPcmRecorder({
        deviceId: config.microphoneId,
        onChunk: (chunk) => {
          if (
            this.session &&
            (this.state === 'listening' ||
              this.state === 'speaking' ||
              this.state === 'thinking' ||
              this.state === 'executing')
          ) {
            this.session.sendAudioChunk(chunk).catch((e) => {
              console.error('Failed to send audio chunk:', e);
            });
          }
        },
      });

      this.setupVolumeAnalysis(this.recorder.stream);
    } catch (error: unknown) {
      if (this.lastResumptionHandle) {
        console.warn('Session resumption failed, retrying with fresh session...', error);
        this.lastResumptionHandle = null;
        this.isConnecting = false;
        return this.connect();
      }

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
    this.lastResumptionHandle = null;

    // M3: set state to 'disconnected' BEFORE calling s.close().  If the SDK fires
    // the onclose callback synchronously inside close(), handleSessionClose() will
    // see state === 'disconnected' and exit immediately without scheduling a reconnect.
    this.setState('disconnected');
    this.errorType = null;

    this.cleanupMicAnalysis();

    if (this.recorder) {
      const r = this.recorder;
      this.recorder = null;
      await r.stop();
    }

    if (this.player) {
      this.player.stop();
    }

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
    this.state = 'disconnected';
    this.errorType = null;
    this.reconnectAttempts = 0;
    this.micPermissionGranted = false;
    this.isConnecting = false;
    this.lastResumptionHandle = null;

    this.cleanupMicAnalysis();

    if (this.recorder) {
      void this.recorder.stop();
      this.recorder = null;
    }
    if (this.player) {
      this.player.destroy();
      this.player = null;
    }
    if (this.audioContext) {
      void this.audioContext.close();
      this.audioContext = null;
    }
    if (this.session) {
      const s = this.session;
      this.session = null;
      void s.close();
    }
    this.stateListeners.clear();
    this.errorListeners.clear();
    this.volumeListeners.clear();
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

  private async handleConfigChanged() {
    let config: VoiceConfig = DEFAULT_VOICE_CONFIG;
    try {
      const stored = await getClientBusinessSetting('tools.voice');
      if (stored) {
        config = { ...DEFAULT_VOICE_CONFIG, ...stored };
      }
    } catch (e) {
      console.warn('Failed to load voice config on change', e);
      return;
    }

    const prevMic = this.activeConfig.microphoneId;
    const prevSpeaker = this.activeConfig.speakerId;
    this.activeConfig = config;

    if (config.speakerId !== prevSpeaker && this.player) {
      await this.player.setSpeaker(config.speakerId);
    }

    if (config.microphoneId !== prevMic && this.session && this.recorder) {
      console.log('Hot-switching microphone...');
      const oldRecorder = this.recorder;
      this.recorder = null;
      await oldRecorder.stop();

      try {
        this.recorder = await createPcmRecorder({
          deviceId: config.microphoneId,
          onChunk: (chunk) => {
            if (
              this.session &&
              (this.state === 'listening' ||
                this.state === 'speaking' ||
                this.state === 'thinking' ||
                this.state === 'executing')
            ) {
              this.session.sendAudioChunk(chunk).catch((e) => {
                console.error('Failed to send audio chunk:', e);
              });
            }
          },
        });
        this.setupVolumeAnalysis(this.recorder.stream);
      } catch (err) {
        console.error('Failed to hot-switch microphone:', err);
        this.setError('permission-denied', 'Microphone access failed');
      }
    }
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
