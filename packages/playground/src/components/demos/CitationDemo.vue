<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import type { MessageSource, ThinkingStep } from '@toimc/core'
import {
  Message,
  MessageContent,
  ThinkingChain,
  InlineCitation,
  Sources,
  ToolConfirmation,
  aiChatI18n,
} from '@toimc/vue'
import '../../locales' // 副作用：合并 pg 字典

const { t } = aiChatI18n.global

// ---------- mock 数据（自包含） ----------
// RAG 场景：回答末尾挂 Sources（折叠列表模式），正文结论句后放 InlineCitation
const ragSources: MessageSource[] = [
  {
    id: 'src_docs',
    type: 'document',
    title: '内部知识库 · citations 接入笔记',
    snippet:
      '正文角标与来源列表共用 MessageSource 协议：正文放 InlineCitation，末尾挂 Sources。',
  },
  {
    id: 'src_vue',
    type: 'url',
    title: 'Vue 3 指南 · 插槽',
    url: 'https://cn.vuejs.org/guide/components/slots.html',
    snippet: '作用域插槽把子组件内部数据交回宿主渲染。',
  },
  {
    id: 'src_mdn',
    type: 'url',
    title: 'MDN · Proxy',
    url: 'https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Proxy',
    snippet: 'Proxy 用于创建一个对象的代理，拦截读取、设置等基本操作。',
  },
]

// ---------- ThinkingChain：模拟 RAG 检索链路（active/complete/error 各态） ----------
const steps = ref<ThinkingStep[]>([])
const chainStreaming = ref(false)
const showAnswer = ref(false)
let timers: ReturnType<typeof setTimeout>[] = []

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    timers.push(setTimeout(resolve, ms))
  })
}

function resetSteps() {
  steps.value = [
    { id: 's1', title: t('pg.citationDemo.stepParse'), status: 'pending' },
    { id: 's2', title: t('pg.citationDemo.stepVector'), status: 'pending' },
    { id: 's3', title: t('pg.citationDemo.stepRerank'), status: 'pending' },
    { id: 's4', title: t('pg.citationDemo.stepFallback'), status: 'pending' },
  ]
}

function setStep(id: string, patch: Partial<ThinkingStep>) {
  const step = steps.value.find((s) => s.id === id)
  if (step) Object.assign(step, patch)
}

const isRunning = computed(() => chainStreaming.value)

async function simulate() {
  if (isRunning.value) return
  resetSteps()
  showAnswer.value = false
  chainStreaming.value = true

  setStep('s1', { status: 'active' })
  await sleep(900)
  setStep('s1', { status: 'complete', duration: 900 })

  setStep('s2', { status: 'active' })
  await sleep(1100)
  setStep('s2', {
    status: 'complete',
    duration: 1100,
    content: 'bge-m3 命中 12 块 · top1 score 0.87',
  })

  setStep('s3', { status: 'active' })
  await sleep(700)
  setStep('s3', {
    status: 'error',
    duration: 700,
    content: 'rerank 服务超时（exit 504）',
  })

  setStep('s4', { status: 'active' })
  await sleep(1000)
  setStep('s4', {
    status: 'complete',
    duration: 1000,
    content: 'RRF 融合双路结果，取 top3 组装 sources',
  })

  chainStreaming.value = false
  showAnswer.value = true
}

onUnmounted(() => {
  timers.forEach(clearTimeout)
  timers = []
})

// ---------- ToolConfirmation：工具审批状态流转 ----------
type ApprovalStatus = 'awaiting-approval' | 'denied'
const approvalStatus = ref<ApprovalStatus>('awaiting-approval')
const approvalResult = ref<'approved' | 'rejected' | null>(null)

function onApprove() {
  // 演示：真实场景宿主把审批结果回传后端，成功后工具状态推进为 calling
  approvalResult.value = 'approved'
}

function onReject() {
  approvalStatus.value = 'denied'
  approvalResult.value = 'rejected'
}

function resetApproval() {
  approvalStatus.value = 'awaiting-approval'
  approvalResult.value = null
}
</script>

<template>
  <div class="citation-demo">
    <div class="citation-demo__toolbar">
      <button
        class="citation-demo__btn"
        :disabled="isRunning"
        @click="simulate"
      >
        {{
          showAnswer
            ? t('pg.citationDemo.replay')
            : t('pg.citationDemo.simulate')
        }}
      </button>
      <span class="citation-demo__hint">
        {{
          isRunning
            ? t('pg.citationDemo.hintRunning')
            : showAnswer
              ? t('pg.citationDemo.hintDone')
              : t('pg.citationDemo.hintIdle')
        }}
      </span>
    </div>

    <Message from="user">
      <MessageContent :content="t('pg.citationDemo.userQuestion')" />
    </Message>

    <Message from="assistant">
      <!-- 检索链路：4 步骤覆盖 active / complete / error 各态，流式结束自动折叠 -->
      <ThinkingChain
        v-if="steps.length"
        :steps="steps"
        :streaming="chainStreaming"
      />

      <!-- 正文：结论句后放 InlineCitation（[1] 单来源 / [2] 多来源轮播），hover 角标看悬浮卡 -->
      <MessageContent v-if="showAnswer">
        <p>
          两件组件共用
          <code>MessageSource</code>
          协议，各管一头：正文结论句后挂<InlineCitation
            :index="1"
            :sources="[ragSources[0]]"
          />，回答末尾的<InlineCitation
            :index="2"
            :sources="[ragSources[1], ragSources[2]]"
            :card-width="320"
          />负责把来源汇总成可折叠列表，鼠标悬浮角标即可预览引用片段。
        </p>
        <p>
          多来源角标会在悬浮卡内出现 prev / next 轮播与「当前 /
          总数」计数；来源是
          <code>url</code> 型时标题渲染为外链（经 http(s) 白名单校验），
          <code>document</code> 型渲染为纯文本卡片。
        </p>
      </MessageContent>

      <!-- 来源列表：折叠列表模式（default-open 便于直观看效果，可点击标题折叠） -->
      <Sources
        v-if="showAnswer"
        :sources="ragSources"
        default-open
        @select="() => {}"
      />
    </Message>

    <!-- 工具审批：awaiting-approval 态，approve / reject 有状态流转 -->
    <section class="citation-demo__section">
      <h3 class="citation-demo__section-title">
        {{ t('pg.citationDemo.toolTitle') }}
      </h3>
      <p class="citation-demo__section-desc">
        {{ t('pg.citationDemo.toolDesc') }}
      </p>

      <ToolConfirmation
        v-if="approvalResult !== 'approved'"
        tool-name="kb_write"
        :arguments="{ doc: 'rag-integration.md', overwrite: true }"
        :reason="t('pg.citationDemo.toolReason')"
        :status="approvalStatus"
        @approve="onApprove"
        @reject="onReject"
      />
      <p
        v-else
        class="citation-demo__approval-result citation-demo__approval-result--ok"
      >
        {{ t('pg.citationDemo.approved') }}
      </p>

      <p
        v-if="approvalResult"
        class="citation-demo__approval-result"
        :class="
          approvalResult === 'rejected'
            ? 'citation-demo__approval-result--warn'
            : ''
        "
      >
        {{
          approvalResult === 'approved'
            ? t('pg.citationDemo.approvedHint')
            : t('pg.citationDemo.rejectedHint')
        }}
      </p>
      <button
        v-if="approvalResult"
        class="citation-demo__btn citation-demo__btn--ghost"
        @click="resetApproval"
      >
        {{ t('pg.citationDemo.resetApproval') }}
      </button>
    </section>
  </div>
</template>

<style scoped>
.citation-demo {
  max-width: 960px;
  margin: 0 auto;
  padding: 20px 20px 48px;
}

.citation-demo__toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.citation-demo__btn {
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

.citation-demo__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.citation-demo__btn--ghost {
  border-color: var(--vp-c-border);
  background: transparent;
  color: var(--vp-c-text-2);
}

.citation-demo__hint {
  font-size: 12.5px;
  color: var(--vp-c-text-3);
}

.citation-demo__section {
  margin-top: 28px;
  padding-top: 4px;
}

.citation-demo__section-title {
  margin: 0 0 4px;
  font-size: 15px;
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.citation-demo__section-desc {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--vp-c-text-3);
}

.citation-demo__approval-result {
  margin: 10px 0 0;
  font-size: 13px;
  color: var(--vp-c-text-2);
}

.citation-demo__approval-result--ok {
  color: var(--vp-c-green-1, #16a34a);
}

.citation-demo__approval-result--warn {
  color: var(--vp-c-yellow-1, #ca8a04);
}
</style>
