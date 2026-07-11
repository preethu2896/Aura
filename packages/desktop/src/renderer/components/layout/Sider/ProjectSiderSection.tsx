/**
 * @license
 * Copyright 2025 AionUi (aura.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Dropdown, Menu, Message, Modal } from '@arco-design/web-react';
import { Down, Right, DeleteOne, EditOne, MoreOne, Pushpin, Plus } from '@icon-park/react';
import classNames from 'classnames';
import { ipcBridge } from '@/common';
import { DEFAULT_PROJECT_ID } from '@/common/config/storage';
import type { TProject } from '@/common/types/project/projectTypes';
import { useProject } from '@/renderer/hooks/context/ProjectContext';

type ProjectSiderSectionProps = {
  collapsed?: boolean;
  onSessionClick?: () => void;
};

type ProjectRowProps = {
  project: TProject;
  isActive: boolean;
  collapsed: boolean;
  onSelect: (project: TProject) => void;
  onRefresh: () => Promise<void>;
};

const ProjectRow: React.FC<ProjectRowProps> = ({ project, isActive, collapsed, onSelect, onRefresh }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [menuVisible, setMenuVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const isGeneral = project.is_default;

  const handleClick = useCallback(() => {
    onSelect(project);
    void navigate(`/project/${project.id}`);
  }, [project, onSelect, navigate]);

  const handlePin = useCallback(async () => {
    try {
      if (project.pinned) {
        await ipcBridge.projects.unpin.invoke({ id: project.id });
      } else {
        await ipcBridge.projects.pin.invoke({ id: project.id });
      }
      await onRefresh();
    } catch {
      Message.error(t('project.pinError'));
    }
  }, [project, onRefresh, t]);

  const handleArchive = useCallback(async () => {
    try {
      await ipcBridge.projects.archive.invoke({ id: project.id });
      await onRefresh();
      Message.success(t('project.archived'));
    } catch {
      Message.error(t('project.archiveError'));
    }
  }, [project, onRefresh, t]);

  const handleDelete = useCallback(() => {
    Modal.confirm({
      title: t('project.deleteConfirmTitle'),
      content: t('project.deleteConfirm', { name: project.name }),
      okText: t('common.delete'),
      cancelText: t('common.cancel'),
      okButtonProps: { status: 'danger' },
      onOk: async () => {
        try {
          await ipcBridge.projects.delete.invoke({ id: project.id });
          await onRefresh();
          Message.success(t('project.deleted'));
        } catch {
          Message.error(t('project.deleteError'));
        }
      },
    });
  }, [project, onRefresh, t]);

  const menuItems = [
    {
      key: 'settings',
      icon: <EditOne size={14} />,
      label: t('project.settings.title'),
      onClick: (): void => {
        void navigate(`/project/${project.id}`);
      },
    },
    {
      key: 'pin',
      icon: <Pushpin size={14} />,
      label: project.pinned ? t('project.unpin') : t('project.pin'),
      onClick: (): void => {
        void handlePin();
      },
    },
    ...(!isGeneral
      ? [
          {
            key: 'archive',
            icon: <DeleteOne size={14} />,
            label: t('project.archive'),
            onClick: (): void => {
              void handleArchive();
            },
          },
          {
            key: 'delete',
            icon: <DeleteOne size={14} />,
            label: t('project.delete'),
            onClick: (): void => {
              handleDelete();
            },
          },
        ]
      : []),
  ];

  const projectIcon = project.icon ?? '📁';
  const projectColor = project.color ?? 'var(--color-text-3)';

  if (collapsed) {
    return (
      <div
        className={classNames(
          'flex items-center justify-center h-32px mx-4px rounded-6px cursor-pointer transition-colors duration-150',
          isActive ? 'bg-[var(--color-fill-3)]' : 'hover:bg-[var(--color-fill-2)]'
        )}
        title={project.name}
        onClick={handleClick}
        style={{ color: projectColor }}
      >
        <span className='text-16px'>{projectIcon}</span>
      </div>
    );
  }

  return (
    <div className='select-none'>
      {/* Project header row */}
      <div
        className={classNames(
          'group flex items-center gap-6px h-32px px-10px rounded-6px cursor-pointer transition-colors duration-150',
          isActive ? 'bg-[var(--color-fill-3)]' : 'hover:bg-[var(--color-fill-2)]'
        )}
        onClick={handleClick}
        id={`project-row-${project.id}`}
      >
        {/* Expand toggle */}
        <span
          className='flex-shrink-0 text-[var(--color-text-3)] transition-transform duration-150'
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
        >
          {expanded ? <Down size={12} /> : <Right size={12} />}
        </span>

        {/* Icon */}
        <span className='text-14px flex-shrink-0' style={{ color: projectColor }}>
          {projectIcon}
        </span>

        {/* Name */}
        <span
          className='flex-1 min-w-0 text-13px truncate text-[var(--color-text-1)]'
          style={{ fontWeight: isActive ? 500 : 400 }}
        >
          {project.name}
        </span>

        {/* Context menu */}
        <Dropdown
          popupVisible={menuVisible}
          onVisibleChange={setMenuVisible}
          trigger='click'
          position='br'
          droplist={
            <Menu>
              {menuItems.map((item) => (
                <Menu.Item
                  key={item.key}
                  onClick={(e: any) => {
                    e?.stopPropagation?.();
                    setMenuVisible(false);
                    item.onClick();
                  }}
                >
                  <span className='flex items-center gap-6px'>
                    {item.icon}
                    {item.label}
                  </span>
                </Menu.Item>
              ))}
            </Menu>
          }
        >
          <span
            className={classNames(
              'flex-shrink-0 flex items-center justify-center w-20px h-20px rounded-4px text-[var(--color-text-3)]',
              'opacity-0 group-hover:opacity-100 hover:bg-[var(--color-fill-3)] transition-opacity duration-150'
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <MoreOne size={14} />
          </span>
        </Dropdown>
      </div>
    </div>
  );
};

const ProjectSiderSection: React.FC<ProjectSiderSectionProps> = ({
  collapsed = false,
  onSessionClick: _onSessionClick,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { projects, activeProjectId, setActiveProjectId, refresh } = useProject();

  const handleSelect = useCallback(
    (project: TProject): void => {
      setActiveProjectId(project.id);
    },
    [setActiveProjectId]
  );

  const handleNewProject = useCallback(async (): Promise<void> => {
    try {
      const name = t('project.newProjectDefaultName');
      const created = await ipcBridge.projects.create.invoke({ name });
      await refresh();
      void navigate(`/project/${created.id}`);
    } catch {
      Message.error(t('project.createError'));
    }
  }, [t, refresh, navigate]);

  if (projects.length === 0) return null;

  // Separate General from user projects
  const generalProject = projects.find((p) => p.id === DEFAULT_PROJECT_ID);
  const userProjects = projects.filter((p) => p.id !== DEFAULT_PROJECT_ID && !p.archived);

  return (
    <div className='flex flex-col'>
      {/* Section header */}
      {!collapsed && (
        <div className='flex items-center justify-between px-10px h-28px mt-4px'>
          <span className='text-11px font-semibold uppercase tracking-wide text-[var(--color-text-3)]'>
            {t('project.sectionTitle')}
          </span>
          <span
            className='flex items-center justify-center w-20px h-20px rounded-4px cursor-pointer text-[var(--color-text-3)] hover:bg-[var(--color-fill-2)] transition-colors duration-150'
            title={t('project.newProject')}
            onClick={() => {
              void handleNewProject();
            }}
          >
            <Plus size={12} />
          </span>
        </div>
      )}

      {/* General project always first */}
      {generalProject && (
        <ProjectRow
          key={generalProject.id}
          project={generalProject}
          isActive={activeProjectId === generalProject.id}
          collapsed={collapsed}
          onSelect={handleSelect}
          onRefresh={refresh}
        />
      )}

      {/* User projects */}
      {userProjects.map((project) => (
        <ProjectRow
          key={project.id}
          project={project}
          isActive={activeProjectId === project.id}
          collapsed={collapsed}
          onSelect={handleSelect}
          onRefresh={refresh}
        />
      ))}
    </div>
  );
};

export default ProjectSiderSection;
