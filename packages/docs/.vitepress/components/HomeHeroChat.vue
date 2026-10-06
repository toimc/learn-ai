<script setup lang="ts">
/**
 * 首页 hero 右侧的「活演示」：用 @toimc/vue 真组件自动播放一段对话循环，
 * 依次展示思考链 → 工具调用 → 流式回答 → RAG 引用来源，全部 dogfooding，
 * 不依赖任何后端（时间线驱动，纯客户端脚本）。
 */
import { onMounted, onUnmounted, ref } from 'vue'
import type { ThinkingStep, ToolCallInfo, MessageSource } from '@toimc/core'
import {
  Conversation,
  ConversationContent,
  Message,
  MessageContent,
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
  ThinkingChain,
  Sources,
} from '@toimc/vue'

const QUESTION = '为什么选 @toimc/vue，而不是 React 生态的聊天组件？'
const ANSWER = `**Vue 3 原生**的 62 个对话组件：思考链、工具调用、RAG 引用、生成式 UI 开箱即用。

实现一个 **ChatAdapter**，OpenAI / Anthropic / GLM / 自建网关随意切换。`

const DEMO_SOURCES: MessageSource[] = [
  {
    id: 'src-docs',
    type: 'document',
    title: '组件总览 · 62 个组件 / 12 个能力域',
    snippet: '对话容器、消息渲染、思考链、工具调用、引用溯源……',
  },
  {
    id: 'src-guide',
    type: 'url',
    title: '快速开始 · ChatAdapter 接入指南',
    url: 'https://github.com/ai-chat-ui/ai-chat-ui',
  },
]

const showUser = ref(false)
const showAssistant = ref(false)
const chainStreaming = ref(true)
const answerText = ref('')
const isStreaming = ref(false)
const showSources = ref(false)
const fading = ref(false)

const steps = ref<ThinkingStep[]>([
  { id: 's1', title: '理解问题', status: 'pending' },
  { id: 's2', title: '检索组件文档', status: 'pending' },
  { id: 's3', title: '组织对比结论', status: 'pending' },
])

const toolCalls = ref<ToolCallInfo[]>([])

function step(id: string): ThinkingStep | undefined {
  return steps.value.find((s) => s.id === id)
}

function setStep(id: string, patch: Partial<ThinkingStep>) {
  const s = step(id)
  if (s) Object.assign(s, patch)
}

let timers: ReturnType<typeof setTimeout>[] = []
let typer: ReturnType<typeof setInterval> | null = null
let generation = 0

function at(delay: number, fn: () => void) {
  timers.push(setTimeout(fn, delay))
}

function clearAll() {
  timers.forEach(clearTimeout)
  timers = []
  if (typer) {
    clearInterval(typer)
    typer = null
  }
}

function resetState() {
  showUser.value = false
  showAssistant.value = false
  chainStreaming.value = true
  answerText.value = ''
  isStreaming.value = false
  showSources.value = false
  steps.value.forEach((s) => {
    s.status = 'pending'
    s.duration = undefined
  })
  toolCalls.value = []
}

/** 直接呈现终态（reduced-motion 用户不走动画） */
function renderFinalState() {
  showUser.value = true
  showAssistant.value = true
  chainStreaming.value = false
  isStreaming.value = false
  setStep('s1', { status: 'complete', duration: 480 })
  setStep('s2', { status: 'complete', duration: 1650 })
  setStep('s3', { status: 'complete', duration: 600 })
  toolCalls.value = [
    {
      id: 'tc-demo',
      name: 'search_docs',
      arguments: { query: '为什么选 @toimc/vue', topK: 3 },
      status: 'completed',
      duration: 740,
      result: { hits: 3, top: ['conversation', 'tool-call', 'citation'] },
    },
  ]
  answerText.value = ANSWER
  showSources.value = true
}

function startLoop() {
  const gen = generation
  const isAlive = () => gen === generation
  const alive = (fn: () => void) => () => {
    if (isAlive()) fn()
  }

  at(
    300,
    alive(() => (showUser.value = true)),
  )
  at(
    1100,
    alive(() => {
      showAssistant.value = true
      isStreaming.value = true
      setStep('s1', { status: 'active' })
    }),
  )
  at(
    1750,
    alive(() => {
      setStep('s1', { status: 'complete', duration: 480 })
      setStep('s2', { status: 'active' })
    }),
  )
  at(
    2350,
    alive(() => {
      toolCalls.value = [
        {
          id: 'tc-demo',
          name: 'search_docs',
          arguments: { query: '为什么选 @toimc/vue', topK: 3 },
          status: 'calling',
        },
      ]
    }),
  )
  at(
    3100,
    alive(() => {
      toolCalls.value = [
        {
          ...(toolCalls.value[0] as ToolCallInfo),
          status: 'completed',
          duration: 740,
          result: { hits: 3, top: ['conversation', 'tool-call', 'citation'] },
        },
      ]
    }),
  )
  at(
    3400,
    alive(() => {
      setStep('s2', { status: 'complete', duration: 1650 })
      setStep('s3', { status: 'active' })
    }),
  )
  at(
    4000,
    alive(() => setStep('s3', { status: 'complete', duration: 600 })),
  )
  at(
    4200,
    alive(() => (chainStreaming.value = false)),
  )

  // 打字机式流式回答
  at(
    4600,
    alive(() => {
      let i = 0
      typer = setInterval(() => {
        if (!isAlive()) {
          if (typer) clearInterval(typer)
          return
        }
        i = Math.min(ANSWER.length, i + 2)
        answerText.value = ANSWER.slice(0, i)
        if (i >= ANSWER.length) {
          if (typer) clearInterval(typer)
          typer = null
          at(
            400,
            alive(() => {
              isStreaming.value = false
              showSources.value = true
            }),
          )
          at(
            3600,
            alive(() => (fading.value = true)),
          )
          at(
            4400,
            alive(() => {
              fading.value = false
              resetState()
              // generation 递增使本轮闭包全部失效；重启不设存活检查——
              // 卸载时 clearAll 已清掉这里的重启定时器，无需再判
              generation++
              at(500, () => startLoop())
            }),
          )
        }
      }, 42)
    }),
  )
}

onMounted(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduced) {
    renderFinalState()
    return
  }
  startLoop()
})

onUnmounted(() => {
  generation++
  clearAll()
})
</script>

<template>
  <div class="hero-chat" :class="{ 'is-fading': fading }">
    <div class="hero-chat__glow" aria-hidden="true" />

    <div class="hero-chat__card">
      <div class="hero-chat__chrome">
        <span class="hero-chat__dot hero-chat__dot--r" />
        <span class="hero-chat__dot hero-chat__dot--y" />
        <span class="hero-chat__dot hero-chat__dot--g" />
        <span class="hero-chat__url">app.local/chat</span>
        <span class="hero-chat__live">
          <span class="hero-chat__live-dot" />SSE 循环演示
        </span>
      </div>

      <div class="hero-chat__body">
        <Conversation>
          <ConversationContent>
            <Message v-if="showUser" from="user">
              <MessageContent :content="QUESTION" />
            </Message>

            <Message v-if="showAssistant" from="assistant">
              <ThinkingChain
                :steps="steps"
                :streaming="chainStreaming"
                title="思考中"
              />
              <MessageContent
                :content="answerText"
                :tool-calls="toolCalls"
                :streaming="isStreaming"
              />
              <Sources v-if="showSources" :sources="DEMO_SOURCES" inline />
            </Message>
          </ConversationContent>

          <PromptInput placeholder="问点什么…（Enter 发送）">
            <PromptInputBody>
              <PromptInputTextarea />
            </PromptInputBody>
            <PromptInputFooter>
              <PromptInputSubmit />
            </PromptInputFooter>
          </PromptInput>
        </Conversation>
      </div>
    </div>

    <span class="hero-chat__chip hero-chat__chip--stream"
      >⚡ AsyncGenerator 流式</span
    >
    <span class="hero-chat__chip hero-chat__chip--adapter"
      >🔌 ChatAdapter · 任意后端</span
    >
    <span class="hero-chat__chip hero-chat__chip--tests"
      >🧪 1600+ 测试用例</span
    >
  </div>
</template>

<style scoped>
.hero-chat {
  position: relative;
  width: min(100%, 460px);
  margin: 0 auto;
  transition: opacity 0.55s ease;
}

.hero-chat.is-fading {
  opacity: 0;
}

.hero-chat__glow {
  position: absolute;
  inset: -8% -6%;
  background:
    radial-gradient(
      52% 48% at 78% 18%,
      rgba(37, 99, 235, 0.22),
      transparent 68%
    ),
    radial-gradient(
      46% 52% at 12% 88%,
      rgba(14, 165, 233, 0.16),
      transparent 66%
    );
  filter: blur(6px);
  z-index: 0;
  pointer-events: none;
}

.hero-chat__card {
  position: relative;
  z-index: 1;
  border-radius: 14px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  box-shadow:
    0 1px 2px rgba(15, 23, 42, 0.06),
    0 18px 44px -14px rgba(15, 23, 42, 0.22);
  overflow: hidden;
}

.hero-chat__chrome {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 9px 12px;
  border-bottom: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
}

.hero-chat__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.hero-chat__dot--r {
  background: #f87171;
}
.hero-chat__dot--y {
  background: #fbbf24;
}
.hero-chat__dot--g {
  background: #34d399;
}

.hero-chat__url {
  margin-left: 8px;
  font-family: var(--vp-font-family-mono, ui-monospace, monospace);
  font-size: 11px;
  color: var(--vp-c-text-2);
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  padding: 2px 10px;
}

.hero-chat__live {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 10.5px;
  letter-spacing: 0.04em;
  color: var(--vp-c-brand-1);
  font-weight: 600;
}

.hero-chat__live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--vp-c-brand-1);
  animation: hero-live-pulse 1.6s ease-in-out infinite;
}

@keyframes hero-live-pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.35;
    transform: scale(0.8);
  }
}

.hero-chat__body {
  padding: 10px 10px 12px;
}

/* 演示区固定高度：内容整体贴底，模拟真实聊天窗口 */
.hero-chat__body :deep(.ai-chat-conversation) {
  height: 340px;
}

.hero-chat__chip {
  position: absolute;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  padding: 5px 11px;
  border-radius: 999px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  box-shadow: 0 6px 18px -8px rgba(15, 23, 42, 0.25);
  color: var(--vp-c-text-1);
  animation: hero-chip-float 5s ease-in-out infinite;
}

.hero-chat__chip--stream {
  top: -15px;
  right: -14px;
  animation-delay: 0.4s;
}

.hero-chat__chip--adapter {
  left: -26px;
  top: 56%;
  animation-delay: 1.6s;
}

.hero-chat__chip--tests {
  bottom: -14px;
  right: 8%;
  animation-delay: 2.8s;
}

@keyframes hero-chip-float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-6px);
  }
}

@media (max-width: 1279px) {
  .hero-chat__chip--adapter {
    display: none;
  }
  .hero-chat__chip--stream {
    top: -12px;
    right: 4px;
  }
}

@media (max-width: 959px) {
  .hero-chat {
    width: min(100%, 480px);
    margin-top: 20px;
    /* 底部浮动 chip 向下探出 14px，给下方内容留呼吸空间 */
    margin-bottom: 22px;
  }
  .hero-chat__body :deep(.ai-chat-conversation) {
    height: 320px;
  }
}

@media (max-width: 519px) {
  /* 超窄屏收回氛围光左右出血，避免撑出横向滚动 */
  .hero-chat__glow {
    inset: -8% 0;
  }
  .hero-chat__chip--tests {
    bottom: -12px;
    right: 4px;
  }
  .hero-chat__chip--stream {
    top: -12px;
    right: 4px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero-chat__chip,
  .hero-chat__live-dot {
    animation: none;
  }
}
</style>
