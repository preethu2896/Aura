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
