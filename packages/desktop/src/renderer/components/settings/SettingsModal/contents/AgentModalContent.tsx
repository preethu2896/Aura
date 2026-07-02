/**
 * @license
 * Copyright 2025 AionUi (aura.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import LocalAgents from '@/renderer/pages/settings/AgentSettings/LocalAgents';
import AURAScrollArea from '@/renderer/components/base/AURAScrollArea';
import { useSettingsViewMode } from '../settingsViewContext';

const AgentModalContent: React.FC = () => {
  const viewMode = useSettingsViewMode();
  const isPageMode = viewMode === 'page';

  return (
    <div className='flex flex-col h-full w-full'>
      <AURAScrollArea className='flex-1 min-h-0 pb-16px scrollbar-hide' disableOverflow={isPageMode}>
        <LocalAgents />
      </AURAScrollArea>
    </div>
  );
};

export default AgentModalContent;
