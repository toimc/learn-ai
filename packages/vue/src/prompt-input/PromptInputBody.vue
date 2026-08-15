<template>
  <div class="ai-chat-prompt-input-body">
    <slot />
  </div>
</template>

<style>
@layer ai-chat-components {
  .ai-chat-prompt-input-body {
    position: relative;
    display: flex;
    align-items: flex-end;
  }
}
</style>
