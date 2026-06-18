<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watchEffect } from 'vue'
import { createApp, type App } from 'vue'
import CodeBlock from './CodeBlock.vue'
import MermaidBlock from './MermaidBlock.vue'
import { useStreamingMarkdown } from './composables/useStreamingMarkdown'

const props = defineProps<{
  content: string
  streaming?: boolean
}>()

const { html, setContent, flush } = useStreamingMarkdown()
const root = ref<HTMLElement | null>(null)
const mountedApps: App[] = []

// 流式期间每次 html 更新会重建子组件挂载；增量着色优化留待后续
async function mountSubComponents() {
  mountedApps.forEach((a) => a.unmount())
  mountedApps.length = 0
  await nextTick()
  const el = root.value
  if (!el) return

  // 代码围栏：把 markdown-it 的 <pre><code> 替换为挂载的 CodeBlock
  // 选择 pre > code（含无 language- 类的纯文本围栏），inline code 为 :not(pre) > code 不受影响
  el.querySelectorAll('pre > code').forEach((codeEl) => {
    const pre = codeEl.parentElement
    if (!pre) return
    try {
      const lang = /language-(\w+)/.exec(codeEl.className)?.[1] ?? 'text'
      const code = codeEl.textContent ?? ''
      const host = document.createElement('div')
      const app = createApp(CodeBlock, {
        code,
        language: lang,
        streaming: props.streaming,
      })
      app.mount(host) // 先挂载到游离 host，成功后再替换进 DOM
      pre.replaceWith(host)
      mountedApps.push(app)
    } catch {
      // 单块挂载失败（如高亮异常）：保留原 pre>code，继续处理其余块
    }
  })

  // mermaid 占位 div → MermaidBlock（直接挂载到占位元素本身）
  el.querySelectorAll('[data-mermaid]').forEach((ph) => {
    try {
      const code = decodeURIComponent(ph.getAttribute('data-mermaid') ?? '')
      const app = createApp(MermaidBlock, { code })
      app.mount(ph as HTMLElement)
      mountedApps.push(app)
    } catch {
      // mermaid 自身已处理渲染异常，此处仅兜底：保留占位，继续处理其余块
    }
  })
}

watchEffect(() => {
  setContent(props.content)
})
watchEffect(() => {
  if (!props.streaming) flush()
})
watchEffect(() => {
  if (html.value) mountSubComponents()
})

onBeforeUnmount(() => {
  mountedApps.forEach((a) => a.unmount())
})
</script>

<template>
  <div ref="root" class="ai-chat-markdown" v-html="html" />
</template>

<style>
.ai-chat-markdown {
  font-size: 14px;
  line-height: 1.7;
  word-wrap: break-word;
}

.ai-chat-markdown :deep(h1),
.ai-chat-markdown :deep(h2),
.ai-chat-markdown :deep(h3) {
  margin: 16px 0 8px;
}

.ai-chat-markdown :deep(pre) {
  background: var(--ai-chat-code-bg, #1e1e2e);
  color: var(--ai-chat-code-color, #cdd6f4);
  padding: 12px 16px;
  border-radius: 6px;
  overflow-x: auto;
  margin: 8px 0;
}

.ai-chat-markdown :deep(code) {
  font-family: var(
    --ai-chat-font-mono,
    'Menlo',
    'Monaco',
    'Courier New',
    monospace
  );
  font-size: 13px;
}

.ai-chat-markdown :deep(:not(pre) > code) {
  background: var(--ai-chat-inline-code-bg, #f1f5f9);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.9em;
}

.ai-chat-markdown :deep(strong) {
  font-weight: 600;
}
</style>
