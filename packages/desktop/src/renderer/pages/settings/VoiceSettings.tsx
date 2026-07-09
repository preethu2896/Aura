/**
 * @license
 * Copyright 2026 AionUi (aura.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import VoiceModalContent from '@/renderer/components/settings/SettingsModal/contents/VoiceModalContent';
import SettingsPageWrapper from './components/SettingsPageWrapper';

const VoiceSettings: React.FC = () => {
  return (
    <SettingsPageWrapper contentClassName='max-w-1100px'>
      <VoiceModalContent />
    </SettingsPageWrapper>
  );
};

export default VoiceSettings;
