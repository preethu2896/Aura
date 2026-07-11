/**
 * @license
 * Copyright 2026 AionUi (aura.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { LiveVoiceManager } from './LiveVoiceService';
import type { LiveVoiceState, LiveVoiceErrorType } from './types';

export const useLiveVoice = (voiceOverrides?: { tts_voice?: string; stt_language?: string }) => {
  const [state, setState] = useState<LiveVoiceState>(LiveVoiceManager.getState());
  const [errorType, setErrorType] = useState<LiveVoiceErrorType | null>(LiveVoiceManager.getErrorType());
  const [volume, setVolume] = useState<number>(LiveVoiceManager.getCurrentVolume());

  useEffect(() => {
    LiveVoiceManager.setOverrides(voiceOverrides || null);
  }, [voiceOverrides]);

  useEffect(() => {
    const unsubState = LiveVoiceManager.subscribeState((nextState) => {
      setState(nextState);
      if (nextState !== 'error') {
        setErrorType(null);
      }
    });

    const unsubError = LiveVoiceManager.subscribeError((err) => {
      setErrorType(err.type);
    });

    const unsubVolume = LiveVoiceManager.subscribeVolume((vol) => {
      setVolume(vol);
    });

    // H2: re-sync state after the subscriptions are wired up to close the window
    // between the initial useState() snapshot and this effect running.  Any state
    // transition that occurs in that gap will be captured here.
    setState(LiveVoiceManager.getState());
    setErrorType(LiveVoiceManager.getErrorType());
    setVolume(LiveVoiceManager.getCurrentVolume());

    return () => {
      unsubState();
      unsubError();
      unsubVolume();
    };
  }, []);

  const toggleVoiceMode = () => {
    LiveVoiceManager.toggle().catch((err) => {
      console.error('Failed to toggle voice mode:', err);
    });
  };

  return {
    state,
    errorType,
    toggleVoiceMode,
    volume,
    isVoiceModeActive: state !== 'disconnected' && state !== 'error',
  };
};
