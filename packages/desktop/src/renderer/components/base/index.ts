/**
 * @license
 * Copyright 2025 AionUi (aura.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * AURA 基础组件库统一导出 / AURA base components unified exports
 *
 * 提供所有基础组件和类型的统一导出入口
 * Provides unified export entry for all base components and types
 */

// ==================== 组件导出 / Component Exports ====================

export { default as AURAModal } from './AURAModal';
export { default as AURACollapse } from './AURACollapse';
export { default as AURASelect } from './AURASelect';
export { default as AURAScrollArea } from './AURAScrollArea';
export { default as AURASteps } from './AURASteps';

// ==================== 类型导出 / Type Exports ====================

// AURAModal 类型 / AURAModal types
export type {
  ModalSize,
  ModalHeaderConfig,
  ModalFooterConfig,
  ModalContentStyleConfig,
  AURAModalProps,
} from './AURAModal';
export { MODAL_SIZES } from './AURAModal';

// AURACollapse 类型 / AURACollapse types
export type { AURACollapseProps, AURACollapseItemProps } from './AURACollapse';

// AURASelect 类型 / AURASelect types
export type { AURASelectProps } from './AURASelect';

// AURASteps 类型 / AURASteps types
export type { AURAStepsProps } from './AURASteps';
