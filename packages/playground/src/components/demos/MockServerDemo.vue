<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useChat } from '@ai-chat/core'
import type { Message as ChatMessage } from '@ai-chat/core'
import {
  aiChatI18n,
  Button,
  Conversation,
  ConversationContent,
  ConversationEmpty,
  ConversationScrollBtn,
  Message,
  MessageContent,
  ToolCall,
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTools,
  PromptInputButton,
} from '@ai-chat/vue'
import {
  createSseAdapter,
  fetchConversations,
  fetchConversationMessages,
  createConversation,
  type ConversationSummary,
  type ConversationMessageDTO,
} from '../../mock/sse-adapter'
import '../../locales' // 副作用：合并 pg 字典

const { t } = aiChatI18n.global

const BASE_URL = 'http://localhost:8787'

type ServerStatus = 'connecting' | 'online' | 'offline'
const status = ref<ServerStatus>('connecting')
const conversations = ref<ConversationSummary[]>([])
const activeId = ref<string | null>(null)
const loadingMessages = ref(false)

// 会话 id 通过闭包注入 adapter：切换会话后下一次发送自动携带新 id
const chat = useChat(
  createSseAdapter({ getConversationId: () => activeId.value ?? undefined }),
)

const activeConversation = computed(() =>
  conversations.value.find((c) => c.id === activeId.value),
)

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

// PromptInput 的 send 事件载荷是 { text, attachments? }，需解构出文本
function onSend(payload: { text: string }) {
  void chat.send(payload.text)
}

// 场景触发词快捷按钮：点击即发送（同 Playground 建议词模式）
const triggers = [
  { word: '思考', tipKey: 'pg.mockServer.triggerThinking' },
  { word: '工具 天气', tipKey: 'pg.mockServer.triggerTool' },
  { word: '错误', tipKey: 'pg.mockServer.triggerError' },
  { word: '慢速', tipKey: 'pg.mockServer.triggerSlow' },
  { word: 'markdown', tipKey: 'pg.mockServer.triggerMarkdown' },
] as const

async function loadConversations() {
  status.value = 'connecting'
  try {
    const data = await fetchConversations(BASE_URL)
    conversations.value = data.conversations
    status.value = 'online'
    return true
  } catch {
    status.value = 'offline'
    return false
  }
}

/** 服务端 DTO → 库内 Message（createdAt 反序列化为 Date） */
function dtoToMessage(dto: ConversationMessageDTO): ChatMessage {
  return {
    id: dto.id,
    role: dto.role,
    content: dto.content,
    thinking: dto.thinking,
    toolCalls: dto.toolCalls,
    createdAt: new Date(dto.createdAt),
  }
}

async function selectConversation(id: string) {
  if (id === activeId.value) return
  // 流式中切换：先中止，避免响应写进新会话
  if (chat.isStreaming) chat.abort()
  activeId.value = id
  loadingMessages.value = true
  chat.clear()
  try {
    const data = await fetchConversationMessages(id, BASE_URL)
    // 服务端是唯一数据源：切换即拉取，能看到其他入口写入的历史
    chat.messages.push(...data.messages.map(dtoToMessage))
    scrollToBottom()
  } catch {
    chat.messages.push({
      id: `err_${Date.now()}`,
      role: 'system',
      content: t('pg.mockServer.loadFailed'),
      createdAt: new Date(),
    })
  } finally {
    loadingMessages.value = false
  }
}

async function newConversation() {
  if (chat.isStreaming) chat.abort()
  try {
    const conv = await createConversation(BASE_URL)
    conversations.value.unshift(conv)
    activeId.value = conv.id
    chat.clear()
  } catch {
    status.value = 'offline'
  }
}

async function retryConnect() {
  const ok = await loadConversations()
  if (ok && !activeId.value && conversations.value.length) {
    await selectConversation(conversations.value[0].id)
  }
}

onMounted(async () => {
  const ok = await loadConversations()
  if (ok && conversations.value.length) {
    await selectConversation(conversations.value[0].id)
  }
})
</script>

<template>
  <div class="ms-demo">
    <!-- 顶栏：标题 + 服务端连接状态 -->
    <header class="ms-demo__header">
      <div class="ms-demo__heading">
        <h3 class="ms-demo__title">{{ t('pg.mockServer.title') }}</h3>
        <p class="ms-demo__desc">{{ t('pg.mockServer.description') }}</p>
      </div>
      <div class="ms-demo__status" :data-status="status">
        <span class="ms-demo__status-dot" />
        <span class="ms-demo__status-text">
          {{
            status === 'online'
              ? t('pg.mockServer.statusOnline')
              : status === 'connecting'
                ? t('pg.mockServer.statusConnecting')
                : t('pg.mockServer.statusOffline')
          }}
        </span>
        <Button
          v-if="status === 'offline'"
          type="secondary"
          size="small"
          @click="retryConnect"
        >
          {{ t('pg.mockServer.retry') }}
        </Button>
      </div>
    </header>

    <div v-if="status === 'offline'" class="ms-demo__offline">
      {{ t('pg.mockServer.offlineHint') }}
    </div>

    <div class="ms-demo__body">
      <!-- 会话列表（服务端数据） -->
      <aside class="ms-demo__sidebar">
        <div class="ms-demo__sidebar-head">
          <span>{{ t('pg.mockServer.conversationLabel') }}</span>
          <Button
            size="small"
            :disabled="status !== 'online'"
            @click="newConversation"
          >
            {{ t('pg.mockServer.newChat') }}
          </Button>
        </div>
        <ul class="ms-demo__conv-list">
          <li
            v-for="conv in conversations"
            :key="conv.id"
            class="ms-demo__conv"
            :class="{ 'is-active': conv.id === activeId }"
            @click="selectConversation(conv.id)"
          >
            <span class="ms-demo__conv-title">{{ conv.title }}</span>
            <span class="ms-demo__conv-meta">{{ conv.description }}</span>
          </li>
        </ul>
      </aside>

      <!-- 消息区：Conversation 自带 flex 布局，Content 即滚动容器 -->
      <div class="ms-demo__main">
        <Conversation>
          <ConversationContent ref="chatAreaRef" @scroll.passive="onScroll">
            <div v-if="loadingMessages" class="ms-demo__loading">
              {{ t('pg.mockServer.loadingMessages') }}
            </div>
            <ConversationEmpty
              v-else-if="chat.messages.length === 0 && activeConversation"
              :title="activeConversation.title"
              :description="activeConversation.description"
            />
            <template v-for="msg in chat.messages" :key="msg.id">
              <Message :from="msg.role">
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

          <!-- 错误条 -->
          <div v-if="chat.error" class="ms-demo__error">
            {{ chat.error.message }}
          </div>

          <!-- 输入区 -->
          <div class="ms-demo__input">
            <PromptInput @send="onSend">
              <PromptInputBody>
                <PromptInputTextarea
                  :placeholder="t('pg.mockServer.inputPlaceholder')"
                />
              </PromptInputBody>
              <template #footer>
                <PromptInputFooter>
                  <template #tools>
                    <PromptInputTools>
                      <PromptInputButton
                        v-for="trg in triggers"
                        :key="trg.word"
                        :tooltip="t(trg.tipKey)"
                        @click="onSend({ text: trg.word })"
                      >
                        {{ trg.word }}
                      </PromptInputButton>
                    </PromptInputTools>
                  </template>
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
  </div>
</template>

<style scoped>
.ms-demo {
  border: 1px solid var(--ai-chat-border-color, #e2e8f0);
  border-radius: 12px;
  overflow: hidden;
  background: var(--ai-chat-bg-color, #fff);
}

.ms-demo__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--ai-chat-border-color, #e2e8f0);
}

.ms-demo__title {
  margin: 0 0 4px;
  font-size: 15px;
  font-weight: 600;
}

.ms-demo__desc {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  opacity: 0.7;
  max-width: 560px;
}

.ms-demo__status {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  font-size: 12px;
}

.ms-demo__status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #94a3b8;
}

.ms-demo__status[data-status='online'] .ms-demo__status-dot {
  background: #22c55e;
}

.ms-demo__status[data-status='connecting'] .ms-demo__status-dot {
  background: #eab308;
}

.ms-demo__status[data-status='offline'] .ms-demo__status-dot {
  background: #ef4444;
}

.ms-demo__status :deep(.ai-chat-btn) {
  margin-left: 4px;
}

.ms-demo__offline {
  padding: 10px 16px;
  font-size: 13px;
  background: rgba(239, 68, 68, 0.08);
  border-bottom: 1px solid rgba(239, 68, 68, 0.2);
}

.ms-demo__body {
  display: flex;
  /* 占满视口剩余高度：160 = 导航 64 + 页面标题/导语与 demo 头部 96；
     24 为底部留白。矮视口用 min-height 兜底，超出部分页面整体滚动 */
  height: calc(100vh - 184px);
  height: calc(100dvh - 184px);
  min-height: 480px;
}

.ms-demo__sidebar {
  width: 220px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--ai-chat-border-color, #e2e8f0);
}

.ms-demo__sidebar-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  font-size: 12px;
  font-weight: 600;
}

.ms-demo__conv-list {
  list-style: none;
  margin: 0;
  padding: 4px;
  overflow-y: auto;
  flex: 1;
}

.ms-demo__conv {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
}

.ms-demo__conv:hover {
  background: rgba(128, 128, 128, 0.15);
}

.ms-demo__conv.is-active {
  background: rgba(128, 128, 128, 0.22);
}

.ms-demo__conv-title {
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ms-demo__conv-meta {
  font-size: 11px;
  opacity: 0.6;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ms-demo__main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.ms-demo__main :deep(.ai-chat-conversation) {
  flex: 1;
  min-height: 0;
}

.ms-demo__loading {
  text-align: center;
  font-size: 13px;
  opacity: 0.6;
  padding: 24px 0;
}

.ms-demo__error {
  margin: 0 16px 8px;
  padding: 8px 12px;
  font-size: 12px;
  border-radius: 8px;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.25);
}

.ms-demo__input {
  padding: 8px 12px 12px;
}

@media (max-width: 640px) {
  .ms-demo__sidebar {
    display: none;
  }
}
</style>
