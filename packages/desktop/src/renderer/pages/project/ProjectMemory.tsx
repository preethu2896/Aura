/**
 * @license
 * Copyright 2025 AionUi (aura.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Message, Popconfirm, Select, Slider, Typography } from '@arco-design/web-react';
import { Add, Delete, Edit } from '@icon-park/react';
import { ipcBridge } from '@/common';
import type { TProjectMemory } from '@/common/types/project/projectTypes';

type ProjectMemoryProps = {
  projectId: string;
};

type EditingState = {
  id: string | null;
  content: string;
  tags: string[];
  importance: number;
  source: string;
};

const EMPTY_EDIT: EditingState = { id: null, content: '', tags: [], importance: 0.5, source: 'user' };

const ProjectMemory: React.FC<ProjectMemoryProps> = ({ projectId }) => {
  const { t } = useTranslation();
  const [memories, setMemories] = useState<TProjectMemory[]>([]);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [loading, setLoading] = useState(false);

  const loadMemories = useCallback(async () => {
    try {
      const list = await ipcBridge.projects.listMemory.invoke({ id: projectId });
      setMemories(list);
    } catch {
      console.error('[ProjectMemory] Failed to load memory');
    }
  }, [projectId]);

  useEffect(() => {
    void loadMemories();
  }, [loadMemories]);

  const handleSave = useCallback(async () => {
    if (!editing || !editing.content.trim()) return;
    setLoading(true);
    try {
      if (editing.id) {
        await ipcBridge.projects.updateMemory.invoke({
          project_id: projectId,
          id: editing.id,
          content: editing.content.trim(),
          tags: editing.tags.length > 0 ? editing.tags : undefined,
          importance: editing.importance,
          source: editing.source || undefined,
        });
      } else {
        await ipcBridge.projects.addMemory.invoke({
          project_id: projectId,
          content: editing.content.trim(),
          tags: editing.tags.length > 0 ? editing.tags : undefined,
          importance: editing.importance,
          source: editing.source || undefined,
        });
      }
      await loadMemories();
      setEditing(null);
      Message.success(t('project.memory.saved'));
    } catch {
      Message.error(t('project.memory.saveError'));
    } finally {
      setLoading(false);
    }
  }, [editing, projectId, loadMemories, t]);

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await ipcBridge.projects.deleteMemory.invoke({ project_id: projectId, id });
        await loadMemories();
        Message.success(t('project.memory.deleted'));
      } catch {
        Message.error(t('project.memory.deleteError'));
      }
    },
    [projectId, loadMemories, t]
  );

  const startEdit = (memory: TProjectMemory) => {
    setEditing({
      id: memory.id,
      content: memory.content,
      tags: memory.tags ?? [],
      importance: memory.importance ?? 0.5,
      source: memory.source ?? 'user',
    });
  };

  return (
    <div className='flex flex-col gap-12px'>
      {/* Add button */}
      {!editing && (
        <Button type='outline' icon={<Add size={14} />} onClick={() => setEditing({ ...EMPTY_EDIT })}>
          {t('project.memory.add')}
        </Button>
      )}

      {/* Editor */}
      {editing && (
        <div className='flex flex-col gap-10px p-14px rounded-8px border border-[var(--color-border-2)] bg-[var(--color-fill-1)]'>
          <Input.TextArea
            value={editing.content}
            onChange={(v) => setEditing((prev) => prev && { ...prev, content: v })}
            placeholder={t('project.memory.contentPlaceholder')}
            autoSize={{ minRows: 2, maxRows: 8 }}
            autoFocus
          />
          <div className='flex items-center gap-8px'>
            <span className='text-12px text-[var(--color-text-3)] flex-shrink-0'>{t('project.memory.source')}</span>
            <Select
              value={editing.source}
              onChange={(v: string) => setEditing((prev) => prev && { ...prev, source: v })}
              size='mini'
              style={{ width: 120 }}
            >
              <Select.Option value='user'>{t('project.memory.sourceUser')}</Select.Option>
              <Select.Option value='agent'>{t('project.memory.sourceAgent')}</Select.Option>
            </Select>
            <span className='text-12px text-[var(--color-text-3)] flex-shrink-0'>{t('project.memory.importance')}</span>
            <Slider
              value={editing.importance * 100}
              onChange={(v) => setEditing((prev) => prev && { ...prev, importance: (v as number) / 100 })}
              style={{ flex: 1 }}
              min={0}
              max={100}
              step={10}
            />
          </div>
          <div className='flex items-center gap-8px justify-end'>
            <Button size='mini' onClick={() => setEditing(null)}>
              {t('common.cancel')}
            </Button>
            <Button type='primary' size='mini' loading={loading} onClick={() => void handleSave()}>
              {t('common.save')}
            </Button>
          </div>
        </div>
      )}

      {/* Memory list */}
      {memories.length === 0 && !editing ? (
        <div className='flex items-center justify-center py-40px text-[var(--color-text-3)]'>
          <p>{t('project.memory.empty')}</p>
        </div>
      ) : (
        <div className='flex flex-col gap-8px'>
          {memories.map((memory) => (
            <div
              key={memory.id}
              className='group flex items-start gap-10px px-12px py-10px rounded-8px bg-[var(--color-fill-1)] hover:bg-[var(--color-fill-2)] transition-colors duration-150'
            >
              <div className='flex-1 min-w-0'>
                <Typography.Paragraph className='text-13px m-0 whitespace-pre-wrap'>
                  {memory.content}
                </Typography.Paragraph>
                {(memory.source || memory.tags?.length) && (
                  <Typography.Text className='text-11px text-[var(--color-text-3)] mt-4px block'>
                    {memory.source && <span className='mr-8px'>{memory.source}</span>}
                    {memory.tags?.map((tag) => (
                      <span key={tag} className='mr-4px px-4px py-1px rounded-3px bg-[var(--color-fill-3)] text-10px'>
                        {tag}
                      </span>
                    ))}
                  </Typography.Text>
                )}
              </div>
              <div className='flex items-center gap-4px opacity-0 group-hover:opacity-100 transition-opacity'>
                <Button type='text' size='mini' icon={<Edit size={12} />} onClick={() => startEdit(memory)} />
                <Popconfirm
                  title={t('project.memory.deleteConfirm')}
                  onOk={() => void handleDelete(memory.id)}
                  okButtonProps={{ status: 'danger' }}
                >
                  <Button type='text' size='mini' icon={<Delete size={12} />} status='danger' />
                </Popconfirm>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProjectMemory;
