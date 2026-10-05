<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { DEV_SERVER_BASE_URL } from '../../mock/dev-server-url'
import type { ComponentPublicInstance } from 'vue'
import { useChat } from '@toimc/core'
import {
  aiChatI18n,
  Button,
  Conversation,
  ConversationContent,
  ConversationEmpty,
  ConversationScrollBtn,
  Message,
  MessageContent,
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
  ToolCall,
} from '@toimc/vue'
import { createSseAdapter, httpErrorMessage } from '../../mock/sse-adapter'
import CollaborationCard from './CollaborationCard.vue'
import '../../locales' // 副作用：合并 pg 字典

const { t } = aiChatI18n.global

const BASE_URL = DEV_SERVER_BASE_URL
const ORCHESTRATOR_MODEL_ID = 'orchestrator-agent'

type Pattern = 'delegate' | 'parallel' | 'pipeline'

/** 形态指令协议（spec 16 §3.4）：线协议精确字符串，非 UI 文案，不进 i18n 字典 */
const PATTERN_DIRECTIVES: Record<Pattern, string> = {
  delegate: '本次使用委托模式编排任务',
  parallel: '本次使用并行模式编排任务',
  pipeline: '本次使用流水线模式编排任务',
}

/** 发送文本的形态前缀（spec 16 §3.6）：mock 剧本按关键字分发依赖它 */
const PATTERN_PREFIXES: Record<Pattern, string> = {
  delegate: '【委托】',
  parallel: '【并行】',
  pipeline: '【流水线】',
}

/** 预置示例问题（spec 16 §3.6 原文）：面向中文文档的查询载荷，不进 i18n 字典 */
const PRESET_QUESTIONS = [
  'PromptInput 的 Enter 键行为是什么？Shift+Enter 又是什么？',
  '主题定制有哪些方式？CSS 变量覆盖和预设怎么选？',
  '多会话管理的数据存在哪里？怎么持久化？',
] as const

const pattern = ref<Pattern>('delegate')

const patternTabs = computed(() => [
  {
    value: 'delegate' as Pattern,
    label: t('pg.multiAgent.patternDelegate'),
    desc: t('pg.multiAgent.patternDescDelegate'),
  },
  {
    value: 'parallel' as Pattern,
    label: t('pg.multiAgent.patternParallel'),
    desc: t('pg.multiAgent.patternDescParallel'),
  },
  {
    value: 'pipeline' as Pattern,
    label: t('pg.multiAgent.patternPipeline'),
    desc: t('pg.multiAgent.patternDescPipeline'),
  },
])

const currentDesc = computed(
  () =>
    patternTabs.value.find((tab) => tab.value === pattern.value)?.desc ?? '',
)

// dev-server 探活 + orchestrator-agent 可用性（mock/真实编排双轨）
type ServerStatus = 'connecting' | 'online' | 'offline'
const status = ref<ServerStatus>('connecting')
const hasOrchestrator = ref(false)

async function refreshStatus(): Promise<void> {
  status.value = 'connecting'
  try {
    // window.fetch：.vue 文件的 eslint globals 未收录裸 fetch，且 ClientOnly 内必有 window
    const res = await window.fetch(`${BASE_URL}/api/models`)
    if (!res.ok) throw new Error(await httpErrorMessage(res))
    const data = (await res.json()) as { models: { id: string }[] }
    hasOrchestrator.value = data.models.some(
      (m) => m.id === ORCHESTRATOR_MODEL_ID,
    )
    status.value = 'online'
  } catch {
    status.value = 'offline'
  }
}

const statusText = computed(() =>
  status.value === 'online'
    ? t('pg.multiAgent.statusOnline')
    : status.value === 'connecting'
      ? t('pg.multiAgent.statusConnecting')
      : t('pg.multiAgent.statusOffline'),
)

const modeText = computed(() =>
  hasOrchestrator.value
    ? t('pg.multiAgent.modeOrchestrator')
    : t('pg.multiAgent.modeMock'),
)

// 注册表有 orchestrator-agent（MASTRA_MODEL 已配）时显式选它，否则不传 model
// 落 dev-server 默认 mock 模型，由【委托】/【并行】/【流水线】关键字分发剧本
const chat = useChat(
  createSseAdapter({
    baseUrl: BASE_URL,
    getModel: () => (hasOrchestrator.value ? ORCHESTRATOR_MODEL_ID : undefined),
  }),
)

const DIRECTIVE_ID = 'ma-demo-directive'

/** 发送前保证消息最前有且仅有一条当前形态的指令 system 消息（spec 16 §3.4） */
function ensureDirective(): void {
  const content = PATTERN_DIRECTIVES[pattern.value]
  const first = chat.messages[0]
  if (first && first.id === DIRECTIVE_ID) {
    first.content = content
    return
  }
  chat.messages.unshift({
    id: DIRECTIVE_ID,
    role: 'system',
    content,
    createdAt: new Date(),
  })
}

function onSend(payload: { text: string }) {
  const question = payload.text.trim()
  if (!question) return
  ensureDirective()
  void chat.send(`${PATTERN_PREFIXES[pattern.value]}${question}`)
}

const textareaRef = ref<ComponentPublicInstance>()

/** 点击示例问题：只填入输入框，发送动作留给用户 */
function fillPreset(question: string) {
  const el = textareaRef.value?.$el
  if (!(el instanceof HTMLTextAreaElement)) return
  el.value = question
  el.dispatchEvent(new Event('input'))
  el.focus()
}

// 滚动跟随（照 MockServerDemo 模式）
const chatAreaRef = ref<HTMLElement>()
const isAtBottom = ref(true)

function scrollToBottom() {
  nextTick(() => {
    if (chatAreaRef.value) {
      chatAreaRef.value.scrollTop = chatAreaRef.value.scrollHeight
    }
  })
}

function onScroll(e: Event) {
  const el = e.target as HTMLElement
  isAtBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < 50
}

watch(() => chat.messages.length, scrollToBottom)

onMounted(refreshStatus)

// 测试接缝：注入剧本消息以验证 orchestrate → CollaborationCard 渲染分支
defineExpose({ chat })
</script>

<template>
  <div class="ma-demo">
    <header class="ma-demo__header">
      <div class="ma-demo__heading">
        <h3 class="ma-demo__title">{{ t('pg.multiAgent.title') }}</h3>
        <p class="ma-demo__desc">{{ t('pg.multiAgent.description') }}</p>
      </div>
      <div class="ma-demo__status" :data-status="status">
        <span class="ma-demo__status-dot" />
        <span class="ma-demo__status-text">{{ statusText }}</span>
        <span v-if="status === 'online'" class="ma-demo__mode">
          {{ modeText }}
        </span>
        <Button
          v-if="status === 'offline'"
          type="secondary"
          size="small"
          @click="refreshStatus"
        >
          {{ t('pg.multiAgent.retry') }}
        </Button>
      </div>
    </header>

    <div v-if="status === 'offline'" class="ma-demo__offline">
      {{ t('pg.multiAgent.offlineHint') }}
    </div>

    <!-- 形态切换（三选一）+ 当前形态说明 + 预置示例问题 -->
    <div class="ma-demo__controls">
      <div
        class="ma-demo__patterns"
        role="tablist"
        :aria-label="t('pg.multiAgent.patternLabel')"
      >
        <button
          v-for="tab in patternTabs"
          :key="tab.value"
          type="button"
          role="tab"
          class="ma-demo__pattern-btn"
          :class="{ 'is-active': tab.value === pattern }"
          :aria-selected="tab.value === pattern"
          @click="pattern = tab.value"
        >
          {{ tab.label }}
        </button>
      </div>
      <p class="ma-demo__pattern-desc">{{ currentDesc }}</p>
      <div class="ma-demo__presets">
        <span class="ma-demo__presets-label">
          {{ t('pg.multiAgent.presetLabel') }}
        </span>
        <button
          v-for="q in PRESET_QUESTIONS"
          :key="q"
          type="button"
          class="ma-demo__preset"
          :title="q"
          @click="fillPreset(q)"
        >
          {{ q }}
        </button>
      </div>
    </div>

    <div class="ma-demo__body">
      <Conversation>
        <ConversationContent ref="chatAreaRef" @scroll.passive="onScroll">
          <ConversationEmpty
            v-if="chat.messages.length === 0"
            :title="t('pg.multiAgent.title')"
            :description="t('pg.multiAgent.emptyHint')"
          />
          <template v-for="msg in chat.messages" :key="msg.id">
            <!-- 形态指令：独立 system 提示行（协议透明可见） -->
            <div v-if="msg.role === 'system'" class="ma-demo__directive">
              <span class="ma-demo__directive-badge">
                {{ t('pg.multiAgent.directiveBadge') }}
              </span>
              <span class="ma-demo__directive-text">{{ msg.content }}</span>
            </div>
            <Message v-else :from="msg.role">
              <template v-for="tc in msg.toolCalls" :key="tc.id">
                <CollaborationCard
                  v-if="tc.name === 'orchestrate'"
                  :data="tc"
                />
                <ToolCall v-else :data="tc" />
              </template>
              <MessageContent
                :content="msg.role === 'assistant' ? msg.content : undefined"
                :thinking="msg.thinking"
                :streaming="
                  chat.isStreaming &&
                  msg.id === chat.messages[chat.messages.length - 1]?.id
                "
              >
                <template v-if="msg.role !== 'assistant'">{{
                  msg.content
                }}</template>
              </MessageContent>
            </Message>
          </template>
        </ConversationContent>

        <ConversationScrollBtn
          v-if="!isAtBottom && chat.messages.length > 0"
          @click="scrollToBottom"
        />

        <div v-if="chat.error" class="ma-demo__error">
          {{ chat.error.message }}
        </div>

        <div class="ma-demo__input">
          <PromptInput @send="onSend">
            <PromptInputBody>
              <PromptInputTextarea
                ref="textareaRef"
                :placeholder="t('pg.multiAgent.inputPlaceholder')"
              />
            </PromptInputBody>
            <template #footer>
              <PromptInputFooter>
                <template #hint>
                  <PromptInputSubmit :disabled="status !== 'online'" />
                </template>
              </PromptInputFooter>
            </template>
          </PromptInput>
        </div>
      </Conversation>
    </div>
  </div>
</template>

<style scoped>
.ma-demo {
  display: flex;
  flex-direction: column;
  height: 100%;
  border: 1px solid var(--ai-chat-border-color, #e2e8f0);
  border-radius: 12px;
  overflow: hidden;
  background: var(--ai-chat-bg-color, #fff);
}

.ma-demo__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--ai-chat-border-color, #e2e8f0);
}

.ma-demo__title {
  margin: 0 0 4px;
  font-size: 15px;
  font-weight: 600;
}

.ma-demo__desc {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  opacity: 0.7;
  max-width: 560px;
}

.ma-demo__status {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  font-size: 12px;
}

.ma-demo__status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #94a3b8;
}

.ma-demo__status[data-status='online'] .ma-demo__status-dot {
  background: #22c55e;
}

.ma-demo__status[data-status='connecting'] .ma-demo__status-dot {
  background: #eab308;
}

.ma-demo__status[data-status='offline'] .ma-demo__status-dot {
  background: #ef4444;
}

.ma-demo__status :deep(.ai-chat-btn) {
  margin-left: 4px;
}

.ma-demo__mode {
  padding: 1px 8px;
  border-radius: 999px;
  background: rgba(128, 128, 128, 0.15);
  color: var(--ai-chat-color-text-muted, #64748b);
}

.ma-demo__offline {
  padding: 10px 16px;
  font-size: 13px;
  background: rgba(239, 68, 68, 0.08);
  border-bottom: 1px solid rgba(239, 68, 68, 0.2);
}

.ma-demo__controls {
  padding: 12px 16px;
  border-bottom: 1px solid var(--ai-chat-border-color, #e2e8f0);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ma-demo__patterns {
  display: inline-flex;
  gap: 4px;
  padding: 3px;
  border-radius: 10px;
  background: rgba(128, 128, 128, 0.12);
  align-self: flex-start;
}

.ma-demo__pattern-btn {
  border: none;
  background: transparent;
  padding: 5px 14px;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  color: inherit;
  transition: background 0.15s ease;
}

.ma-demo__pattern-btn:hover {
  background: rgba(128, 128, 128, 0.15);
}

.ma-demo__pattern-btn.is-active {
  background: var(--ai-chat-bg-color, #fff);
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}

.ma-demo__pattern-desc {
  margin: 0;
  font-size: 12px;
  color: var(--ai-chat-color-text-muted, #64748b);
  line-height: 1.6;
}

.ma-demo__presets {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.ma-demo__presets-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--ai-chat-color-text-muted, #64748b);
}

.ma-demo__preset {
  border: 1px solid var(--ai-chat-border-color, #e2e8f0);
  background: transparent;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  cursor: pointer;
  color: inherit;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ma-demo__preset:hover {
  background: rgba(128, 128, 128, 0.15);
  border-color: var(--ai-chat-color-accent, #6366f1);
}

.ma-demo__body {
  display: flex;
  flex: 1;
  min-height: 0;
}

.ma-demo__body :deep(.ai-chat-conversation) {
  flex: 1;
  min-height: 0;
}

.ma-demo__directive {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 8px auto;
  padding: 4px 12px;
  width: fit-content;
  max-width: 100%;
  border-radius: 999px;
  background: var(--ai-chat-color-accent-dim, rgba(99, 102, 241, 0.15));
  font-size: 12px;
}

.ma-demo__directive-badge {
  font-weight: 600;
  color: var(--ai-chat-color-accent, #6366f1);
  flex-shrink: 0;
}

.ma-demo__directive-text {
  color: inherit;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ma-demo__error {
  margin: 0 16px 8px;
  padding: 8px 12px;
  font-size: 12px;
  border-radius: 8px;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.25);
}

.ma-demo__input {
  padding: 8px 12px 12px;
}

@media (max-width: 640px) {
  .ma-demo__header {
    flex-direction: column;
  }
}
</style>
