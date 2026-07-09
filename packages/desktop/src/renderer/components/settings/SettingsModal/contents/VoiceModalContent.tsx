/**
 * @license
 * Copyright 2026 AionUi (aura.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Divider, Form, Switch } from '@arco-design/web-react';
import AURASelect from '@/renderer/components/base/AURASelect';
import { getClientBusinessSetting, setClientBusinessSetting } from '@/renderer/services/clientBusinessSettings';
import type { VoiceConfig } from '@/common/types/provider/voice';
import { DEFAULT_VOICE_CONFIG } from '@/common/types/provider/voice';

const VoiceModalContent: React.FC = () => {
  const { t } = useTranslation();
  const [config, setConfig] = useState<VoiceConfig>(DEFAULT_VOICE_CONFIG);
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [speakers, setSpeakers] = useState<MediaDeviceInfo[]>([]);

  // Load stored settings on mount
  useEffect(() => {
    let active = true;
    const loadConfig = async () => {
      try {
        const stored = await getClientBusinessSetting('tools.voice');
        if (active && stored) {
          setConfig({ ...DEFAULT_VOICE_CONFIG, ...stored });
        }
      } catch (err) {
        console.error('Failed to load voice config:', err);
      }
    };
    void loadConfig();
    return () => {
      active = false;
    };
  }, []);

  // Enumerate audio devices
  const updateDevices = useCallback(() => {
    navigator.mediaDevices
      .enumerateDevices()
      .then((deviceList) => {
        setMicrophones(deviceList.filter((d) => d.kind === 'audioinput'));
        setSpeakers(deviceList.filter((d) => d.kind === 'audiooutput'));
      })
      .catch((err) => {
        console.error('Failed to enumerate devices:', err);
      });
  }, []);

  useEffect(() => {
    updateDevices();
    // Re-list devices if devicechange event occurs
    navigator.mediaDevices.addEventListener('devicechange', updateDevices);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', updateDevices);
    };
  }, [updateDevices]);

  // Persist updated settings to backend
  const updateConfigField = useCallback((field: keyof VoiceConfig, value: any) => {
    setConfig((current) => {
      const next = { ...current, [field]: value };
      void setClientBusinessSetting('tools.voice', next)
        .then(() => {
          window.dispatchEvent(new CustomEvent('aura:voice-config-changed'));
        })
        .catch((err) => {
          console.error('Failed to save voice config:', err);
        });
      return next;
    });
  }, []);

  return (
    <div className='px-[12px] md:px-[32px] py-[24px] bg-2 rd-12px md:rd-16px border border-border-2'>
      <div className='flex items-center justify-between gap-12px mb-8px'>
        <div className='flex flex-col gap-4px'>
          <span className='text-14px font-bold text-t-primary'>
            {t('settings.voiceTitle', { defaultValue: 'Voice Mode' })}
          </span>
          <span className='text-13px text-t-secondary'>
            {t('settings.voiceDescription', { defaultValue: 'Configure real-time bidirectional Voice Mode settings.' })}
          </span>
        </div>
        <Switch checked={config.enabled} onChange={(checked) => updateConfigField('enabled', checked)} />
      </div>

      {config.enabled && (
        <>
          <Divider className='mt-16px mb-20px' />

          <Form layout='horizontal' labelAlign='left' className='space-y-12px'>
            <Form.Item label={t('settings.voicePreferredProvider', { defaultValue: 'Preferred Provider' })}>
              <AURASelect
                value={config.preferredProvider}
                onChange={(val) => updateConfigField('preferredProvider', val)}
              >
                <AURASelect.Option value='gemini'>Google Gemini (Live)</AURASelect.Option>
              </AURASelect>
            </Form.Item>

            <Form.Item label={t('settings.voiceLiveModel', { defaultValue: 'Live Model' })}>
              <AURASelect
                value={config.liveModel}
                onChange={(val) => updateConfigField('liveModel', val)}
                allowCreate
                showSearch
              >
                <AURASelect.Option value='gemini-2.0-flash'>gemini-2.0-flash</AURASelect.Option>
                <AURASelect.Option value='gemini-2.5-flash'>gemini-2.5-flash</AURASelect.Option>
              </AURASelect>
            </Form.Item>

            <Form.Item label={t('settings.voiceMicrophone', { defaultValue: 'Microphone' })}>
              <AURASelect value={config.microphoneId} onChange={(val) => updateConfigField('microphoneId', val)}>
                <AURASelect.Option value='default'>Default Microphone</AURASelect.Option>
                {microphones.map((mic) => (
                  <AURASelect.Option key={mic.deviceId} value={mic.deviceId}>
                    {mic.label || `Microphone (${mic.deviceId.slice(0, 5)}...)`}
                  </AURASelect.Option>
                ))}
              </AURASelect>
            </Form.Item>

            <Form.Item label={t('settings.voiceSpeaker', { defaultValue: 'Speaker' })}>
              <AURASelect value={config.speakerId} onChange={(val) => updateConfigField('speakerId', val)}>
                <AURASelect.Option value='default'>Default Speaker</AURASelect.Option>
                {speakers.map((spk) => (
                  <AURASelect.Option key={spk.deviceId} value={spk.deviceId}>
                    {spk.label || `Speaker (${spk.deviceId.slice(0, 5)}...)`}
                  </AURASelect.Option>
                ))}
              </AURASelect>
            </Form.Item>

            <Form.Item
              label={t('settings.voiceNoiseSuppression', { defaultValue: 'Noise Suppression' })}
              triggerPropName='checked'
            >
              <Switch
                checked={config.noiseSuppression}
                onChange={(checked) => updateConfigField('noiseSuppression', checked)}
              />
            </Form.Item>

            <Form.Item
              label={t('settings.voiceEchoCancellation', { defaultValue: 'Echo Cancellation' })}
              triggerPropName='checked'
            >
              <Switch
                checked={config.echoCancellation}
                onChange={(checked) => updateConfigField('echoCancellation', checked)}
              />
            </Form.Item>

            <Form.Item
              label={t('settings.voiceActivityDetection', { defaultValue: 'Voice Activity Detection' })}
              triggerPropName='checked'
            >
              <Switch
                checked={config.voiceActivityDetection}
                onChange={(checked) => updateConfigField('voiceActivityDetection', checked)}
              />
            </Form.Item>

            <Form.Item
              label={t('settings.voiceAutoInterrupt', { defaultValue: 'Auto Interrupt' })}
              triggerPropName='checked'
            >
              <Switch
                checked={config.autoInterrupt}
                onChange={(checked) => updateConfigField('autoInterrupt', checked)}
              />
            </Form.Item>
          </Form>
        </>
      )}
    </div>
  );
};

export default VoiceModalContent;
