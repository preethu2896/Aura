/**
 * @license
 * Copyright 2026 AionUi (aura.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { LiveVoiceManager } from './LiveVoiceService';
import type { LiveVoiceState, LiveVoiceErrorType } from './types';

export const useLiveVoice = () => {
  const [state, setState] = useState<LiveVoiceState>(LiveVoiceManager.getState());
  const [errorType, setErrorType] = useState<LiveVoiceErrorType | null>(LiveVoiceManager.getErrorType());

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

    return () => {
      unsubState();
      unsubError();
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
    isVoiceModeActive: state !== 'disconnected' && state !== 'error',
  };
};
