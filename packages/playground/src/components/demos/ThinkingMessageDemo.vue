<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import type { ThinkingInfo } from '@toimc/core'
import { Message, MessageContent, aiChatI18n } from '@toimc/vue'
import '../../locales' // 副作用：合并 pg 字典

const { t } = aiChatI18n.global

// 交互演示：点击按钮播放完整流式思考过程
// thinking chunks 逐块追加 → 正文逐块输出 → done 时自动计算耗时并折叠
const phase = ref<'idle' | 'thinking' | 'answering' | 'done'>('idle')
const thinkingContent = ref('')
const answerContent = ref('')
const duration = ref(0)

let startTime = 0
let timer: ReturnType<typeof setTimeout> | undefined

const isBusy = computed(
  () => phase.value === 'thinking' || phase.value === 'answering',
)

// 模板内对象字面量不会解包 ref（只有顶层 ref 才解包），必须在这里组装好
const thinkingInfo = computed<ThinkingInfo | undefined>(() =>
  thinkingContent.value
    ? { content: thinkingContent.value, duration: duration.value }
    : undefined,
)

const thinkingSteps = [
  '用户问的是设计动机，需要对比 Vue 2 的局限性。',
  '\nVue 2 用 Object.defineProperty 劫持读写：',
  '\n- 无法监听属性新增/删除（需要 $set/$delete 补丁）',
  '\n- 数组下标与 length 变更不触发更新',
  '\n- 初始化时递归遍历整个对象，大型状态开销高。',
  '\n\nProxy 在语言层面拦截十三种操作，天然覆盖上述缺口，且惰性代理深层对象。',
]

const answerSteps = [
  '核心动机是**补齐劫持能力的缺口**。\n\n',
  'Vue 2 的 `Object.defineProperty` 无法感知属性增删和数组下标变更，只能靠 `$set`/`$delete` 打补丁；\n\n',
  '`Proxy` 在语言层面拦截全部读写操作，深层对象**惰性代理**，初始化开销也更低。',
]

function sleep(ms: number) {
  return new Promise((r) => {
    timer = setTimeout(r, ms)
  })
}

async function simulate() {
  if (isBusy.value) return
  phase.value = 'thinking'
  thinkingContent.value = ''
  answerContent.value = ''
  duration.value = 0
  startTime = Date.now()

  for (const step of thinkingSteps) {
    thinkingContent.value += step
    await sleep(320)
  }

  phase.value = 'answering'
  for (const step of answerSteps) {
    answerContent.value += step
    await sleep(300)
  }

  duration.value = Date.now() - startTime
  phase.value = 'done'
}

onUnmounted(() => clearTimeout(timer))
</script>

<template>
  <div class="thinking-demo">
    <div class="thinking-demo__toolbar">
      <button class="thinking-demo__btn" :disabled="isBusy" @click="simulate">
        {{
          phase === 'done'
            ? t('pg.thinkingDemo.replay')
            : t('pg.thinkingDemo.simulate')
        }}
      </button>
      <span v-if="isBusy" class="thinking-demo__hint">
        {{
          phase === 'thinking'
            ? 'thinking chunk 流式追加中…'
            : '正文 text chunk 输出中…'
        }}
      </span>
      <span v-else-if="phase === 'done'" class="thinking-demo__hint">
        done chunk 已计算耗时并自动折叠
      </span>
    </div>

    <Message from="user">
      <MessageContent>{{ t('pg.thinkingDemo.userQuestion') }}</MessageContent>
    </Message>

    <Message from="assistant">
      <MessageContent
        :content="answerContent"
        :thinking="thinkingInfo"
        :streaming="isBusy"
      />
    </Message>
  </div>
</template>

<style scoped>
.thinking-demo__toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.thinking-demo__btn {
  padding: 6px 14px;
  border: 1px solid var(--vp-c-brand-1);
  border-radius: 8px;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
}

.thinking-demo__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.thinking-demo__hint {
  font-size: 12.5px;
  color: var(--vp-c-text-3);
}
</style>
