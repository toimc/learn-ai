<script setup lang="ts">
import { computed } from 'vue'
import { aiChatI18n } from '../locales'
import type { PromptItem } from './types'

const props = withDefaults(
  defineProps<{
    items: PromptItem[]
    title?: string
    vertical?: boolean
    wrap?: boolean
  }>(),
  { title: undefined, vertical: false, wrap: false },
)

const emit = defineEmits<{ select: [item: PromptItem] }>()

const { t } = aiChatI18n.global
const displayTitle = computed(() => props.title ?? t('prompts.title'))

const listClasses = computed(() => ({
  'ai-chat-prompts__list--vertical': props.vertical,
  'ai-chat-prompts__list--wrap': props.wrap,
}))
</script>

<template>
  <div class="ai-chat-prompts">
    <div class="ai-chat-prompts__title">{{ displayTitle }}</div>
    <div class="ai-chat-prompts__list" :class="listClasses">
      <button
        v-for="item in items"
        :key="item.key"
        type="button"
        class="ai-chat-prompts__item"
        @click="emit('select', item)"
      >
        <slot name="item" :item="item">
          <span v-if="item.icon" class="ai-chat-prompts__icon">{{
            item.icon
          }}</span>
          <span class="ai-chat-prompts__content">
            <span class="ai-chat-prompts__label">{{ item.label }}</span>
            <span v-if="item.description" class="ai-chat-prompts__desc">{{
              item.description
            }}</span>
          </span>
        </slot>
      </button>
    </div>
  </div>
</template>

<style>
@layer ai-chat-components {
  .ai-chat-prompts {
    width: 100%;
  }

  .ai-chat-prompts__title {
    font-size: 13px;
    font-weight: 600;
    color: var(--ai-chat-color-text-secondary);
    margin-bottom: 10px;
    text-align: left;
  }

  .ai-chat-prompts__list {
    display: flex;
    flex-direction: row;
    gap: 10px;
    overflow-x: auto;
  }

  .ai-chat-prompts__list--wrap {
    flex-wrap: wrap;
    overflow-x: visible;
  }

  .ai-chat-prompts__list--vertical {
    flex-direction: column;
    overflow-x: visible;
  }

  .ai-chat-prompts__list--vertical .ai-chat-prompts__item {
    width: 100%;
  }

  .ai-chat-prompts__item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    flex: 0 0 auto;
    text-align: left;
    padding: 10px 14px;
    border: 1px solid var(--ai-chat-color-border);
    border-radius: var(--ai-chat-radius-lg);
    background: var(--ai-chat-color-bg-primary);
    font: inherit;
    cursor: pointer;
    transition:
      border-color 0.2s ease,
      background-color 0.2s ease;
  }

  .ai-chat-prompts__item:hover {
    border-color: var(--ai-chat-color-accent);
    background: var(--ai-chat-color-bg-secondary);
  }

  .ai-chat-prompts__item:focus-visible {
    outline: none;
    box-shadow: var(--ai-chat-control-ring);
  }

  .ai-chat-prompts__icon {
    font-size: 18px;
    line-height: 20px;
    color: var(--ai-chat-color-accent);
    flex-shrink: 0;
  }

  .ai-chat-prompts__content {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .ai-chat-prompts__label {
    font-size: 14px;
    font-weight: 500;
    color: var(--ai-chat-color-text-primary);
  }

  .ai-chat-prompts__desc {
    font-size: 12px;
    color: var(--ai-chat-color-text-muted);
  }
}
</style>
