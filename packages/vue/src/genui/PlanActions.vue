<script setup lang="ts">
import { aiChatI18n } from '../locales'
import type { GenuiPlan } from './types'

const { t } = aiChatI18n.global

defineProps<{ plans: GenuiPlan[] }>()
// 组件只上报"用户采纳了哪个方案"，执行什么业务由宿主决定
defineEmits<{ adopt: [planId: string] }>()
</script>

<template>
  <div class="ai-chat-plan-actions">
    <div
      v-for="plan in plans"
      :key="plan.id"
      class="ai-chat-plan-actions__item"
    >
      <div class="ai-chat-plan-actions__text">
        <div class="ai-chat-plan-actions__title">{{ plan.title }}</div>
        <div class="ai-chat-plan-actions__summary">{{ plan.summary }}</div>
      </div>
      <button
        type="button"
        class="ai-chat-plan-actions__adopt"
        @click="$emit('adopt', plan.id)"
      >
        {{ t('genui.adopt') }}
      </button>
    </div>
  </div>
</template>

<style>
@layer ai-chat-components {
  .ai-chat-plan-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-width: 100%;
  }

  .ai-chat-plan-actions__item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border-radius: var(--ai-chat-radius-md);
    background: var(--ai-chat-color-bg-secondary);
  }

  .ai-chat-plan-actions__text {
    flex: 1;
    min-width: 0;
  }

  .ai-chat-plan-actions__title {
    font-weight: 600;
    font-size: 14px;
  }

  .ai-chat-plan-actions__summary {
    font-size: 13px;
    color: var(--ai-chat-color-text-muted);
  }

  .ai-chat-plan-actions__adopt {
    flex-shrink: 0;
    height: 28px;
    padding: 0 12px;
    border: none;
    border-radius: var(--ai-chat-radius-sm);
    background: var(--ai-chat-color-accent);
    color: var(--ai-chat-color-text-on-accent);
    font-size: 13px;
    cursor: pointer;
  }

  .ai-chat-plan-actions__adopt:hover {
    background: var(--ai-chat-color-accent-hover);
  }
}
</style>
