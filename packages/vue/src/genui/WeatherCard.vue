<script setup lang="ts">
interface Props {
  city: string
  temperatureC: number
  description: string
}

defineProps<Props>()
defineEmits<{ detail: [city: string] }>()
</script>

<template>
  <div
    class="ai-chat-weather-card"
    role="group"
    :aria-label="city"
    @click="$emit('detail', city)"
  >
    <div class="ai-chat-weather-card__city">{{ city }}</div>
    <div class="ai-chat-weather-card__temp">{{ temperatureC }}°C</div>
    <div class="ai-chat-weather-card__desc">{{ description }}</div>
  </div>
</template>

<style>
@layer ai-chat-components {
  .ai-chat-weather-card {
    display: inline-flex;
    flex-direction: column;
    gap: 2px;
    padding: 12px 16px;
    border-radius: var(--ai-chat-radius-md);
    background: var(--ai-chat-color-bg-secondary);
    cursor: pointer;
    max-width: 100%;
  }

  .ai-chat-weather-card__city {
    font-weight: 600;
    font-size: 13px;
  }

  .ai-chat-weather-card__temp {
    font-size: 28px;
    font-weight: 600;
    line-height: 1.2;
    color: var(--ai-chat-color-accent);
  }

  .ai-chat-weather-card__desc {
    font-size: 13px;
    color: var(--ai-chat-color-text-muted);
  }
}
</style>
