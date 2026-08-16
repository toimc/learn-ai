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
    /* 外层统一横向 inset：左侧=文字起点，右侧=滚动条离边（WebKit 滚动条
       钉在 padding-box 最右缘，textarea 跟随收窄后自然离边）；右 8/左 14（上下由 Textarea 自身对称 padding 提供） */
    padding: 0 8px 0 14px;
  }
}
</style>
