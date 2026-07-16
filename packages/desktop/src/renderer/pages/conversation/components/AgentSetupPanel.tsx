/**
 * @license
 * Copyright 2025 AionUi (aura.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * AgentSetupPanel
 *
 * Rendered inside the conversation view (via AcpChat's emptySlot prop) when
 * one or more agent dependencies are missing.  Reads the dependency list from
 * sessionStorage (written by useGuidSend before navigation) and displays
 * actionable setup instructions for each missing item.
 *
 * After the user resolves a dependency they can click "Verify Installation"
 * which re-probes via agentHealth.refresh IPC.  If all deps are now satisfied
 * the panel unmounts and the conversation becomes usable normally.
 *
 * Design constraints:
 *  - No raw interactive HTML — uses @arco-design/web-react components.
 *  - No OS probing from the renderer — all re-checks go through IPC.
 *  - Icons from @icon-park/react.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Button, Space, Typography } from '@arco-design/web-react';
import { SettingTwo, Terminal, LinkCloud, Shield, Lock, Copy, CheckOne, CloseOne, Loading } from '@icon-park/react';
import { useTranslation } from 'react-i18next';
import type { DependencyCheckResult, DependencyType } from '@/common/types/agent/agentHealthTypes';
import { useAgentHealthQuery } from '@/renderer/hooks/agent/useAgentHealthQuery';
import useSettingsModal from '@/renderer/components/settings/SettingsModal/useSettingsModal';
import styles from './AgentSetupPanel.module.css';

const { Title, Paragraph, Text } = Typography;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEP_ICONS: Record<DependencyType, React.ReactNode> = {
  binary: <Terminal size={20} />,
  provider: <LinkCloud size={20} />,
  env_var: <Shield size={20} />,
  auth: <Lock size={20} />,
  platform: <SettingTwo size={20} />,
};

function readMissingDeps(conversationId: string): DependencyCheckResult[] {
  try {
    const raw =
      sessionStorage.getItem(`agent_missing_deps_${conversationId}`) ??
      sessionStorage.getItem(`agent_missing_deps_acp_${conversationId}`);
    if (!raw) return [];
    return JSON.parse(raw) as DependencyCheckResult[];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Sub-component: single dependency row
// ---------------------------------------------------------------------------

type DepRowProps = {
  dep: DependencyCheckResult;
  onCopy: (text: string) => void;
  onOpenSettings: () => void;
};

const DepRow: React.FC<DepRowProps> = ({ dep, onCopy, onOpenSettings }) => {
  const { t } = useTranslation();

  const iconNode = DEP_ICONS[dep.type] ?? <SettingTwo size={20} />;

  const typeLabel = t(`guid.agentSetup.depType.${dep.type}`, { defaultValue: dep.type });

  return (
    <div className={styles.depRow}>
      <div className={styles.depIcon}>{iconNode}</div>
      <div className={styles.depContent}>
        <div className={styles.depHeader}>
          <Text bold className={styles.depName}>
            {dep.name}
          </Text>
          <Text className={styles.depTypeTag}>{typeLabel}</Text>
        </div>
        {dep.description && <Paragraph className={styles.depDescription}>{dep.description}</Paragraph>}
        {dep.installCommand && (
          <div className={styles.depInstall}>
            <code className={styles.depInstallCode}>{dep.installCommand}</code>
            <Button
              type='text'
              size='mini'
              icon={<Copy size={14} />}
              onClick={() => onCopy(dep.installCommand!)}
              className={styles.copyBtn}
            >
              {t('guid.agentSetup.copyCommand', { defaultValue: 'Copy' })}
            </Button>
          </div>
        )}
        {dep.type === 'provider' && (
          <Button
            type='outline'
            size='small'
            icon={<LinkCloud size={14} />}
            onClick={onOpenSettings}
            className={styles.actionBtn}
          >
            {t('guid.agentSetup.configureProvider', { defaultValue: 'Configure Provider' })}
          </Button>
        )}
        {dep.type === 'env_var' && (
          <Button
            type='outline'
            size='small'
            icon={<Shield size={14} />}
            onClick={onOpenSettings}
            className={styles.actionBtn}
          >
            {t('guid.agentSetup.openSettings', { defaultValue: 'Open Settings' })}
          </Button>
        )}
        {dep.installUrl && (
          <a href={dep.installUrl} target='_blank' rel='noopener noreferrer' className={styles.docLink}>
            {t('guid.agentSetup.viewDocs', { defaultValue: 'View Documentation →' })}
          </a>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export type AgentSetupPanelProps = {
  conversationId: string;
};

const AgentSetupPanel: React.FC<AgentSetupPanelProps> = ({ conversationId }) => {
  const { t } = useTranslation();
  const { refresh } = useAgentHealthQuery();
  const { openSettings, settingsModal } = useSettingsModal();

  const [missingDeps, setMissingDeps] = useState<DependencyCheckResult[]>(() => readMissingDeps(conversationId));
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifySuccess, setVerifySuccess] = useState(false);

  // Re-read from sessionStorage if the conversationId changes (defensive).
  useEffect(() => {
    setMissingDeps(readMissingDeps(conversationId));
    setVerifySuccess(false);
  }, [conversationId]);

  const handleCopy = useCallback((text: string) => {
    void navigator.clipboard.writeText(text);
  }, []);

  const handleVerify = useCallback(async () => {
    setIsVerifying(true);
    setVerifySuccess(false);
    try {
      await refresh();
      // Re-read missing deps — health snapshot has been updated.
      const remaining = readMissingDeps(conversationId);
      setMissingDeps(remaining);
      if (remaining.length === 0) {
        setVerifySuccess(true);
        // Clear sessionStorage flag once resolved.
        sessionStorage.removeItem(`agent_missing_deps_${conversationId}`);
      }
    } finally {
      setIsVerifying(false);
    }
  }, [conversationId, refresh]);

  const handleOpenSettings = useCallback(() => {
    openSettings('model');
  }, [openSettings]);

  // Nothing to show when all deps are satisfied.
  if (missingDeps.length === 0 && !verifySuccess) return null;

  if (verifySuccess) {
    return (
      <>
        {settingsModal}
        <div className={styles.successCard}>
          <CheckOne size={24} className={styles.successIcon} />
          <Text className={styles.successText}>
            {t('guid.agentSetup.allResolved', {
              defaultValue: 'All dependencies resolved. You can now send a message.',
            })}
          </Text>
        </div>
      </>
    );
  }

  return (
    <>
      {settingsModal}
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <CloseOne size={24} className={styles.headerIcon} />
          <div>
            <Title heading={5} className={styles.panelTitle}>
              {t('guid.agentSetup.title', { defaultValue: 'Setup Required' })}
            </Title>
            <Paragraph className={styles.panelSubtitle}>
              {t('guid.agentSetup.subtitle', {
                defaultValue: 'This agent requires additional configuration before it can run.',
              })}
            </Paragraph>
          </div>
        </div>

        <div className={styles.depList}>
          {missingDeps.map((dep, i) => (
            <DepRow
              key={`${dep.type}-${dep.name}-${i}`}
              dep={dep}
              onCopy={handleCopy}
              onOpenSettings={handleOpenSettings}
            />
          ))}
        </div>

        <Space className={styles.actions}>
          <Button
            type='primary'
            icon={isVerifying ? <Loading size={14} /> : <CheckOne size={14} />}
            loading={isVerifying}
            onClick={() => void handleVerify()}
          >
            {isVerifying
              ? t('guid.agentSetup.verifying', { defaultValue: 'Checking…' })
              : t('guid.agentSetup.verifyInstall', { defaultValue: 'Verify Installation' })}
          </Button>
        </Space>
      </div>
    </>
  );
};

export default AgentSetupPanel;
