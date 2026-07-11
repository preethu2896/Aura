/**
 * @license
 * Copyright 2026 AionUi (aura.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveVoiceManager } from '@/renderer/services/voice/LiveVoiceService';
import type { LiveVoiceState } from '@/renderer/services/voice/types';

// Mock Browser APIs
const mockGetTracks = vi.fn(() => []);
const mockStopTrack = vi.fn();
const mockStream = {
  getTracks: () => [{ stop: mockStopTrack }],
};

const mockGetUserMedia = vi.fn(async () => mockStream);

// Mock Web Audio Context APIs
class MockAudioNode {
  connect = vi.fn();
  disconnect = vi.fn();
}

class MockAnalyserNode extends MockAudioNode {
  fftSize = 128;
  smoothingTimeConstant = 0.82;
  getByteTimeDomainData = vi.fn((array: Uint8Array) => {
    // Fill array with silent values (128) by default
    array.fill(128);
  });
}

class MockGainNode extends MockAudioNode {
  gain = { value: 1 };
}

class MockAudioBufferSourceNode extends MockAudioNode {
  buffer = null;
  start = vi.fn();
  stop = vi.fn();
  onended: (() => void) | null = null;
}

class MockAudioContext {
  state = 'suspended';
  currentTime = 0;
  destination = {};
  createGain() {
    return new MockGainNode();
  }
  createAnalyser() {
    return new MockAnalyserNode();
  }
  createMediaStreamSource() {
    return new MockAudioNode();
  }
  createBuffer() {
    return {
      duration: 1,
      getChannelData: () => new Float32Array(100),
    };
  }
  createBufferSource() {
    return new MockAudioBufferSourceNode();
  }
  resume = vi.fn(async function (this: any) {
    this.state = 'running';
  });
  close = vi.fn(async function (this: any) {
    this.state = 'closed';
  });
  setSinkId = vi.fn(async () => {});
}

// Global Browser Mock Wiring
if (typeof navigator === 'undefined') {
  (global as any).navigator = {} as any;
}
(global as any).navigator.mediaDevices = {
  getUserMedia: mockGetUserMedia,
} as any;
(global as any).AudioContext = MockAudioContext;

// Mock providers and configuration services
const mockListProviders = vi.fn(async () => [{ platform: 'gemini', api_key: 'test-api-key', enabled: true }]);

vi.mock('@/common', () => ({
  ipcBridge: {
    mode: {
      listProviders: {
        invoke: () => mockListProviders(),
      },
    },
  },
}));

let mockVoiceSettings = {
  enabled: true,
  preferredProvider: 'gemini',
  liveModel: 'gemini-2.0-flash',
  microphoneId: 'default',
  speakerId: 'default',
  noiseSuppression: true,
  echoCancellation: true,
  voiceActivityDetection: true,
  autoInterrupt: true,
  voiceName: 'Aoede',
  autoInterruptThreshold: 0.04,
};

vi.mock('@/renderer/services/clientBusinessSettings', () => ({
  getClientBusinessSetting: vi.fn(async (key: string) => {
    if (key === 'tools.voice') return mockVoiceSettings;
    return undefined;
  }),
  setClientBusinessSetting: vi.fn(() => Promise.resolve()),
}));

// Mock pcmRecorder
const mockPcmRecorderHandle = {
  stream: mockStream as unknown as MediaStream,
  stop: vi.fn(async () => ({ pcm: new Uint8Array(0), sampleRate: 24000 })),
};

const mockCreatePcmRecorder = vi.fn(async (options: any) => {
  return mockPcmRecorderHandle;
});

vi.mock('@renderer/services/speech/pcmRecorder', () => ({
  createPcmRecorder: (options: any) => mockCreatePcmRecorder(options),
}));

// Mock provider and SDK
class MockLiveSession {
  callbacks: Record<string, Function[]> = {};
  sendRealtimeInput = vi.fn();
  sendAudioChunk = vi.fn(async () => {});
  close = vi.fn(async () => {
    if (this.callbacks.close) {
      this.callbacks.close.forEach((cb) => cb());
    }
  });

  on(event: string, callback: any) {
    if (!this.callbacks[event]) this.callbacks[event] = [];
    this.callbacks[event].push(callback);
  }

  emit(event: string, ...args: any[]) {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach((cb) => cb(...args));
    }
  }
}

const mockConnect = vi.fn(async (options: any) => {
  const session = new MockLiveSession();
  // Simulate asynchronous connect state update
  setTimeout(() => {
    session.emit('stateChange', 'listening');
  }, 10);
  return session;
});

vi.mock('@/renderer/services/voice/providers/GeminiLiveProvider', () => {
  return {
    GeminiLiveProvider: class {
      sampleRate = 24000;
      mimeType = 'audio/pcm';
      connect = (options: any) => mockConnect(options);
    },
  };
});

describe('LiveVoiceService Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockGetUserMedia.mockClear();
    mockConnect.mockReset();
    mockConnect.mockImplementation(async (options: any) => {
      const session = new MockLiveSession();
      setTimeout(() => {
        session.emit('stateChange', 'listening');
      }, 10);
      return session;
    });
    mockPcmRecorderHandle.stop.mockClear();
    mockCreatePcmRecorder.mockClear();

    mockVoiceSettings = {
      enabled: true,
      preferredProvider: 'gemini',
      liveModel: 'gemini-2.0-flash',
      microphoneId: 'default',
      speakerId: 'default',
      noiseSuppression: true,
      echoCancellation: true,
      voiceActivityDetection: true,
      autoInterrupt: true,
      voiceName: 'Aoede',
      autoInterruptThreshold: 0.04,
    };
  });

  afterEach(() => {
    LiveVoiceManager.destroy();
    vi.restoreAllMocks();
  });

  it('verifies repeated connect and disconnect cycles clean up resources', async () => {
    expect(LiveVoiceManager.getState()).toBe('disconnected');

    // 1st Connect
    const conn1 = LiveVoiceManager.connect();
    await vi.runOnlyPendingTimersAsync();
    await conn1;

    expect(LiveVoiceManager.getState()).toBe('listening');
    expect(mockCreatePcmRecorder).toHaveBeenCalledTimes(1);

    // Disconnect
    await LiveVoiceManager.disconnect();
    expect(LiveVoiceManager.getState()).toBe('disconnected');

    // 2nd Connect
    const conn2 = LiveVoiceManager.connect();
    await vi.runOnlyPendingTimersAsync();
    await conn2;

    expect(LiveVoiceManager.getState()).toBe('listening');
    expect(mockCreatePcmRecorder).toHaveBeenCalledTimes(2);

    await LiveVoiceManager.disconnect();
  });

  it('maintains a single AudioContext across connections and disposes on destroy', async () => {
    const conn1 = LiveVoiceManager.connect();
    await vi.runOnlyPendingTimersAsync();
    await conn1;

    const firstContext = (LiveVoiceManager as any).audioContext;
    expect(firstContext).toBeDefined();
    expect(firstContext.state).toBe('suspended');

    await LiveVoiceManager.disconnect();

    // Context is kept alive after disconnect
    expect(firstContext.state).toBe('suspended');

    const conn2 = LiveVoiceManager.connect();
    await vi.runOnlyPendingTimersAsync();
    await conn2;

    const secondContext = (LiveVoiceManager as any).audioContext;
    expect(secondContext).toBe(firstContext); // same cached context

    // Call full destroy
    LiveVoiceManager.destroy();
    expect(firstContext.state).toBe('closed'); // fully closed on destroy
  });

  it('automatically reconnects and restores the conversation using resumption tokens', async () => {
    const conn = LiveVoiceManager.connect();
    await vi.runOnlyPendingTimersAsync();
    await conn;

    const session = (LiveVoiceManager as any).session;
    expect(session).toBeDefined();

    // Simulate resumption handle update
    session.emit('resumptionUpdate', { resumable: true, newHandle: 'resumption-token-123' });
    expect((LiveVoiceManager as any).lastResumptionHandle).toBe('resumption-token-123');

    // Simulate connection drop / close without manual disconnect
    mockConnect.mockClear();
    session.emit('close');

    expect(LiveVoiceManager.getState()).toBe('connecting');

    // Fast forward reconnect timer (2000ms delay for 1st attempt)
    await vi.advanceTimersByTimeAsync(2500);

    expect(mockConnect).toHaveBeenCalledTimes(1);
    const lastConnectCall = mockConnect.mock.calls[0][0];
    expect(lastConnectCall.sessionResumptionHandle).toBe('resumption-token-123');
  });

  it('gracefully falls back to a fresh session if session resumption fails', async () => {
    const conn = LiveVoiceManager.connect();
    await vi.runOnlyPendingTimersAsync();
    await conn;

    const session = (LiveVoiceManager as any).session;
    session.emit('resumptionUpdate', { resumable: true, newHandle: 'resumption-token-123' });

    // Make the next connect attempt fail when using resumption token
    mockConnect.mockRejectedValueOnce(new Error('Resumption handle expired'));
    mockConnect.mockClear();

    // Simulate socket error causing disconnect
    session.emit('close');
    await vi.advanceTimersByTimeAsync(2500);

    // Since the first attempt failed, it clears the token and retries automatically
    expect((LiveVoiceManager as any).lastResumptionHandle).toBeNull();
    // The second connect call (fallback fresh connect) runs synchronously in the catch block
    expect(mockConnect).toHaveBeenCalledTimes(2);
    expect(mockConnect.mock.calls[0][0].sessionResumptionHandle).toBe('resumption-token-123');
    expect(mockConnect.mock.calls[1][0].sessionResumptionHandle).toBeUndefined();
  });

  it('handles hot microphone switching without restarting the WebSocket connection', async () => {
    const conn = LiveVoiceManager.connect();
    await vi.runOnlyPendingTimersAsync();
    await conn;

    expect(mockCreatePcmRecorder).toHaveBeenCalledTimes(1);
    expect(mockCreatePcmRecorder.mock.calls[0][0].deviceId).toBe('default');

    // Simulate user switching mic device in settings
    mockVoiceSettings.microphoneId = 'custom-microphone-id';

    // Trigger config change event
    mockCreatePcmRecorder.mockClear();
    window.dispatchEvent(new Event('aura:voice-config-changed'));
    await vi.runOnlyPendingTimersAsync();

    expect(mockCreatePcmRecorder).toHaveBeenCalledTimes(1);
    expect(mockCreatePcmRecorder.mock.calls[0][0].deviceId).toBe('custom-microphone-id');
  });

  it('handles speaker hot-switching on the fly', async () => {
    const conn = LiveVoiceManager.connect();
    await vi.runOnlyPendingTimersAsync();
    await conn;

    const player = (LiveVoiceManager as any).player;
    const sinkSpy = vi.spyOn(player, 'setSpeaker');

    // Switch speaker settings
    mockVoiceSettings.speakerId = 'custom-speaker-id';
    window.dispatchEvent(new Event('aura:voice-config-changed'));
    await vi.runOnlyPendingTimersAsync();

    expect(sinkSpy).toHaveBeenCalledWith('custom-speaker-id');
  });

  it('interrupts speaking immediately if mic input rises above the VAD threshold', async () => {
    const conn = LiveVoiceManager.connect();
    await vi.runOnlyPendingTimersAsync();
    await conn;

    // Set state to speaking
    (LiveVoiceManager as any).setState('speaking');
    expect(LiveVoiceManager.getState()).toBe('speaking');

    const player = (LiveVoiceManager as any).player;
    const playerStopSpy = vi.spyOn(player, 'stop');

    // Simulate loud audio input on microphone
    const analyser = (LiveVoiceManager as any).micAnalyser;
    vi.spyOn(analyser, 'getByteTimeDomainData').mockImplementation((array: Uint8Array) => {
      // Create a simulated loud sine wave (highly elevated amplitudes)
      for (let i = 0; i < array.length; i++) {
        array[i] = i % 2 === 0 ? 200 : 50;
      }
    });

    // Advance to trigger the volume evaluation loop
    await vi.advanceTimersByTimeAsync(100);

    expect(playerStopSpy).toHaveBeenCalledTimes(1);
    expect(LiveVoiceManager.getState()).toBe('listening');
  });

  it('updates autoInterruptThreshold config changes on the fly', async () => {
    const conn = LiveVoiceManager.connect();
    await vi.runOnlyPendingTimersAsync();
    await conn;

    (LiveVoiceManager as any).setState('speaking');

    // Verify default threshold
    expect((LiveVoiceManager as any).activeConfig.autoInterruptThreshold).toBe(0.04);

    // Update threshold settings
    mockVoiceSettings.autoInterruptThreshold = 0.25;
    window.dispatchEvent(new Event('aura:voice-config-changed'));
    await vi.runOnlyPendingTimersAsync();

    expect((LiveVoiceManager as any).activeConfig.autoInterruptThreshold).toBe(0.25);
  });
});
