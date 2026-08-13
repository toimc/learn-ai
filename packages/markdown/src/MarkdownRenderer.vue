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

<!-- 必须 scoped：:deep() 才能穿透到 v-html 注入的 ul/table/code 等子节点。
     非 scoped 下 :deep() 是非法选择器，整条规则会被丢弃，导致列表/表格等无样式。 -->
<style scoped>
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
  background: var(--ai-chat-color-code-bg, #1e1e2e);
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

/* 段落：纵向节奏，首尾不留白 */
.ai-chat-markdown :deep(p) {
  margin: 8px 0;
}
.ai-chat-markdown :deep(p:first-child) {
  margin-top: 0;
}
.ai-chat-markdown :deep(p:last-child) {
  margin-bottom: 0;
}

/* 标题层级：在现有 margin 基础上补字号与字重 */
.ai-chat-markdown :deep(h1) {
  font-size: 1.5em;
  font-weight: 600;
}
.ai-chat-markdown :deep(h2) {
  font-size: 1.3em;
  font-weight: 600;
}
.ai-chat-markdown :deep(h3) {
  font-size: 1.12em;
  font-weight: 600;
}

/* 列表：统一缩进与间距，marker 用弱化色避免抢焦 */
.ai-chat-markdown :deep(ul),
.ai-chat-markdown :deep(ol) {
  margin: 8px 0;
  padding-left: 22px;
}
.ai-chat-markdown :deep(ul) {
  list-style: disc;
}
.ai-chat-markdown :deep(ol) {
  list-style: decimal;
}
.ai-chat-markdown :deep(li) {
  margin: 3px 0;
}
.ai-chat-markdown :deep(li)::marker {
  color: var(--ai-chat-color-text-muted, #71717a);
}
/* 嵌套列表收紧 */
.ai-chat-markdown :deep(li > ul),
.ai-chat-markdown :deep(li > ol) {
  margin: 3px 0 0;
}

/* 引用块：左侧强调边线 + 弱化底色 */
.ai-chat-markdown :deep(blockquote) {
  margin: 10px 0;
  padding: 4px 14px;
  border-left: 3px solid var(--ai-chat-color-border, #2e2e2e);
  background: var(--ai-chat-hover-neutral, rgba(128, 128, 128, 0.08));
  color: var(--ai-chat-color-text-secondary, #a1a1aa);
}
.ai-chat-markdown :deep(blockquote p) {
  margin: 4px 0;
}

/* 表格：边框 + 表头 + 斑马纹；display:block 配合 overflow-x 实现宽表横向滚动 */
/* 中性 rgba 兼容明暗双主题，符合项目 hover 中性色约定 */
.ai-chat-markdown :deep(table) {
  display: block;
  width: 100%;
  border-collapse: collapse;
  margin: 10px 0;
  font-size: 13px;
  overflow-x: auto;
}
.ai-chat-markdown :deep(th),
.ai-chat-markdown :deep(td) {
  border: 1px solid var(--ai-chat-color-border, #2e2e2e);
  padding: 8px 12px;
  text-align: left;
  white-space: normal;
}
.ai-chat-markdown :deep(th) {
  font-weight: 600;
  background: rgba(128, 128, 128, 0.12);
}
.ai-chat-markdown :deep(tr:nth-child(2n) td) {
  background: rgba(128, 128, 128, 0.06);
}

/* 链接：主题强调色，hover 下划线 */
.ai-chat-markdown :deep(a) {
  color: var(--ai-chat-color-accent, #6366f1);
  text-decoration: none;
}
.ai-chat-markdown :deep(a:hover) {
  text-decoration: underline;
}
</style>
