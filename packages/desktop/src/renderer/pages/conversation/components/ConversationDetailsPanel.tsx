/**
 * @license
 * Copyright 2025 AionUi (aura.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Message, Popconfirm, Divider, List, Typography } from '@arco-design/web-react';
import { Close, Delete, Add, History, Notes } from '@icon-park/react';
import { ipcBridge } from '@/common';
import type { TConversationMemory } from '@/common/types/project/memoryTypes';
import { useSessionMemory } from '@/renderer/hooks/context/SessionMemoryContext';

type ConversationDetailsPanelProps = {
  conversationId: string;
  onClose: () => void;
};

const ConversationDetailsPanel: React.FC<ConversationDetailsPanelProps> = ({ conversationId, onClose }) => {
  const { t } = useTranslation();
  const { sessionNotes, addSessionNote, removeSessionNote } = useSessionMemory();
  const [summaries, setSummaries] = useState<TConversationMemory[]>([]);
  const [newNoteValue, setNewNoteValue] = useState('');
  const [loadingSummaries, setLoadingSummaries] = useState(false);

  const notes = sessionNotes[conversationId] ?? [];

  const loadSummaries = useCallback(async () => {
    setLoadingSummaries(true);
    try {
      const list = await ipcBridge.conversationMemory.list.invoke({ conversationId });
      setSummaries(list);
    } catch (err) {
      console.error('[DetailsPanel] Failed to load summaries', err);
    } finally {
      setLoadingSummaries(false);
    }
  }, [conversationId]);

  useEffect(() => {
    void loadSummaries();
  }, [loadSummaries]);

  const handleAddNote = () => {
    if (!newNoteValue.trim()) return;
    addSessionNote(conversationId, newNoteValue.trim());
    setNewNoteValue('');
  };

  const handleDeleteSummary = async (id: string) => {
    try {
      await ipcBridge.conversationMemory.delete.invoke({ id });
      await loadSummaries();
      Message.success(t('project.memory.deleted', { defaultValue: 'Summary deleted successfully' }));
    } catch {
      Message.error(t('project.memory.deleteError', { defaultValue: 'Failed to delete summary' }));
    }
  };

  return (
    <div className='w-300px border-l border-[var(--color-border-2)] bg-[var(--color-bg-2)] flex flex-col h-full overflow-hidden shrink-0'>
      {/* Header */}
      <div className='p-16px border-b border-[var(--color-border-2)] flex items-center justify-between shrink-0 bg-[var(--color-bg-1)]'>
        <Typography.Title heading={6} className='m-0 flex items-center gap-8px'>
          <Notes size={16} />
          {t('project.memory.detailsTitle', { defaultValue: 'Conversation Details' })}
        </Typography.Title>
        <Button
          type='text'
          size='small'
          icon={<Close size={16} />}
          onClick={onClose}
          className='text-[var(--color-text-3)]'
        />
      </div>

      {/* Content */}
      <div className='flex-1 overflow-y-auto p-16px flex flex-col gap-24px'>
        {/* Ephemeral Session Notes */}
        <div>
          <Typography.Title heading={6} className='mt-0 mb-8px'>
            {t('project.memory.sessionNotes', { defaultValue: 'Temporary Session Notes' })}
          </Typography.Title>
          <Typography.Paragraph className='text-[var(--color-text-3)] text-12px mb-12px'>
            {t('project.memory.sessionNotesDesc', {
              defaultValue: 'Session-only guidance, destroyed when changing or closing chats.',
            })}
          </Typography.Paragraph>

          <div className='flex gap-8px mb-12px'>
            <Input
              value={newNoteValue}
              onChange={setNewNoteValue}
              onPressEnter={handleAddNote}
              placeholder={t('project.memory.addSessionNotePlaceholder', {
                defaultValue: 'Add ephemeral instruction...',
              })}
              size='small'
            />
            <Button type='primary' size='small' icon={<Add size={14} />} onClick={handleAddNote} />
          </div>

          <List
            size='small'
            noDataElement={
              <div className='text-12px text-[var(--color-text-4)] text-center py-8px'>
                {t('project.memory.noSessionNotes', { defaultValue: 'No ephemeral notes added.' })}
              </div>
            }
            dataSource={notes}
            render={(note, index) => (
              <List.Item
                key={index}
                className='py-6px px-8px text-13px bg-[var(--color-bg-1)] rounded-4px mb-4px flex items-center justify-between border-none'
              >
                <span className='truncate mr-8px text-[var(--color-text-2)]'>{note}</span>
                <Button
                  type='text'
                  size='mini'
                  status='danger'
                  icon={<Delete size={14} />}
                  onClick={() => removeSessionNote(conversationId, index)}
                  className='shrink-0'
                />
              </List.Item>
            )}
          />
        </div>

        <Divider className='m-0' />

        {/* History Summaries */}
        <div className='flex flex-col min-h-0 flex-1'>
          <Typography.Title heading={6} className='mt-0 mb-8px flex items-center gap-6px'>
            <History size={16} />
            {t('project.memory.historySummaries', { defaultValue: 'Context Summaries' })}
          </Typography.Title>
          <Typography.Paragraph className='text-[var(--color-text-3)] text-12px mb-12px'>
            {t('project.memory.historySummariesDesc', {
              defaultValue: 'Automatic history logs created dynamically to keep context compact.',
            })}
          </Typography.Paragraph>

          <div className='overflow-y-auto flex-1'>
            <List
              loading={loadingSummaries}
              noDataElement={
                <div className='text-12px text-[var(--color-text-4)] text-center py-16px'>
                  {t('project.memory.noSummaries', { defaultValue: 'No summaries generated yet.' })}
                </div>
              }
              dataSource={summaries}
              render={(item) => (
                <div
                  key={item.id}
                  className='p-10px bg-[var(--color-bg-1)] rounded-6px mb-8px border border-[var(--color-border-1)] flex flex-col gap-6px relative group'
                >
                  <div className='flex items-center justify-between'>
                    <Typography.Text type='secondary' className='text-11px font-medium'>
                      {new Date(item.created_at).toLocaleString()}
                    </Typography.Text>
                    <Popconfirm
                      title={t('project.memory.deleteConfirmSummary', {
                        defaultValue: 'Are you sure you want to delete this summary version?',
                      })}
                      onOk={() => void handleDeleteSummary(item.id)}
                    >
                      <Button
                        type='text'
                        size='mini'
                        status='danger'
                        icon={<Delete size={12} />}
                        className='opacity-0 group-hover:opacity-100 transition-opacity duration-150 p-2px h-auto'
                      />
                    </Popconfirm>
                  </div>
                  <Typography.Paragraph className='text-12px m-0 leading-1.4 text-[var(--color-text-2)] whitespace-pre-wrap'>
                    {item.content}
                  </Typography.Paragraph>
                </div>
              )}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConversationDetailsPanel;
