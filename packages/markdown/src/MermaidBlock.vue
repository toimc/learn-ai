<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

const props = defineProps<{ code: string }>()

const status = ref<'loading' | 'done' | 'error'>('loading')
const svg = ref<string>('')
const errorText = ref<string>('')

// FR-4.5：沙箱 iframe 渲染官方安全建议；srcdoc 用 computed 拼接，避免模板内反引号转义被编译器误解析
const srcdoc = computed(
  () =>
    `<!doctype html><body style="margin:0;display:flex;justify-content:center">${svg.value}</body>`,
)

// mermaid 单例懒加载：去重动态 import + 只 initialize 一次（全实例共享，避免 mermaid 重复 init 警告）
let mermaidPromise: Promise<(typeof import('mermaid'))['default']> | null = null
function loadMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((m) => {
      m.default.initialize({ startOnLoad: false, securityLevel: 'strict' })
      return m.default
    })
  }
  return mermaidPromise
}

// 竞态守卫：仅最后一次 run 的结果可写入，避免更慢的旧渲染覆盖最新结果（与 CodeBlock 一致）
let runId = 0
// 实例内 id 计数：替代 Math.random，廉价且全实例无碰撞
let mmdSeq = 0

async function render() {
  const myId = ++runId
  status.value = 'loading'
  try {
    const mermaid = await loadMermaid()
    const id = `mmd-${++mmdSeq}`
    const { svg: out } = await mermaid.render(id, props.code)
    if (myId === runId) {
      svg.value = out
      status.value = 'done'
    }
  } catch (e) {
    if (myId === runId) {
      errorText.value = e instanceof Error ? e.message : String(e)
      status.value = 'error'
    }
  }
}

onMounted(render)
watch(() => props.code, render)
</script>

<template>
  <div class="ai-chat-mermaid">
    <div v-if="status === 'loading'" class="ai-chat-mermaid__loading">
      图表渲染中…
    </div>
    <div v-else-if="status === 'error'" class="ai-chat-mermaid__error">
      图表渲染失败：{{ errorText }}
      <pre>{{ code }}</pre>
    </div>
    <iframe
      v-else
      class="ai-chat-mermaid__frame"
      sandbox="allow-scripts"
      :srcdoc="srcdoc"
    />
  </div>
</template>

<style>
@layer ai-chat-components {
  .ai-chat-mermaid {
    margin: 12px 0;
    text-align: center;
  }
  .ai-chat-mermaid__frame {
    width: 100%;
    min-height: 120px;
    border: none;
  }
  .ai-chat-mermaid__loading,
  .ai-chat-mermaid__error {
    padding: 16px;
    color: var(--ai-chat-color-text-secondary, #9ca3af);
    background: var(--ai-chat-color-code-bg, #f6f8fa);
    border-radius: 8px;
  }
}
</style>
