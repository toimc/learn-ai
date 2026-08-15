<template>
  <div class="ai-chat-attachment-empty">
    <slot>暂无附件</slot>
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
