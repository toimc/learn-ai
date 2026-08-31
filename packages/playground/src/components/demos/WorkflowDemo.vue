<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { DEV_SERVER_BASE_URL } from '../../mock/dev-server-url'
import { useChat } from '@toimc/core'
import type { SendMessageOptions, StreamChunk } from '@toimc/core'
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
import { createSseAdapter } from '../../mock/sse-adapter'
import {
  createWorkflowSseAdapter,
  fetchWorkflows,
  type WorkflowSummary,
} from '../../mock/workflow-adapter'
import '../../locales' // 副作用：合并 pg 字典

const { t } = aiChatI18n.global

const BASE_URL = DEV_SERVER_BASE_URL

type Pattern = 'pipeline' | 'council' | 'supervisor'

/** 与 dev-server workflows 注册表一一对应（docs-pipeline/council/supervisor-workflow） */
const WORKFLOW_IDS: Record<Pattern, string> = {
  pipeline: 'docs-pipeline-workflow',
  council: 'docs-council-workflow',
  supervisor: 'docs-supervisor-workflow',
}

/** mock 轨的剧本关键字前缀（线协议精确字符串，非 UI 文案，不进 i18n 字典） */
const MOCK_PREFIXES: Record<Pattern, string> = {
  pipeline: '【流水线】',
  council: '【并行】',
  supervisor: '【委托】',
}

const pattern = ref<Pattern>('pipeline')

const patternTabs = computed(() => [
  {
    value: 'pipeline' as Pattern,
    label: t('pg.workflow.patternPipeline'),
    desc: t('pg.workflow.patternDescPipeline'),
  },
  {
    value: 'council' as Pattern,
    label: t('pg.workflow.patternCouncil'),
    desc: t('pg.workflow.patternDescCouncil'),
  },
  {
    value: 'supervisor' as Pattern,
    label: t('pg.workflow.patternSupervisor'),
    desc: t('pg.workflow.patternDescSupervisor'),
  },
])

// dev-server 探活 + 原生 Workflow 可用性（真实/mock 双轨）
type ServerStatus = 'connecting' | 'online' | 'offline'
const status = ref<ServerStatus>('connecting')
const workflows = ref<WorkflowSummary[]>([])

/** 真实轨 = 服务在线且注册表非空（MASTRA_MODEL 已配）；空列表/离线走 mock 近似剧本 */
const isRealTrack = computed(
  () => status.value === 'online' && workflows.value.length > 0,
)

async function refreshStatus(): Promise<void> {
  status.value = 'connecting'
  try {
    workflows.value = await fetchWorkflows(BASE_URL)
    status.value = 'online'
  } catch {
    workflows.value = []
    status.value = 'offline'
  }
}

const statusText = computed(() =>
  status.value === 'online'
    ? t('pg.workflow.statusOnline')
    : status.value === 'connecting'
      ? t('pg.workflow.statusConnecting')
      : t('pg.workflow.statusOffline'),
)

const modeText = computed(() =>
  isRealTrack.value ? t('pg.workflow.modeReal') : t('pg.workflow.modeMock'),
)

const currentDesc = computed(() => {
  // 真实轨优先展示服务端注册表里的 description，查不到回退 i18n 说明
  if (isRealTrack.value) {
    const serverDesc = workflows.value.find(
      (w) => w.id === WORKFLOW_IDS[pattern.value],
    )?.description
    if (serverDesc) return serverDesc
  }
  return (
    patternTabs.value.find((tab) => tab.value === pattern.value)?.desc ?? ''
  )
})

// 双轨适配器：useChat 的 adapter 固定于创建时，用闭包按当前轨道分发
const workflowAdapter = createWorkflowSseAdapter({
  baseUrl: BASE_URL,
  getWorkflowId: () => WORKFLOW_IDS[pattern.value],
})
const mockAdapter = createSseAdapter({ baseUrl: BASE_URL })

const chat = useChat({
  async *sendMessage(opts: SendMessageOptions): AsyncGenerator<StreamChunk> {
    if (isRealTrack.value) yield* workflowAdapter.sendMessage(opts)
    else yield* mockAdapter.sendMessage(opts)
  },
})

// 真实轨：输入即 task（适配器取最后一条 user 消息）；
// mock 轨：按选中 workflow 拼剧本关键字前缀，落 /api/chat 的近似剧本
function onSend(payload: { text: string }) {
  const task = payload.text.trim()
  if (!task) return
  void chat.send(
    isRealTrack.value ? task : `${MOCK_PREFIXES[pattern.value]}${task}`,
  )
}

// 滚动跟随（照 MultiAgentDemo 模式）
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

// 测试接缝：注入消息以验证 toolCalls → ToolCall 渲染分支
defineExpose({ chat })
</script>

<template>
  <div class="wf-demo">
    <header class="wf-demo__header">
      <div class="wf-demo__heading">
        <h3 class="wf-demo__title">{{ t('pg.workflow.title') }}</h3>
        <p class="wf-demo__desc">{{ t('pg.workflow.description') }}</p>
      </div>
      <div class="wf-demo__status" :data-status="status">
        <span class="wf-demo__status-dot" />
        <span class="wf-demo__status-text">{{ statusText }}</span>
        <span v-if="status === 'online'" class="wf-demo__mode">
          {{ modeText }}
        </span>
        <Button
          v-if="status === 'offline'"
          type="secondary"
          size="small"
          @click="refreshStatus"
        >
          {{ t('pg.workflow.retry') }}
        </Button>
      </div>
    </header>

    <div v-if="status === 'offline'" class="wf-demo__offline">
      {{ t('pg.workflow.offlineHint') }}
    </div>

    <!-- workflow 三选一 + 当前说明（mock 轨附近似剧本提示） -->
    <div class="wf-demo__controls">
      <div
        class="wf-demo__patterns"
        role="tablist"
        :aria-label="t('pg.workflow.patternLabel')"
      >
        <button
          v-for="tab in patternTabs"
          :key="tab.value"
          type="button"
          role="tab"
          class="wf-demo__pattern-btn"
          :class="{ 'is-active': tab.value === pattern }"
          :aria-selected="tab.value === pattern"
          @click="pattern = tab.value"
        >
          {{ tab.label }}
        </button>
      </div>
      <p class="wf-demo__pattern-desc">{{ currentDesc }}</p>
      <p v-if="status === 'online' && !isRealTrack" class="wf-demo__mock-note">
        {{ t('pg.workflow.mockNote') }}
      </p>
    </div>

    <div class="wf-demo__body">
      <Conversation>
        <ConversationContent ref="chatAreaRef" @scroll.passive="onScroll">
          <ConversationEmpty
            v-if="chat.messages.length === 0"
            :title="t('pg.workflow.title')"
            :description="t('pg.workflow.emptyHint')"
          />
          <template v-for="msg in chat.messages" :key="msg.id">
            <Message :from="msg.role">
              <!-- workflow step = tool_call/tool_result 帧（toolName 即 stepId） -->
              <ToolCall v-for="tc in msg.toolCalls" :key="tc.id" :data="tc" />
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

        <div v-if="chat.error" class="wf-demo__error">
          {{ chat.error.message }}
        </div>

        <div class="wf-demo__input">
          <PromptInput @send="onSend">
            <PromptInputBody>
              <PromptInputTextarea
                :placeholder="t('pg.workflow.inputPlaceholder')"
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
.wf-demo {
  display: flex;
  flex-direction: column;
  height: 100%;
  border: 1px solid var(--ai-chat-border-color, #e2e8f0);
  border-radius: 12px;
  overflow: hidden;
  background: var(--ai-chat-bg-color, #fff);
}

.wf-demo__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--ai-chat-border-color, #e2e8f0);
}

.wf-demo__title {
  margin: 0 0 4px;
  font-size: 15px;
  font-weight: 600;
}

.wf-demo__desc {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  opacity: 0.7;
  max-width: 560px;
}

.wf-demo__status {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  font-size: 12px;
}

.wf-demo__status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #94a3b8;
}

.wf-demo__status[data-status='online'] .wf-demo__status-dot {
  background: #22c55e;
}

.wf-demo__status[data-status='connecting'] .wf-demo__status-dot {
  background: #eab308;
}

.wf-demo__status[data-status='offline'] .wf-demo__status-dot {
  background: #ef4444;
}

.wf-demo__status :deep(.ai-chat-btn) {
  margin-left: 4px;
}

.wf-demo__mode {
  padding: 1px 8px;
  border-radius: 999px;
  background: rgba(128, 128, 128, 0.15);
  color: var(--ai-chat-color-text-muted, #64748b);
}

.wf-demo__offline {
  padding: 10px 16px;
  font-size: 13px;
  background: rgba(239, 68, 68, 0.08);
  border-bottom: 1px solid rgba(239, 68, 68, 0.2);
}

.wf-demo__controls {
  padding: 12px 16px;
  border-bottom: 1px solid var(--ai-chat-border-color, #e2e8f0);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.wf-demo__patterns {
  display: inline-flex;
  gap: 4px;
  padding: 3px;
  border-radius: 10px;
  background: rgba(128, 128, 128, 0.12);
  align-self: flex-start;
}

.wf-demo__pattern-btn {
  border: none;
  background: transparent;
  padding: 5px 14px;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  color: inherit;
  transition: background 0.15s ease;
}

.wf-demo__pattern-btn:hover {
  background: rgba(128, 128, 128, 0.15);
}

.wf-demo__pattern-btn.is-active {
  background: var(--ai-chat-bg-color, #fff);
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}

.wf-demo__pattern-desc {
  margin: 0;
  font-size: 12px;
  color: var(--ai-chat-color-text-muted, #64748b);
  line-height: 1.6;
}

.wf-demo__mock-note {
  margin: 0;
  padding: 6px 10px;
  font-size: 12px;
  line-height: 1.6;
  border-radius: 8px;
  background: rgba(234, 179, 8, 0.1);
  border: 1px solid rgba(234, 179, 8, 0.3);
}

.wf-demo__body {
  display: flex;
  flex: 1;
  min-height: 0;
}

.wf-demo__body :deep(.ai-chat-conversation) {
  flex: 1;
  min-height: 0;
}

.wf-demo__error {
  margin: 0 16px 8px;
  padding: 8px 12px;
  font-size: 12px;
  border-radius: 8px;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.25);
}

.wf-demo__input {
  padding: 8px 12px 12px;
}

@media (max-width: 640px) {
  .wf-demo__header {
    flex-direction: column;
  }
}
</style>
