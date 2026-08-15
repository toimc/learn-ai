<script setup lang="ts">
import type { Component } from 'vue'

withDefaults(
  defineProps<{
    icon?: Component
    title?: string
    description?: string
  }>(),
  {
    icon: undefined,
    title: '有什么可以帮你的？',
    description: '选择一个话题开始，或直接输入你的问题',
  },
)
</script>

<template>
  <div class="ai-chat-conversation-empty">
    <div class="ai-chat-conversation-empty__logo">
      <slot name="icon">
        <svg
          v-if="!icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
        <component :is="icon" v-else />
      </slot>
    </div>
    <h1 class="ai-chat-conversation-empty__title">{{ title }}</h1>
    <p class="ai-chat-conversation-empty__desc">{{ description }}</p>
    <div class="ai-chat-conversation-empty__suggestions">
      <slot name="suggestions" />
    </div>
  </div>
</template>

<style>
@layer ai-chat-components {
  .ai-chat-conversation-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    padding: 40px 20px;
  }

  .ai-chat-conversation-empty__logo {
    width: 52px;
    height: 52px;
    border-radius: 16px;
    background: linear-gradient(135deg, #6366f1 0%, #a78bfa 50%, #c084fc 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 20px;
    color: #fff;
  }

  .ai-chat-conversation-empty__logo svg {
    width: 28px;
    height: 28px;
  }

  .ai-chat-conversation-empty__title {
    font-size: 22px;
    font-weight: 600;
    margin-bottom: 8px;
    color: var(--ai-chat-color-text-primary);
  }

  .ai-chat-conversation-empty__desc {
    font-size: 14px;
    color: var(--ai-chat-color-text-muted);
    margin-bottom: 28px;
  }

  .ai-chat-conversation-empty__suggestions {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
    width: 100%;
    max-width: 560px;
  }

  @media (max-width: 768px) {
    .ai-chat-conversation-empty__suggestions {
      grid-template-columns: 1fr;
    }
  }
}
</style>
