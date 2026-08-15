<template>
  <div class="ai-chat-message-attachments">
    <slot />
  </div>
</template>

<style>
@layer ai-chat-components {
  .ai-chat-message-attachments {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 8px;
  }
}
</style>
