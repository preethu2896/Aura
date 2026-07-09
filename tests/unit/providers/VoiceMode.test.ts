/**
 * @license
 * Copyright 2026 AionUi (aura.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { vi } from 'vitest';

// Define mocked functions using vi.hoisted to prevent hoisting reference errors
const { mockConnect } = vi.hoisted(() => {
  return {
    mockConnect: vi.fn(),
  };
});

// Mock @google/genai BEFORE any other imports load it transitively
vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: vi.fn().mockImplementation(function () {
      return {
        live: {
          connect: mockConnect,
        },
      };
    }),
    // L4: include Modality so [Modality.AUDIO] does not throw in tests
    Modality: { AUDIO: 'AUDIO', TEXT: 'TEXT' },
  };
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GoogleGenAI } from '@google/genai';
import { LiveVoiceManager } from '@/renderer/services/voice/LiveVoiceService';
import { getClientBusinessSetting } from '@/renderer/services/clientBusinessSettings';
import { ipcBridge } from '@/common';

// Mock getClientBusinessSetting
vi.mock('@/renderer/services/clientBusinessSettings', () => ({
  getClientBusinessSetting: vi.fn(),
  setClientBusinessSetting: vi.fn().mockResolvedValue(undefined),
}));

// Mock ipcBridge
vi.mock('@/common', () => ({
  ipcBridge: {
    mode: {
      listProviders: {
        invoke: vi.fn(),
      },
    },
  },
}));

describe('LiveVoiceManager State Machine & Permission & Credentials', () => {
  let mockGetUserMedia: any;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetAllMocks();

    // Re-apply Mock implementation after resetAllMocks
    vi.mocked(GoogleGenAI).mockImplementation(function () {
      return {
        live: {
          connect: mockConnect,
        },
      } as any;
    });

    // Mock mediaDevices
    mockGetUserMedia = vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }],
    });

    global.navigator.mediaDevices = {
      getUserMedia: mockGetUserMedia,
      enumerateDevices: vi.fn().mockResolvedValue([]),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as any;
  });

  afterEach(async () => {
    await LiveVoiceManager.disconnect();
    vi.useRealTimers();
  });

  it('starts in disconnected state', () => {
    expect(LiveVoiceManager.getState()).toBe('disconnected');
    expect(LiveVoiceManager.getErrorType()).toBeNull();
  });

  it('fails connect when microphone is denied', async () => {
    mockGetUserMedia.mockRejectedValue(new Error('Permission denied'));
    vi.mocked(getClientBusinessSetting).mockResolvedValue({ enabled: true } as any);

    await LiveVoiceManager.connect();

    expect(LiveVoiceManager.getState()).toBe('error');
    expect(LiveVoiceManager.getErrorType()).toBe('permission-denied');
  });

  it('fails connect when no Gemini API key is configured', async () => {
    vi.mocked(getClientBusinessSetting).mockResolvedValue({ enabled: true } as any);
    vi.mocked(ipcBridge.mode.listProviders.invoke).mockResolvedValue([
      { platform: 'gemini', api_key: '', enabled: true },
    ] as any);

    await LiveVoiceManager.connect();

    expect(LiveVoiceManager.getState()).toBe('error');
    expect(LiveVoiceManager.getErrorType()).toBe('no-api-key');
  });

  it('transitions to listening after successful connection', async () => {
    vi.mocked(getClientBusinessSetting).mockResolvedValue({ enabled: true, liveModel: 'gemini-2.0-flash' } as any);
    vi.mocked(ipcBridge.mode.listProviders.invoke).mockResolvedValue([
      { platform: 'gemini', api_key: 'test-api-key', enabled: true },
    ] as any);

    let sessionCallbacks: any;
    mockConnect.mockImplementation((options: any) => {
      sessionCallbacks = options.callbacks;
      return Promise.resolve({
        close: vi.fn(),
        on: vi.fn(),
      });
    });

    const connectPromise = LiveVoiceManager.connect();
    await connectPromise;

    // Trigger onopen manually
    if (sessionCallbacks?.onopen) {
      sessionCallbacks.onopen();
    }

    expect(LiveVoiceManager.getState()).toBe('listening');
    expect(LiveVoiceManager.getErrorType()).toBeNull();
  });

  it('automatically attempts reconnection on connection failure', async () => {
    vi.mocked(getClientBusinessSetting).mockResolvedValue({ enabled: true } as any);
    vi.mocked(ipcBridge.mode.listProviders.invoke).mockResolvedValue([
      { platform: 'gemini', api_key: 'test-api-key', enabled: true },
    ] as any);

    mockConnect.mockRejectedValue(new Error('Connection failed'));

    await LiveVoiceManager.connect();

    // Since connection fails, it registers error but immediately triggers reconnect, putting state back to 'connecting'
    expect(LiveVoiceManager.getState()).toBe('connecting');
    expect(LiveVoiceManager.getErrorType()).toBe('connection-failed');

    let sessionCallbacks: any;
    mockConnect.mockImplementation((options: any) => {
      sessionCallbacks = options.callbacks;
      return Promise.resolve({
        close: vi.fn(),
        on: vi.fn(),
      });
    });

    // Reconnect timer fires and flushes all async tasks inside reconnect hook
    await vi.advanceTimersByTimeAsync(2100);

    // Simulate connection establishing and opening
    if (sessionCallbacks?.onopen) {
      sessionCallbacks.onopen();
    }

    expect(LiveVoiceManager.getState()).toBe('listening');
  });
});

// ---------------------------------------------------------------------------
// Regression tests — one per fixed Critical/High issue
// ---------------------------------------------------------------------------

describe('Voice Module — Stability Regression Tests', () => {
  let mockGetUserMedia: ReturnType<typeof vi.fn>;

  const setupSuccessfulConnect = (cb: { sessionCallbacks?: any } = {}) => {
    vi.mocked(getClientBusinessSetting).mockResolvedValue({ enabled: true, liveModel: 'gemini-2.0-flash' } as any);
    vi.mocked(ipcBridge.mode.listProviders.invoke).mockResolvedValue([
      { platform: 'gemini', api_key: 'test-key', enabled: true },
    ] as any);

    mockConnect.mockImplementation((options: any) => {
      cb.sessionCallbacks = options.callbacks;
      return Promise.resolve({ close: vi.fn(), on: vi.fn() });
    });
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetAllMocks();

    vi.mocked(GoogleGenAI).mockImplementation(function () {
      return { live: { connect: mockConnect } } as any;
    });

    mockGetUserMedia = vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }],
    });

    global.navigator.mediaDevices = {
      getUserMedia: mockGetUserMedia,
      enumerateDevices: vi.fn().mockResolvedValue([]),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as any;

    // Full singleton reset before each regression test
    LiveVoiceManager.destroy();
  });

  afterEach(() => {
    LiveVoiceManager.destroy();
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // C1 — Dual reconnect loop
  // Pre-fix: handleSessionError schedules a timer at t+2s (attempt 1, 2000ms).
  // Then handleSessionClose fires, clears that timer and schedules a NEW one at
  // t+4s (attempt 2, 4000ms).  At t+2100ms, no reconnect has occurred yet.
  // Post-fix: handleSessionClose exits early when reconnectTimer !== null.
  // Reconnect fires at t+2000ms (attempt 1) as expected.
  // -------------------------------------------------------------------------
  it('C1 — onerror + onclose fire once; reconnect triggers at attempt-1 delay (2s), not attempt-2 delay (4s)', async () => {
    const cb: { sessionCallbacks?: any } = {};
    setupSuccessfulConnect(cb);

    await LiveVoiceManager.connect();
    cb.sessionCallbacks!.onopen();
    expect(LiveVoiceManager.getState()).toBe('listening');

    const callCountAfterConnect = mockConnect.mock.calls.length; // 1

    // Prepare reconnect to succeed
    mockConnect.mockImplementation((options: any) => {
      cb.sessionCallbacks = options.callbacks;
      return Promise.resolve({ close: vi.fn(), on: vi.fn() });
    });

    // Typical WebSocket teardown: error fires first, then close
    cb.sessionCallbacks!.onerror(new Error('Network drop'));
    cb.sessionCallbacks!.onclose({});

    // State must be 'connecting' (first attempt scheduled, not double-incremented)
    expect(LiveVoiceManager.getState()).toBe('connecting');

    // Advance past the first-attempt window (2 000 ms).
    // If C1 bug is present the timer was rescheduled to 4 000 ms and this would
    // NOT fire a second connect() call yet.
    await vi.advanceTimersByTimeAsync(2100);

    // The reconnect connect() must have been called exactly once more
    expect(mockConnect.mock.calls.length).toBe(callCountAfterConnect + 1);
  });

  // -------------------------------------------------------------------------
  // C2 — Concurrent connect() calls orphan sessions
  // Pre-fix: two callers both enter connect(), both await provider.connect(), and
  // the second assignment to this.session silently orphans the first session.
  // Post-fix: isConnecting flag blocks the second caller immediately.
  // -------------------------------------------------------------------------
  it('C2 — concurrent connect() calls create exactly one SDK session', async () => {
    vi.mocked(getClientBusinessSetting).mockResolvedValue({ enabled: true } as any);
    vi.mocked(ipcBridge.mode.listProviders.invoke).mockResolvedValue([
      { platform: 'gemini', api_key: 'test-key', enabled: true },
    ] as any);

    // connect() has several internal awaits before reaching provider.connect().
    // A deferred promise lets us resolve it after all upstream awaits are done.
    const deferred = { resolve: (_v: any) => {} };
    mockConnect.mockImplementation(
      () =>
        new Promise<any>((resolve) => {
          deferred.resolve = resolve;
        }),
    );

    // Start the first connect and drain microtasks so the coroutine progresses
    // through config / mic-permission / providers awaits and suspends on mockConnect.
    // connect() has 3 await points before provider.connect(); drain each one.
    const p1 = LiveVoiceManager.connect();
    await Promise.resolve(); // drain: getClientBusinessSetting await
    await Promise.resolve(); // drain: getUserMedia await
    await Promise.resolve(); // drain: listProviders await
    await Promise.resolve(); // drain: one extra for safety

    // Fire a second connect while the first is suspended on provider.connect()
    const p2 = LiveVoiceManager.connect(); // must be no-op: isConnecting === true

    // Resolve the hanging call and settle both promises
    deferred.resolve({ close: vi.fn(), on: vi.fn() });
    await Promise.all([p1, p2]);

    // SDK connect must have been invoked only once
    expect(mockConnect).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // C3 — Post-close session events mutate state
  // Pre-fix: GeminiLiveSession.close() nulls conn but leaves callbacks populated.
  // The SDK fires onclose during teardown -> emit('close') -> handleSessionClose()
  // -> attemptReconnect() even though the user disconnected intentionally.
  // Post-fix: close() resets this.callbacks to empty arrays; emit() is a no-op.
  // (This test also exercises M3 — the state is set to 'disconnected' before
  // s.close() so handleSessionClose exits early as a second defensive layer.)
  // -------------------------------------------------------------------------
  it('C3 — SDK events fired after session.close() do not alter manager state', async () => {
    const cb: { sessionCallbacks?: any } = {};
    setupSuccessfulConnect(cb);

    await LiveVoiceManager.connect();
    cb.sessionCallbacks!.onopen();
    expect(LiveVoiceManager.getState()).toBe('listening');

    await LiveVoiceManager.disconnect();
    expect(LiveVoiceManager.getState()).toBe('disconnected');
    expect(LiveVoiceManager.getErrorType()).toBeNull();

    // Simulate the SDK firing close and error after our intentional disconnect
    // (common during WebSocket half-close / FIN exchange)
    cb.sessionCallbacks!.onclose({});
    cb.sessionCallbacks!.onerror(new Error('Post-close tear-down error'));

    // State must remain 'disconnected'; no ghost reconnect should be scheduled
    expect(LiveVoiceManager.getState()).toBe('disconnected');
    expect(LiveVoiceManager.getErrorType()).toBeNull();

    // Advance timers to confirm no delayed reconnect fires
    await vi.advanceTimersByTimeAsync(10_000);
    expect(LiveVoiceManager.getState()).toBe('disconnected');
    // connect() was called once for the initial session; no reconnect call
    expect(mockConnect).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // M3 — Intentional disconnect() triggers auto-reconnect
  // Pre-fix: disconnect() sets state AFTER s.close(); if SDK fires onclose
  // synchronously, handleSessionClose() sees state !== 'disconnected' and
  // schedules a reconnect.
  // Post-fix: state is set to 'disconnected' before s.close() is called.
  // -------------------------------------------------------------------------
  it('M3 — disconnect() never schedules an automatic reconnect', async () => {
    const cb: { sessionCallbacks?: any } = {};
    setupSuccessfulConnect(cb);

    await LiveVoiceManager.connect();
    cb.sessionCallbacks!.onopen();
    expect(LiveVoiceManager.getState()).toBe('listening');

    await LiveVoiceManager.disconnect();
    expect(LiveVoiceManager.getState()).toBe('disconnected');

    // Advance well past the longest possible reconnect window (3 x 2s = 6s)
    await vi.advanceTimersByTimeAsync(10_000);

    expect(LiveVoiceManager.getState()).toBe('disconnected');
    // Exactly one connect() call — no reconnect invocations
    expect(mockConnect).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // H3 — Mic permission re-requested on every reconnect attempt
  // Pre-fix: each connect() call always runs getUserMedia regardless of whether
  // permission was already granted, triggering repeated OS prompts on reconnects.
  // Post-fix: micPermissionGranted is cached after the first successful check.
  // -------------------------------------------------------------------------
  it('H3 — getUserMedia is called once even when a reconnect cycle occurs', async () => {
    vi.mocked(getClientBusinessSetting).mockResolvedValue({ enabled: true } as any);
    vi.mocked(ipcBridge.mode.listProviders.invoke).mockResolvedValue([
      { platform: 'gemini', api_key: 'test-key', enabled: true },
    ] as any);

    // First connect attempt fails at the SDK level (after permission is granted)
    let sessionCallbacks: any;
    mockConnect
      .mockImplementationOnce(() => Promise.reject(new Error('Network error')))
      .mockImplementation((options: any) => {
        sessionCallbacks = options.callbacks;
        return Promise.resolve({ close: vi.fn(), on: vi.fn() });
      });

    await LiveVoiceManager.connect();
    // First attempt failed -> reconnect timer scheduled
    expect(LiveVoiceManager.getState()).toBe('connecting');

    // Let the reconnect timer fire (attempt 1 -> delay = 2 000 ms)
    await vi.advanceTimersByTimeAsync(2100);

    // getUserMedia must have been called exactly once despite two connect() calls
    expect(mockGetUserMedia).toHaveBeenCalledTimes(1);
    void sessionCallbacks; // suppress unused warning
  });
});
