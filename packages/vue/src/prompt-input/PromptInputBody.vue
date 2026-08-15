<template>
  <div class="ai-chat-prompt-input-body">
    <slot />
  </div>
</template>

<style>
@layer ai-chat-components {
  .ai-chat-prompt-input-body {
    display: flex;
    align-items: flex-end;
  }
}
</style>
