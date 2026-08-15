<template>
  <div class="ai-chat-message-actions">
    <slot />
  </div>
</template>

<style>
@layer ai-chat-components {
  .ai-chat-message-actions {
    display: flex;
    gap: 2px;
    margin-top: 8px;
    opacity: 0;
    transition: opacity var(--ai-chat-duration-fast) var(--ai-chat-easing);
  }

  .ai-chat-message:hover .ai-chat-message-actions {
    opacity: 1;
  }
}
</style>
