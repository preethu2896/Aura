/**
 * @license
 * Copyright 2025 AionUi (aura.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Input, Message, Modal, Tabs } from '@arco-design/web-react';
import { ArrowLeft, EditOne } from '@icon-park/react';
import { ipcBridge } from '@/common';
import type { TProject } from '@/common/types/project/projectTypes';
import { useProject } from '@/renderer/hooks/context/ProjectContext';
import ProjectFiles from './ProjectFiles';
import ProjectMemory from './ProjectMemory';
import ProjectSettings from './ProjectSettings';

const ProjectPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { getProject, refresh, activeProjectId, setActiveProjectId } = useProject();

  const [project, setProject] = useState<TProject | undefined>(id ? getProject(id) : undefined);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');

  // Sync project from context whenever it updates
  useEffect(() => {
    if (id) {
      const p = getProject(id);
      setProject(p);
      if (p && activeProjectId !== p.id) {
        setActiveProjectId(p.id);
      }
    }
  }, [id, getProject, activeProjectId, setActiveProjectId]);

  const handleRename = useCallback(async () => {
    if (!project || !nameValue.trim()) return;
    try {
      await ipcBridge.projects.update.invoke({ id: project.id, updates: { name: nameValue.trim() } });
      await refresh();
      setEditingName(false);
    } catch {
      Message.error(t('project.renameError'));
    }
  }, [project, nameValue, refresh, t]);

  const startEditing = useCallback(() => {
    if (!project) return;
    setNameValue(project.name);
    setEditingName(true);
  }, [project]);

  if (!project) {
    return (
      <div className='flex flex-col items-center justify-center h-full text-[var(--color-text-3)]'>
        <p>{t('project.notFound')}</p>
        <Button onClick={() => void navigate('/guid')} className='mt-12px'>
          {t('common.back')}
        </Button>
      </div>
    );
  }

  const projectIcon = project.icon ?? '📁';

  return (
    <div className='flex flex-col h-full bg-[var(--color-bg-1)]'>
      {/* Header */}
      <div className='flex items-center gap-10px px-20px pt-16px pb-12px border-b border-[var(--color-border-2)]'>
        <Button
          type='text'
          size='mini'
          icon={<ArrowLeft size={16} />}
          onClick={() => void navigate(-1)}
          className='flex-shrink-0'
        />
        <span className='text-20px flex-shrink-0'>{projectIcon}</span>
        {editingName ? (
          <div className='flex items-center gap-8px flex-1 min-w-0'>
            <Input
              value={nameValue}
              onChange={setNameValue}
              onPressEnter={() => void handleRename()}
              autoFocus
              className='flex-1'
            />
            <Button type='primary' size='mini' onClick={() => void handleRename()}>
              {t('common.save')}
            </Button>
            <Button size='mini' onClick={() => setEditingName(false)}>
              {t('common.cancel')}
            </Button>
          </div>
        ) : (
          <div className='flex items-center gap-8px flex-1 min-w-0'>
            <h1 className='text-16px font-semibold text-[var(--color-text-1)] truncate m-0'>{project.name}</h1>
            <Button
              type='text'
              size='mini'
              icon={<EditOne size={14} />}
              onClick={startEditing}
              className='flex-shrink-0 text-[var(--color-text-3)]'
            />
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className='flex-1 min-h-0 overflow-hidden'>
        <Tabs defaultActiveTab='settings' className='h-full [&>.arco-tabs-header]:px-20px'>
          <Tabs.TabPane key='settings' title={t('project.settings.title')}>
            <div className='h-full overflow-y-auto px-20px py-16px'>
              <ProjectSettings project={project} onUpdate={refresh} />
            </div>
          </Tabs.TabPane>
          <Tabs.TabPane key='files' title={t('project.files.title')}>
            <div className='h-full overflow-y-auto px-20px py-16px'>
              <ProjectFiles projectId={project.id} />
            </div>
          </Tabs.TabPane>
          <Tabs.TabPane key='memory' title={t('project.memory.title')}>
            <div className='h-full overflow-y-auto px-20px py-16px'>
              <ProjectMemory projectId={project.id} />
            </div>
          </Tabs.TabPane>
        </Tabs>
      </div>
    </div>
  );
};

export default ProjectPage;
