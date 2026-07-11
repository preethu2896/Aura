/**
 * @license
 * Copyright 2025 AionUi (aura.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, List, Message, Popconfirm, Typography } from '@arco-design/web-react';
import { Delete, Add } from '@icon-park/react';
import { ipcBridge } from '@/common';
import type { TWorkspaceMemory } from '@/common/types/project/memoryTypes';

const WorkspaceMemoryModalContent: React.FC = () => {
  const { t } = useTranslation();
  const [memories, setMemories] = useState<TWorkspaceMemory[]>([]);
  const [newMemoryText, setNewMemoryText] = useState('');
  const [loading, setLoading] = useState(false);

  const loadMemories = useCallback(async () => {
    setLoading(true);
    try {
      const list = await ipcBridge.workspaceMemory.list.invoke();
      setMemories(list);
    } catch (err) {
      console.error('[WorkspaceMemory] Failed to load workspace memories', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMemories();
  }, [loadMemories]);

  const handleAddMemory = async () => {
    if (!newMemoryText.trim()) return;
    try {
      await ipcBridge.workspaceMemory.add.invoke({
        content: newMemoryText.trim(),
        tags: [],
        importance: 0.5,
        source: 'user',
      });
      setNewMemoryText('');
      await loadMemories();
      Message.success(t('project.memory.added', { defaultValue: 'Fact added to Workspace Memory' }));
    } catch {
      Message.error(t('project.memory.addError', { defaultValue: 'Failed to add memory' }));
    }
  };

  const handleDeleteMemory = async (id: string) => {
    try {
      await ipcBridge.workspaceMemory.delete.invoke({ id });
      await loadMemories();
      Message.success(t('project.memory.deleted', { defaultValue: 'Fact deleted successfully' }));
    } catch {
      Message.error(t('project.memory.deleteError', { defaultValue: 'Failed to delete memory' }));
    }
  };

  return (
    <div className='flex flex-col h-full gap-16px pr-8px'>
      <div>
        <Typography.Title heading={5} className='mt-0 mb-6px'>
          {t('settings.workspaceMemory', { defaultValue: 'Workspace Memory' })}
        </Typography.Title>
        <Typography.Paragraph className='text-[var(--color-text-3)] text-13px mb-0'>
          {t('project.memory.workspaceMemoryDesc', {
            defaultValue:
              'Define global facts, preferences, writing style rules, and defaults. These instructions are injected into all conversation prompts across projects.',
          })}
        </Typography.Paragraph>
      </div>

      <div className='flex gap-12px shrink-0'>
        <Input
          value={newMemoryText}
          onChange={setNewMemoryText}
          onPressEnter={handleAddMemory}
          placeholder={t('project.memory.addWorkspacePlaceholder', {
            defaultValue: 'e.g., "Keep code examples concise", "I prefer dark themes"...',
          })}
          size='large'
        />
        <Button type='primary' size='large' icon={<Add size={16} />} onClick={handleAddMemory}>
          {t('common.add', { defaultValue: 'Add' })}
        </Button>
      </div>

      <div className='flex-1 overflow-y-auto min-h-0 mt-8px'>
        <List
          loading={loading}
          noDataElement={
            <div className='text-center py-40px text-[var(--color-text-4)] text-14px border border-dashed border-[var(--color-border-2)] rounded-8px bg-[var(--color-bg-2)]'>
              {t('project.memory.noWorkspaceMemory', {
                defaultValue: 'No workspace facts defined yet. Add some above!',
              })}
            </div>
          }
          dataSource={memories}
          render={(item) => (
            <List.Item
              key={item.id}
              className='py-12px px-16px mb-8px bg-[var(--color-bg-2)] rounded-8px border border-[var(--color-border-2)] flex items-center justify-between'
            >
              <Typography.Text className='text-14px text-[var(--color-text-1)] pr-16px break-words max-w-[85%]'>
                {item.content}
              </Typography.Text>
              <Popconfirm
                title={t('project.memory.deleteConfirm', {
                  defaultValue: 'Are you sure you want to delete this fact from your workspace memory?',
                })}
                onOk={() => void handleDeleteMemory(item.id)}
              >
                <Button type='text' size='small' status='danger' icon={<Delete size={16} />} className='shrink-0' />
              </Popconfirm>
            </List.Item>
          )}
        />
      </div>
    </div>
  );
};

export default WorkspaceMemoryModalContent;
