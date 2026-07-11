/**
 * @license
 * Copyright 2025 AionUi (aura.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Message, Popconfirm, Typography } from '@arco-design/web-react';
import { Delete, Search } from '@icon-park/react';
import { ipcBridge } from '@/common';
import type { TProjectFile } from '@/common/types/project/projectTypes';

type ProjectFilesProps = {
  projectId: string;
};

const ProjectFiles: React.FC<ProjectFilesProps> = ({ projectId }) => {
  const { t } = useTranslation();
  const [files, setFiles] = useState<TProjectFile[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFiles = useCallback(async () => {
    try {
      const list = await ipcBridge.projects.listFiles.invoke({ id: projectId });
      setFiles(list);
    } catch {
      console.error('[ProjectFiles] Failed to load files');
    }
  }, [projectId]);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const fileList = e.target.files;
      if (!fileList || fileList.length === 0) return;
      setLoading(true);
      try {
        for (const file of Array.from(fileList)) {
          const formData = new FormData();
          formData.append('project_id', projectId);
          formData.append('file', file);
          await ipcBridge.projects.uploadFile.invoke(formData);
        }
        await loadFiles();
        Message.success(t('project.files.uploadSuccess'));
      } catch {
        Message.error(t('project.files.uploadError'));
      } finally {
        setLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [projectId, loadFiles, t]
  );

  const handleDelete = useCallback(
    async (fileId: string) => {
      try {
        await ipcBridge.projects.deleteFile.invoke({ project_id: projectId, file_id: fileId });
        await loadFiles();
        Message.success(t('project.files.deleteSuccess'));
      } catch {
        Message.error(t('project.files.deleteError'));
      }
    },
    [projectId, loadFiles, t]
  );

  const filtered = files.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()));

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <div className='flex flex-col gap-12px'>
      {/* Toolbar */}
      <div className='flex items-center gap-8px'>
        <Input
          prefix={<Search size={14} />}
          placeholder={t('project.files.search')}
          value={search}
          onChange={setSearch}
          className='flex-1'
          allowClear
        />
        <Button type='primary' loading={loading} onClick={() => fileInputRef.current?.click()}>
          {t('project.files.upload')}
        </Button>
        <input ref={fileInputRef} type='file' multiple className='hidden' onChange={(e) => void handleUpload(e)} />
      </div>

      {/* File list */}
      {filtered.length === 0 ? (
        <div className='flex flex-col items-center justify-center py-40px text-[var(--color-text-3)]'>
          <p>{t('project.files.empty')}</p>
        </div>
      ) : (
        <div className='flex flex-col gap-4px'>
          {filtered.map((file) => (
            <div
              key={file.id}
              className='flex items-center gap-10px px-12px py-10px rounded-8px bg-[var(--color-fill-1)] hover:bg-[var(--color-fill-2)] transition-colors duration-150'
            >
              <div className='flex-1 min-w-0'>
                <Typography.Text className='text-13px truncate block'>{file.name}</Typography.Text>
                <Typography.Text className='text-11px text-[var(--color-text-3)]'>
                  {formatSize(file.size)}
                  {file.mime_type ? ` · ${file.mime_type}` : ''}
                </Typography.Text>
              </div>
              <Popconfirm
                title={t('project.files.deleteConfirm')}
                onOk={() => void handleDelete(file.id)}
                okButtonProps={{ status: 'danger' }}
              >
                <Button type='text' size='mini' icon={<Delete size={14} />} status='danger' />
              </Popconfirm>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProjectFiles;
