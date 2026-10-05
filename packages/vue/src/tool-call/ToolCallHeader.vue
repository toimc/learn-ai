<script setup lang="ts">
import { inject, computed } from 'vue'
import type { ToolCallInfo, ToolCallStatus } from '@toimc/core'
import { formatDuration } from '../utils/format'
import { aiChatI18n } from '../locales'

const { t } = aiChatI18n.global

const data = inject<ToolCallInfo>('toolCallData')!

// 六态徽章映射（对齐 core 的 ToolCallStatus；旧三值 calling/completed/error 图标不变）
const STATUS_ICON: Record<ToolCallStatus, string> = {
  pending: '⏳',
  calling: '⚡',
  'awaiting-approval': '⛨',
  completed: '✓',
  denied: '⊘',
  error: '✗',
}
const STATUS_LABEL_KEY: Record<ToolCallStatus, string> = {
  pending: 'toolCall.statusPending',
  calling: 'toolCall.statusCalling',
  'awaiting-approval': 'toolCall.statusAwaitingApproval',
  completed: 'toolCall.statusCompleted',
  denied: 'toolCall.statusDenied',
  error: 'toolCall.statusError',
}

const statusIcon = computed(() => STATUS_ICON[data.status] ?? '⚡')
const statusLabel = computed(() => t(STATUS_LABEL_KEY[data.status]))
const statusClass = computed(() => `ai-chat-tool-call-header--${data.status}`)
</script>

<template>
  <span class="ai-chat-tool-call-header" :class="[statusClass]">
    <span class="ai-chat-tool-call-header__icon">{{ statusIcon }}</span>
    <span class="ai-chat-tool-call-header__name">{{ data.name }}</span>
    <span class="ai-chat-tool-call-header__status">{{ statusLabel }}</span>
    <span v-if="data.duration" class="ai-chat-tool-call-header__duration">
      {{ formatDuration(data.duration) }}
    </span>
  </span>
</template>

<style>
@layer ai-chat-components {
  .ai-chat-tool-call-header {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .ai-chat-tool-call-header__icon {
    font-size: 12px;
    font-style: normal;
    flex-shrink: 0;
  }

  .ai-chat-tool-call-header--pending .ai-chat-tool-call-header__icon {
    color: var(--ai-chat-color-text-muted);
  }

  .ai-chat-tool-call-header--calling .ai-chat-tool-call-header__icon {
    color: var(--ai-chat-color-status-warning, #f59e0b);
    display: inline-block;
    animation: ai-chat-tool-call-header-pulse 1.6s ease-in-out infinite;
  }

  .ai-chat-tool-call-header--awaiting-approval .ai-chat-tool-call-header__icon {
    color: var(--ai-chat-color-status-warning, #f59e0b);
  }

  .ai-chat-tool-call-header--completed .ai-chat-tool-call-header__icon {
    color: var(--ai-chat-color-status-success, #22c55e);
  }

  .ai-chat-tool-call-header--denied .ai-chat-tool-call-header__icon {
    color: var(--ai-chat-color-status-warning, #f59e0b);
  }

  .ai-chat-tool-call-header--error .ai-chat-tool-call-header__icon {
    color: var(--ai-chat-color-status-error, #ef4444);
  }

  @keyframes ai-chat-tool-call-header-pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.45;
    }
  }

  .ai-chat-tool-call-header__name {
    font-weight: 500;
    color: var(--ai-chat-color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* 状态标签：小号弱化徽章；awaiting-approval 走 warning 描边以区别 calling */
  .ai-chat-tool-call-header__status {
    flex-shrink: 0;
    font-size: 11px;
    line-height: 1;
    padding: 2px 6px;
    border-radius: var(--ai-chat-radius-sm);
    color: var(--ai-chat-color-text-muted);
    background: var(--ai-chat-color-bg-secondary);
  }

  .ai-chat-tool-call-header--awaiting-approval
    .ai-chat-tool-call-header__status {
    color: var(--ai-chat-color-status-warning, #f59e0b);
    border: 1px solid var(--ai-chat-color-status-warning, #f59e0b);
    background: transparent;
  }

  .ai-chat-tool-call-header--error .ai-chat-tool-call-header__status {
    color: var(--ai-chat-color-status-error, #ef4444);
  }

  .ai-chat-tool-call-header__duration {
    color: var(--ai-chat-color-text-muted);
    font-size: 12px;
    margin-left: auto;
    flex-shrink: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .ai-chat-tool-call-header--calling .ai-chat-tool-call-header__icon {
      animation: none;
    }
  }
}
</style>
