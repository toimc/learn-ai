<template>
  <div class="ai-chat-prompt-input-tools">
    <slot />
  </div>
</template>

<style>
@layer ai-chat-components {
  .ai-chat-prompt-input-tools {
    display: flex;
    gap: 2px;
  }
}
</style>
