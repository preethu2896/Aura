/**
 * @license
 * Copyright 2025 AionUi (aura.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ColorPicker, Form, Input, Message, Select, Slider } from '@arco-design/web-react';
import { ipcBridge } from '@/common';
import type { TProject } from '@/common/types/project/projectTypes';
import type { TProjectProviderConfig } from '@/common/types/project/projectTypes';

type ProjectSettingsProps = {
  project: TProject;
  onUpdate: () => Promise<void>;
};

const EMOJI_OPTIONS = ['📁', '🚀', '💡', '🎯', '🔬', '📝', '🎨', '🛠️', '🌱', '📊'];
const COLOR_PRESETS = ['#165DFF', '#00B42A', '#FF7D00', '#F53F3F', '#722ED1', '#0FC6C2', '#F7BA1E', '#86909C'];

const ProjectSettings: React.FC<ProjectSettingsProps> = ({ project, onUpdate }) => {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);

  // Form state — mirrors TProject fields relevant to settings
  const [instructions, setInstructions] = useState(project.instructions ?? '');
  const [systemPrompt, setSystemPrompt] = useState(project.system_prompt ?? '');
  const [icon, setIcon] = useState(project.icon ?? '📁');
  const [color, setColor] = useState(project.color ?? '#165DFF');

  // Provider config
  const [providerConfig, setProviderConfig] = useState<TProjectProviderConfig>(project.provider_config ?? {});

  // Sync when project prop changes (e.g. after refresh)
  useEffect(() => {
    setInstructions(project.instructions ?? '');
    setSystemPrompt(project.system_prompt ?? '');
    setIcon(project.icon ?? '📁');
    setColor(project.color ?? '#165DFF');
    setProviderConfig(project.provider_config ?? {});
  }, [project]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await ipcBridge.projects.update.invoke({
        id: project.id,
        updates: {
          instructions: instructions.trim() || undefined,
          system_prompt: systemPrompt.trim() || undefined,
          icon,
          color,
          provider_config: Object.keys(providerConfig).length > 0 ? providerConfig : undefined,
        },
      });
      await onUpdate();
      Message.success(t('project.settings.saved'));
    } catch {
      Message.error(t('project.settings.saveError'));
    } finally {
      setSaving(false);
    }
  }, [project.id, instructions, systemPrompt, icon, color, providerConfig, onUpdate, t]);

  return (
    <div className='flex flex-col gap-20px max-w-680px'>
      {/* Appearance */}
      <section>
        <h2 className='text-14px font-semibold text-[var(--color-text-1)] mb-12px m-0'>
          {t('project.settings.appearance')}
        </h2>
        <div className='flex items-center gap-16px'>
          {/* Icon picker */}
          <div className='flex flex-col gap-6px'>
            <span className='text-12px text-[var(--color-text-3)]'>{t('project.settings.icon')}</span>
            <div className='flex flex-wrap gap-6px'>
              {EMOJI_OPTIONS.map((emoji) => (
                <span
                  key={emoji}
                  className={`text-20px cursor-pointer p-4px rounded-6px transition-colors duration-150 ${
                    icon === emoji ? 'bg-[var(--color-fill-3)]' : 'hover:bg-[var(--color-fill-2)]'
                  }`}
                  onClick={() => setIcon(emoji)}
                >
                  {emoji}
                </span>
              ))}
            </div>
          </div>

          {/* Color picker */}
          <div className='flex flex-col gap-6px'>
            <span className='text-12px text-[var(--color-text-3)]'>{t('project.settings.color')}</span>
            <div className='flex flex-wrap gap-6px'>
              {COLOR_PRESETS.map((c) => (
                <span
                  key={c}
                  className={`w-24px h-24px rounded-full cursor-pointer ring-offset-2 ${
                    color === c ? 'ring-2 ring-[var(--color-primary-6)]' : ''
                  }`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Instructions */}
      <section>
        <h2 className='text-14px font-semibold text-[var(--color-text-1)] mb-6px m-0'>
          {t('project.settings.instructions')}
        </h2>
        <p className='text-12px text-[var(--color-text-3)] mb-8px'>{t('project.settings.instructionsDescription')}</p>
        <Input.TextArea
          value={instructions}
          onChange={setInstructions}
          placeholder={t('project.settings.instructionsPlaceholder')}
          autoSize={{ minRows: 3, maxRows: 12 }}
        />
      </section>

      {/* System Prompt */}
      <section>
        <h2 className='text-14px font-semibold text-[var(--color-text-1)] mb-6px m-0'>
          {t('project.settings.systemPrompt')}
        </h2>
        <Input.TextArea
          value={systemPrompt}
          onChange={setSystemPrompt}
          placeholder={t('project.settings.systemPromptPlaceholder')}
          autoSize={{ minRows: 2, maxRows: 8 }}
        />
      </section>

      {/* Voice Defaults */}
      <section>
        <h2 className='text-14px font-semibold text-[var(--color-text-1)] mb-6px m-0'>{t('project.settings.voice')}</h2>
        <div className='flex gap-12px'>
          <div className='flex flex-col gap-4px flex-1'>
            <span className='text-12px text-[var(--color-text-3)]'>{t('project.settings.ttsVoice')}</span>
            <Input
              placeholder={t('project.settings.ttsVoicePlaceholder')}
              value={providerConfig.tts_voice ?? ''}
              onChange={(v) => setProviderConfig((prev) => ({ ...prev, tts_voice: v || undefined }))}
            />
          </div>
          <div className='flex flex-col gap-4px flex-1'>
            <span className='text-12px text-[var(--color-text-3)]'>{t('project.settings.sttLanguage')}</span>
            <Input
              placeholder={t('project.settings.sttLanguagePlaceholder')}
              value={providerConfig.stt_language ?? ''}
              onChange={(v) => setProviderConfig((prev) => ({ ...prev, stt_language: v || undefined }))}
            />
          </div>
        </div>
      </section>

      {/* Temperature */}
      <section>
        <h2 className='text-14px font-semibold text-[var(--color-text-1)] mb-6px m-0'>
          {t('project.settings.temperature')}
        </h2>
        <div className='flex items-center gap-12px'>
          <Slider
            value={(providerConfig.temperature ?? 0.7) * 100}
            onChange={(v) => setProviderConfig((prev) => ({ ...prev, temperature: (v as number) / 100 }))}
            min={0}
            max={200}
            step={5}
            style={{ flex: 1 }}
          />
          <span className='text-13px text-[var(--color-text-2)] w-40px text-right'>
            {(providerConfig.temperature ?? 0.7).toFixed(2)}
          </span>
        </div>
      </section>

      {/* Save button */}
      <div className='flex justify-end'>
        <Button type='primary' loading={saving} onClick={() => void handleSave()}>
          {t('common.save')}
        </Button>
      </div>
    </div>
  );
};

export default ProjectSettings;
