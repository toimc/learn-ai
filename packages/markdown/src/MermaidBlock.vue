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

async function render() {
  status.value = 'loading'
  try {
    const mermaid = (await import('mermaid')).default
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' })
    const id = `mmd-${Math.random().toString(36).slice(2)}`
    const { svg: out } = await mermaid.render(id, props.code)
    svg.value = out
    status.value = 'done'
  } catch (e) {
    errorText.value = e instanceof Error ? e.message : String(e)
    status.value = 'error'
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
      sandbox="allow-same-origin"
      :srcdoc="srcdoc"
    />
  </div>
</template>

<style>
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
  background: var(--ai-chat-code-bg, #f6f8fa);
  border-radius: 8px;
}
</style>
