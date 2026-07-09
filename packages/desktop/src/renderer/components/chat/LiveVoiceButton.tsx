/**
 * @license
 * Copyright 2026 AionUi (aura.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Button, Tooltip, Message } from '@arco-design/web-react';
import { useTranslation } from 'react-i18next';
import { useLiveVoice } from '@/renderer/services/voice/useLiveVoice';
import { getClientBusinessSetting } from '@/renderer/services/clientBusinessSettings';

type LiveVoiceButtonProps = {
  disabled?: boolean;
};

const LiveMicIcon = () => (
  <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' aria-hidden='true'>
    <path d='M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z' />
    <path d='M19 10v1a7 7 0 0 1-14 0v-1M12 18v4M8 22h8' />
  </svg>
);

const LiveStopIcon = () => (
  <svg width='18' height='18' viewBox='0 0 24 24' fill='currentColor' aria-hidden='true'>
    <rect x='6' y='6' width='12' height='12' rx='2.5' />
  </svg>
);

const LiveVoiceButton: React.FC<LiveVoiceButtonProps> = ({ disabled }) => {
  const { t } = useTranslation();
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);
  const { state, errorType, toggleVoiceMode } = useLiveVoice();

  useEffect(() => {
    let active = true;
    const syncSettings = async () => {
      try {
        const stored = await getClientBusinessSetting('tools.voice');
        if (active) {
          setIsVoiceEnabled(Boolean(stored?.enabled));
        }
      } catch (err) {
        console.error('Failed to load voice configuration:', err);
      } finally {
        if (active) {
          setIsConfigLoaded(true);
        }
      }
    };
    void syncSettings();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handleConfigChanged = () => {
      getClientBusinessSetting('tools.voice')
        .then((stored) => {
          setIsVoiceEnabled(Boolean(stored?.enabled));
        })
        .catch(console.error);
    };
    window.addEventListener('aura:voice-config-changed', handleConfigChanged);
    return () => {
      window.removeEventListener('aura:voice-config-changed', handleConfigChanged);
    };
  }, []);

  useEffect(() => {
    if (!errorType) return;
    if (errorType === 'no-api-key') {
      Message.error(
        t('conversation.voice.noApiKey', {
          defaultValue: 'No API Key found. Please configure Gemini API Key in Model settings.',
        })
      );
    } else if (errorType === 'permission-denied') {
      Message.error(t('conversation.chat.speech.permissionDenied', { defaultValue: 'Microphone permission denied' }));
    } else {
      Message.error(
        t('conversation.chat.speech.genericError', { defaultValue: 'An unexpected connection error occurred' })
      );
    }
  }, [errorType, t]);

  if (!isConfigLoaded || !isVoiceEnabled) {
    return null;
  }

  const isConnecting = state === 'connecting';
  const isListening = state === 'listening';
  const isThinking = state === 'thinking';
  const isSpeaking = state === 'speaking';
  const isExecuting = state === 'executing';
  const isError = state === 'error';
  const isActive = isListening || isThinking || isSpeaking || isExecuting;

  let buttonClass = 'live-voice-button ';
  if (isConnecting) buttonClass += 'live-voice-button--connecting';
  else if (isActive) buttonClass += 'live-voice-button--active';
  else if (isError) buttonClass += 'live-voice-button--error';

  const stateLabels: Record<string, string> = {
    connecting: t('conversation.voice.connecting', { defaultValue: 'Connecting...' }),
    listening: t('conversation.voice.listening', { defaultValue: 'Listening...' }),
    thinking: t('conversation.voice.thinking', { defaultValue: 'Thinking...' }),
    speaking: t('conversation.voice.speaking', { defaultValue: 'AURA is speaking...' }),
    executing: t('conversation.voice.thinking', { defaultValue: 'Thinking...' }),
    error: t('conversation.voice.error', { defaultValue: 'Voice Mode Error' }),
  };

  const statusText = stateLabels[state] || '';
  const tooltipText = isActive
    ? t('conversation.voice.stop', { defaultValue: 'Stop Voice Mode' })
    : t('conversation.voice.start', { defaultValue: 'Start Voice Mode' });

  const waveformBars = Array.from({ length: 8 });

  return (
    <div className='live-voice-control'>
      {isActive && (
        <div className='live-voice-feedback' role='status' aria-live='polite'>
          <div className='live-voice-feedback__waveform' aria-hidden='true'>
            {waveformBars.map((_, index) => (
              <span
                key={`live-voice-wave-${index}`}
                className='live-voice-feedback__bar'
                style={{
                  height: isSpeaking ? '16px' : '6px',
                  animationDelay: `${index * 150}ms`,
                  animationPlayState: isSpeaking || isListening ? 'running' : 'paused',
                }}
              />
            ))}
          </div>
          <span className='live-voice-feedback__label'>{statusText}</span>
        </div>
      )}
      <Tooltip content={tooltipText} mini>
        <Button
          type='text'
          size='small'
          shape='circle'
          className={buttonClass}
          disabled={disabled}
          onClick={toggleVoiceMode}
          aria-label={tooltipText}
          icon={isActive ? <LiveStopIcon /> : <LiveMicIcon />}
        />
      </Tooltip>
    </div>
  );
};

export default LiveVoiceButton;
