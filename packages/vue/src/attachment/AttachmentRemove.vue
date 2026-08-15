<script setup lang="ts">
defineEmits<{ remove: [] }>()
</script>

<template>
  <button class="ai-chat-attachment-remove" @click="$emit('remove')">
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  </button>
</template>

<style>
@layer ai-chat-components {
  .ai-chat-attachment-remove {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: none;
    background: rgba(0, 0, 0, 0.6);
    color: #fff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    visibility: hidden;
    transition: background var(--ai-chat-duration-fast) var(--ai-chat-easing);
  }

  .ai-chat-attachment:hover .ai-chat-attachment-remove {
    visibility: visible;
  }

  .ai-chat-attachment-remove:hover {
    background: rgba(0, 0, 0, 0.8);
  }
}
</style>
