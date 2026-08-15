<script setup lang="ts">
import { aiChatI18n } from '../locales'

const { t } = aiChatI18n.global
</script>

<template>
  <div class="ai-chat-attachment-empty">
    <slot>{{ t('attachments.empty') }}</slot>
  </div>
</template>

<style>
@layer ai-chat-components {
  .ai-chat-attachment-empty {
    font-size: 13px;
    color: var(--ai-chat-color-text-muted);
    padding: 8px 0;
  }
}
</style>
