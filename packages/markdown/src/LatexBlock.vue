<script setup lang="ts">
import { computed } from 'vue'
import katex from 'katex'

const props = defineProps<{
  formula: string
  display?: boolean
}>()

/**
 * 用 KaTeX 同步渲染公式（FR-3.1）。
 * 故意以 `throwOnError: true` 调用并在抛错时回退到源文本（FR-3.3）：
 * 这样任何语法错误都展示原始公式，不会让整条消息渲染崩溃。
 * `output: 'htmlAndMathml'` 同时产出可访问的 MathML 与视觉 HTML。
 */
const html = computed(() => {
  try {
    return katex.renderToString(props.formula, {
      throwOnError: true,
      displayMode: !!props.display,
      output: 'htmlAndMathml',
    })
  } catch {
    return props.formula
  }
})
</script>

<template>
  <span class="ai-chat-latex" :class="{ 'ai-chat-latex--display': display }">
    <!-- KaTeX 已对输出做 HTML 转义；此处仅渲染其产物，不可触发用户脚本 -->
    <span v-html="html" />
  </span>
</template>

<style>
.ai-chat-latex {
  font-family: 'Cambria Math', 'Latin Modern Math', serif;
  font-style: italic;
}

.ai-chat-latex--display {
  display: block;
  text-align: center;
  margin: 12px 0;
  font-size: 1.1em;
}
</style>
