<script setup lang="ts">
import { ref, watchEffect } from 'vue'
import {
  renderCodeStreaming,
  renderCodeFinal,
} from './composables/useShikiTokenizer'

const props = defineProps<{
  /** 代码块内容（围栏完整） */
  code: string
  /** 语言标识（别名会被归一，未知语言降级纯文本） */
  language?: string
  /** 是否仍在流式输出：true 合并 unstable 让尾行可见；false 调 close 收尾 */
  streaming?: boolean
}>()

/** 高亮后的 HTML（token 级 span 串），异步填充 */
const highlighted = ref<string>('')

// 流式竞态守卫：仅最后一次 run 的结果可写入，避免旧 token 覆盖新结果
let runId = 0

// watchEffect 自动追踪 props 依赖；async 内部 await，异常时回退空串
watchEffect(async () => {
  const { code, language, streaming } = props
  if (code === '') {
    highlighted.value = ''
    return
  }
  const myId = ++runId
  try {
    const html =
      streaming === false
        ? await renderCodeFinal(code, language ?? '')
        : await renderCodeStreaming(code, language ?? '')
    if (myId === runId) highlighted.value = html
  } catch {
    // 降级：清空高亮，保留 pre/code 结构
    if (myId === runId) highlighted.value = ''
  }
})
</script>

<template>
  <div class="ai-chat-code-block">
    <div v-if="language" class="ai-chat-code-block__header">
      {{ language }}
    </div>
    <pre
      class="ai-chat-code-block__pre"
      style="
        color: var(--shiki-light, var(--ai-chat-code-color, #cdd6f4));
        font-family: var(
          --ai-chat-font-mono,
          'Menlo',
          'Monaco',
          'Courier New',
          monospace
        );
      "
    ><code class="ai-chat-code-block__code" v-html="highlighted"></code></pre>
  </div>
</template>

<style>
.ai-chat-code-block {
  border-radius: 6px;
  overflow: hidden;
  margin: 8px 0;
}

.ai-chat-code-block__header {
  padding: 4px 12px;
  font-size: 12px;
  color: var(--ai-chat-code-header-color, #9ca3af);
  background: var(--ai-chat-code-header-bg, #2d2d3f);
  text-transform: uppercase;
}

.ai-chat-code-block__pre {
  margin: 0;
  padding: 12px 16px;
  background: var(--ai-chat-code-bg, #1e1e2e);
  overflow-x: auto;
  font-size: 13px;
  line-height: 1.5;
}

/* 双主题切换：data-theme=dark 时整块用 dark 变量（FR-2.7），无需重新高亮 */
.ai-chat-code-block__pre[data-theme='dark'],
[data-theme='dark'] .ai-chat-code-block__pre {
  color: var(--shiki-dark, var(--ai-chat-code-color, #cdd6f4));
}

/* token span 继承 pre 的当前 color 变量（token 仅带 CSS 变量，无内联 color） */
.ai-chat-code-block__pre span {
  color: inherit;
}
</style>
