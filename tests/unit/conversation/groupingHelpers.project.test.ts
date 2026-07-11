/**
 * @license
 * Copyright 2025 AionUi (aura.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import type { TChatConversation } from '@/common/config/storage';
import { buildGroupedHistory } from '@/renderer/pages/conversation/GroupedHistory/utils/groupingHelpers';
import { DEFAULT_PROJECT_ID } from '@/common/config/storage';

const t = (key: string): string => key;

const conversation = (id: string, extra: TChatConversation['extra'], modified_at: number): TChatConversation =>
  ({
    id,
    name: id,
    type: 'acp',
    created_at: modified_at,
    modified_at,
    extra,
  }) as TChatConversation;

describe('buildGroupedHistory - Project Filtering', () => {
  it('keeps conversations assigned to the General project in the main timeline', () => {
    const result = buildGroupedHistory(
      [conversation('general-conv', { backend: 'aioncore', project_id: DEFAULT_PROJECT_ID }, 100)],
      t
    );

    expect(result.timelineSections[0]?.items).toEqual([
      expect.objectContaining({
        type: 'conversation',
        conversation: expect.objectContaining({ id: 'general-conv' }),
      }),
    ]);
  });

  it('keeps conversations with no project_id assigned in the main timeline', () => {
    const result = buildGroupedHistory([conversation('no-project-conv', { backend: 'aioncore' }, 100)], t);

    expect(result.timelineSections[0]?.items).toEqual([
      expect.objectContaining({
        type: 'conversation',
        conversation: expect.objectContaining({ id: 'no-project-conv' }),
      }),
    ]);
  });

  it('filters out conversations assigned to a custom project', () => {
    const result = buildGroupedHistory(
      [conversation('custom-project-conv', { backend: 'aioncore', project_id: 'custom-uuid-123' }, 100)],
      t
    );

    // Should be filtered out of the timeline (they render in ProjectSiderSection instead)
    expect(result.timelineSections).toEqual([]);
  });
});
