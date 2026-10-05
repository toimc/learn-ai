<script setup lang="ts">
import { computed } from 'vue'
import { aiChatI18n } from '../locales'

const props = defineProps<{
  title?: string
  description?: string
}>()

const { t } = aiChatI18n.global
const displayTitle = computed(() => props.title ?? t('welcome.title'))
const displayDescription = computed(
  () => props.description ?? t('welcome.description'),
)
</script>

<template>
  <div class="ai-chat-welcome">
    <div class="ai-chat-welcome__icon">
      <slot name="icon">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polygon points="12 3 14 10 21 12 14 14 12 21 10 14 3 12 10 10" />
        </svg>
      </slot>
    </div>
    <h2 class="ai-chat-welcome__title">{{ displayTitle }}</h2>
    <p v-if="displayDescription" class="ai-chat-welcome__desc">
      {{ displayDescription }}
    </p>
    <div class="ai-chat-welcome__content">
      <slot />
    </div>
    <div v-if="$slots.extra" class="ai-chat-welcome__extra">
      <slot name="extra" />
    </div>
  </div>
</template>

<style>
@layer ai-chat-components {
  .ai-chat-welcome {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    padding: 40px 20px;
  }

  .ai-chat-welcome__icon {
    width: 52px;
    height: 52px;
    border-radius: 16px;
    background: linear-gradient(
      135deg,
      var(--ai-chat-color-accent-600),
      var(--ai-chat-color-accent-400)
    );
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 20px;
    color: var(--ai-chat-color-text-on-accent);
  }

  .ai-chat-welcome__icon svg {
    width: 28px;
    height: 28px;
  }

  .ai-chat-welcome__title {
    font-size: 22px;
    font-weight: 600;
    margin-bottom: 8px;
    color: var(--ai-chat-color-text-primary);
  }

  .ai-chat-welcome__desc {
    font-size: 14px;
    color: var(--ai-chat-color-text-muted);
    margin-bottom: 28px;
  }

  .ai-chat-welcome__content {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    width: 100%;
    max-width: 640px;
  }

  .ai-chat-welcome__extra {
    margin-top: 24px;
    font-size: 12px;
    color: var(--ai-chat-color-text-muted);
  }
}
</style>
