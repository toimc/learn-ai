<template>
  <div class="ai-chat-prompt-input-footer">
    <div class="ai-chat-prompt-input-footer__tools">
      <slot name="tools" />
    </div>
    <div class="ai-chat-prompt-input-footer__hint">
      <slot name="hint" />
    </div>
  </div>
</template>

<style>
@layer ai-chat-components {
  .ai-chat-prompt-input-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 0 8px 8px 14px;
  }

  .ai-chat-prompt-input-footer__tools {
    display: flex;
    align-items: center;
    gap: 2px;
    min-width: 0;
  }

  /* 右侧动作区（常放 PromptInputSubmit），也兼容提示文案 */
  .ai-chat-prompt-input-footer__hint {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--ai-chat-color-text-muted);
    font-size: 12px;
    white-space: nowrap;
  }
}
</style>
