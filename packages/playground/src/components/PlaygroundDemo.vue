<script setup lang="ts">
import { ref, computed, nextTick, watch, onMounted, onUnmounted } from 'vue'
import { useChat, generateId } from '@ai-chat/core'
import type { Attachment } from '@ai-chat/core'
import { mockMessages } from '../mock/mock-messages'
import {
  LanguageToggle,
  aiChatI18n,
  Conversation,
  ConversationContent,
  ConversationEmpty,
  ConversationScrollBtn,
  Message,
  MessageContent,
  MessageActions,
  MessageAction,
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputSubmit,
  PromptInputUploadButton,
  PromptInputAttachments,
  PromptInputFooter,
  PromptInputTools,
  PromptInputButton,
  ToolCall,
  ComparisonMessage,
  useLayoutConfig,
  useTheme,
} from '@ai-chat/vue'
import { mockAdapter } from '../mock/mock-adapter'
import { comparisonMock } from '../mock/mock-comparison'
import '../locales' // 副作用：合并 pg 字典

const { t } = aiChatI18n.global
// FR-4（spec 04）：KaTeX 样式已改为可选子路径，playground 显式引入保持公式渲染体验。
// 走 workspace 源码路径；发布包对应 '@ai-chat/markdown/katex.css'
import '../../../markdown/src/styles/katex.css'

const chat = useChat(mockAdapter, { initialMessages: mockMessages })

const sidebarOpen = ref(false)
// 桌面端折叠状态（挤压式收起，与移动端抽屉 sidebarOpen 解耦）
const sidebarCollapsed = ref(false)

// 消息布局：stacked（统一对齐）/ im（用户与 AI 分列两侧）切换
const layoutMode = ref<'stacked' | 'im'>('stacked')
const layout = useLayoutConfig(
  computed(() => ({
    layout: layoutMode.value,
    messageAlign: 'right',
    contentMaxWidthWide: 1024,
    messageMaxWidth: 520,
  })),
)
// ComparisonMessage 偏好回调
const lastPrefer = ref<{
  chosen: 'A' | 'B'
  left: string
  right: string
} | null>(null)
// 对比卡是否已选择：选中后移除卡片，把内容固化为消息流
const comparisonChosen = ref(false)
function onPrefer(p: { chosen: 'A' | 'B'; left: string; right: string }) {
  lastPrefer.value = p
  if (comparisonChosen.value) return
  comparisonChosen.value = true
  chat.messages.push(
    {
      id: generateId(),
      role: 'user',
      content: comparisonMock.question,
      createdAt: new Date(),
    },
    {
      id: generateId(),
      role: 'assistant',
      content: p.chosen === 'A' ? p.left : p.right,
      createdAt: new Date(),
    },
  )
}

// 主题统一走 @ai-chat/vue 的 useTheme 单例（持久化 + 系统跟随 + 写 data-theme）
const { resolvedTheme, toggleTheme } = useTheme()
const chatAreaRef = ref<HTMLElement>()
const isAtBottom = ref(true)

interface PlaygroundConv {
  id: string
  title: string
  group: 'today' | 'week'
  active: boolean
}

const conversations = ref<PlaygroundConv[]>([
  { id: '1', title: 'Vue 3 组件库架构设计', group: 'today', active: true },
  { id: '2', title: 'CSS Variables 主题系统', group: 'today', active: false },
  { id: '3', title: 'StreamText 流式渲染优化', group: 'today', active: false },
  { id: '4', title: 'Vitest 单元测试覆盖率', group: 'week', active: false },
  { id: '5', title: 'Markdown 渲染与代码高亮', group: 'week', active: false },
  { id: '6', title: 'pnpm workspace 最佳实践', group: 'week', active: false },
])

const editingId = ref<string | null>(null)
const editingTitle = ref('')

const groupedConversations = computed(() => [
  {
    label: t('pg.sidebar.today'),
    items: conversations.value.filter((c) => c.group === 'today'),
  },
  {
    label: t('pg.sidebar.last7'),
    items: conversations.value.filter((c) => c.group === 'week'),
  },
])

const suggestions = [
  '帮我设计一个 Vue 3 组件库的架构方案，包含 Monorepo 结构',
  '解释 CSS Variables 如何实现主题切换和暗色模式',
  '写一个 AsyncGenerator 实现的流式消息处理函数',
  '如何用 Vitest 测试 Vue 3 的 composable 函数',
]

function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value
}

// 桌面端收起侧边栏（挤压式，主区自动扩展）；同时关闭移动端抽屉
function collapseSidebar() {
  sidebarCollapsed.value = true
  sidebarOpen.value = false
}

// 展开/打开侧边栏：桌面端取消折叠，移动端切换抽屉
function openSidebar() {
  sidebarCollapsed.value = false
  sidebarOpen.value = !sidebarOpen.value
}

function selectConversation(id: string) {
  conversations.value.forEach((c) => (c.active = c.id === id))
  if (window.innerWidth <= 768) sidebarOpen.value = false
}

function newChat() {
  chat.clear()
  if (window.innerWidth <= 768) sidebarOpen.value = false
}

// ⌘K / Ctrl+K → 新对话；捕获阶段拦截，避免被 VitePress 本地搜索抢占
function onShortcutKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
    e.preventDefault()
    e.stopPropagation()
    newChat()
  }
}

onMounted(() => window.addEventListener('keydown', onShortcutKeydown, true))
onUnmounted(() =>
  window.removeEventListener('keydown', onShortcutKeydown, true),
)

function startEdit(conv: PlaygroundConv) {
  editingId.value = conv.id
  editingTitle.value = conv.title
  nextTick(() => {
    const input = document.querySelector<HTMLInputElement>('.pg-conv-input')
    input?.focus()
    input?.select()
  })
}

function saveTitle() {
  if (editingId.value === null) return
  const conv = conversations.value.find((c) => c.id === editingId.value)
  const title = editingTitle.value.trim()
  if (conv && title) conv.title = title
  editingId.value = null
  editingTitle.value = ''
}

function cancelEdit() {
  editingId.value = null
  editingTitle.value = ''
}

function removeConversation(id: string) {
  const conv = conversations.value.find((c) => c.id === id)
  if (!conv) return
  if (!window.confirm(t('pg.sidebar.confirmRemove', { title: conv.title })))
    return
  const wasActive = conv.active
  conversations.value = conversations.value.filter((c) => c.id !== id)
  // 删除的是当前选中项：把高亮转移到剩余列表的第一项
  if (wasActive && conversations.value.length) {
    conversations.value.forEach((c, i) => (c.active = i === 0))
  }
}

function useSuggestion(text: string) {
  chat.send(text)
}

// mock 上传：模拟真实接口的 800ms 延迟，返回带本地预览 URL 的附件
async function mockUpload(files: File[]): Promise<Attachment[]> {
  await new Promise((r) => setTimeout(r, 800))
  return files.map((f) => ({
    id: `att_${f.name}_${f.size}`,
    name: f.name,
    mediaType: f.type || 'application/octet-stream',
    size: f.size,
    url: URL.createObjectURL(f),
  }))
}

function onSend(payload: { text: string; attachments?: Attachment[] }) {
  chat.send(payload.text, payload.attachments)
}

function scrollToBottom() {
  nextTick(() => {
    if (chatAreaRef.value) {
      chatAreaRef.value.scrollTop = chatAreaRef.value.scrollHeight
    }
  })
}

function handleScroll() {
  if (!chatAreaRef.value) return
  const el = chatAreaRef.value
  isAtBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < 50
}

watch(() => chat.messages.length, scrollToBottom)
</script>

<template>
  <div class="pg-app" :data-theme="resolvedTheme">
    <!-- Sidebar -->
    <aside
      class="pg-sidebar"
      :class="{ open: sidebarOpen, collapsed: sidebarCollapsed }"
    >
      <div class="pg-sidebar-header">
        <div class="pg-sidebar-logo">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          AI Chat UI
        </div>
        <button
          class="pg-btn-icon"
          :title="t('pg.sidebar.collapse')"
          @click="collapseSidebar"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
          </svg>
        </button>
      </div>

      <button class="pg-btn-new-chat" @click="newChat">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
        </svg>
        <span>{{ t('pg.sidebar.newChat') }}</span>
        <span class="pg-shortcut">⌘K</span>
      </button>

      <div class="pg-sidebar-search">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input type="text" :placeholder="t('pg.sidebar.searchPlaceholder')" />
      </div>

      <div class="pg-sidebar-scroll">
        <template v-for="group in groupedConversations" :key="group.label">
          <div v-if="group.items.length" class="pg-section-title">
            {{ group.label }}
          </div>
          <div
            v-for="conv in group.items"
            :key="conv.id"
            class="pg-conv-item"
            :class="{ active: conv.active, editing: editingId === conv.id }"
            @click="selectConversation(conv.id)"
          >
            <svg
              class="pg-conv-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path
                d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
              />
            </svg>
            <input
              v-if="editingId === conv.id"
              v-model="editingTitle"
              class="pg-conv-input"
              @click.stop
              @keydown.enter="saveTitle"
              @keydown.esc="cancelEdit"
              @blur="saveTitle"
            />
            <span v-else class="pg-conv-text">{{ conv.title }}</span>
            <div
              v-if="editingId !== conv.id"
              class="pg-conv-actions"
              @click.stop
            >
              <button
                class="pg-conv-action"
                :title="t('pg.sidebar.rename')"
                @click="startEdit(conv)"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path
                    d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
                  />
                  <path
                    d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
                  />
                </svg>
              </button>
              <button
                class="pg-conv-action"
                :title="t('pg.sidebar.remove')"
                @click="removeConversation(conv.id)"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path
                    d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                  />
                </svg>
              </button>
            </div>
          </div>
        </template>
        <div v-if="!conversations.length" class="pg-conv-empty">
          {{ t('pg.sidebar.empty') }}
        </div>
      </div>

      <div class="pg-sidebar-footer">
        <div class="pg-user-profile">
          <div class="pg-user-avatar">U</div>
          <div class="pg-user-info">
            <div class="pg-user-name">User</div>
            <div class="pg-user-plan">Free Plan</div>
          </div>
        </div>
      </div>
    </aside>

    <!-- Mobile overlay -->
    <div
      class="pg-mobile-overlay"
      :class="{ open: sidebarOpen }"
      @click="toggleSidebar"
    />

    <!-- Main -->
    <main class="pg-main">
      <header class="pg-main-header">
        <div style="display: flex; align-items: center; gap: 8px">
          <button
            class="pg-btn-icon pg-sidebar-toggle"
            :class="{ show: sidebarCollapsed }"
            @click="openSidebar"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <button class="pg-model-selector">
            AI Chat UI
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
        <div class="pg-header-actions">
          <button
            class="pg-btn-icon"
            :title="
              layoutMode === 'stacked'
                ? t('pg.layout.switchToIm')
                : t('pg.layout.switchToStacked')
            "
            @click="layoutMode = layoutMode === 'stacked' ? 'im' : 'stacked'"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </button>
          <button
            class="pg-btn-icon"
            :title="t('pg.theme.toggle')"
            @click="toggleTheme"
          >
            <svg
              v-if="resolvedTheme === 'dark'"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
            <svg
              v-else
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          </button>
          <LanguageToggle />
        </div>
      </header>

      <Conversation
        :layout="layout.layoutProps.value.layout"
        :message-align="layout.layoutProps.value.messageAlign"
        :custom-theme="layout.vars.value"
      >
        <ConversationContent ref="chatAreaRef" @scroll="handleScroll">
          <!-- Welcome screen -->
          <ConversationEmpty v-if="chat.messages.length === 0">
            <div class="pg-welcome">
              <div class="pg-welcome-logo">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
              </div>
              <h1 class="pg-welcome-title">
                {{ t('pg.welcome.title') }}
              </h1>
              <p class="pg-welcome-subtitle">
                {{ t('pg.welcome.subtitle') }}
              </p>
              <div class="pg-suggestions">
                <button
                  v-for="(s, i) in suggestions"
                  :key="i"
                  class="pg-suggestion-card"
                  @click="useSuggestion(s)"
                >
                  {{ s }}
                </button>
              </div>
            </div>
          </ConversationEmpty>

          <!-- Messages -->
          <Message v-for="msg in chat.messages" :key="msg.id" :from="msg.role">
            <MessageContent
              v-if="msg.role === 'assistant'"
              :content="msg.content"
            />
            <MessageContent v-else>
              {{ msg.content }}
            </MessageContent>

            <!-- ToolCalls -->
            <ToolCall v-for="tc in msg.toolCalls" :key="tc.id" :data="tc" />

            <MessageActions v-if="msg.role === 'assistant'">
              <MessageAction :title="t('pg.actions.copy')">
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path
                    d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
                  />
                </svg>
              </MessageAction>
              <MessageAction :title="t('pg.actions.regenerate')">
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
              </MessageAction>
            </MessageActions>
          </Message>

          <!-- A/B 偏好对比演示：选中后固化为消息流（用户问题 + 选中的回复） -->
          <template v-if="!comparisonChosen">
            <Message from="user">
              <MessageContent>{{ comparisonMock.question }}</MessageContent>
            </Message>
            <ComparisonMessage
              :left="comparisonMock.left"
              :right="comparisonMock.right"
              :left-label="comparisonMock.leftLabel"
              :right-label="comparisonMock.rightLabel"
              @prefer="onPrefer"
            />
          </template>
          <div v-if="lastPrefer" class="pg-comparison-result">
            {{ t('pg.actions.preferred', { chosen: lastPrefer.chosen }) }}
          </div>

          <!-- Typing indicator -->
          <div
            v-if="
              chat.isStreaming &&
              !chat.messages[chat.messages.length - 1]?.content
            "
            class="pg-message"
          >
            <div class="pg-avatar-assistant">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <div class="pg-message-body">
              <div class="pg-message-role">AI Chat UI</div>
              <div class="pg-typing"><span /><span /><span /></div>
            </div>
          </div>
        </ConversationContent>

        <ConversationScrollBtn
          v-if="!isAtBottom && chat.messages.length > 0"
          @click="scrollToBottom"
        />

        <!-- Input -->
        <div class="pg-input-area">
          <PromptInput :before-send="mockUpload" @send="onSend">
            <PromptInputAttachments />
            <PromptInputBody>
              <PromptInputTextarea :placeholder="t('pg.input.placeholder')" />
            </PromptInputBody>
            <template #footer>
              <PromptInputFooter>
                <template #tools>
                  <PromptInputTools>
                    <PromptInputUploadButton kind="image" />
                    <PromptInputUploadButton kind="file" />
                    <PromptInputButton :title="t('pg.tools.webSearch')">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="2" y1="12" x2="22" y2="12" />
                        <path
                          d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
                        />
                      </svg>
                    </PromptInputButton>
                    <PromptInputButton :title="t('pg.tools.codeInterpreter')">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <polyline points="16 18 22 12 16 6" />
                        <polyline points="8 6 2 12 8 18" />
                      </svg>
                    </PromptInputButton>
                    <PromptInputButton :title="t('pg.tools.imageGen')">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <rect
                          x="3"
                          y="3"
                          width="18"
                          height="18"
                          rx="2"
                          ry="2"
                        />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                    </PromptInputButton>
                  </PromptInputTools>
                </template>
                <template #hint>
                  <PromptInputSubmit />
                </template>
              </PromptInputFooter>
            </template>
          </PromptInput>
        </div>
      </Conversation>
    </main>
  </div>
</template>

<style>
/* ===== Playground Layout ===== */
.pg-app {
  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;
  font-family: var(--ai-chat-font-sans);
  background: var(--ai-chat-color-bg-primary);
  color: var(--ai-chat-color-text-primary);
  position: relative;
}

/* ===== Sidebar ===== */
.pg-sidebar {
  width: 260px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--ai-chat-color-bg-sidebar);
  border-right: 1px solid var(--ai-chat-color-border);
  overflow: hidden;
  transition: width 0.2s ease;
}

.pg-sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--ai-chat-color-border);
}

.pg-sidebar-logo {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 15px;
  color: var(--ai-chat-color-text-primary);
}

.pg-sidebar-logo svg {
  width: 20px;
  height: 20px;
  color: var(--ai-chat-color-accent);
}

.pg-btn-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--ai-chat-color-text-secondary);
  cursor: pointer;
  transition: background var(--ai-chat-duration-fast) var(--ai-chat-easing);
}

.pg-btn-icon:hover {
  background: rgba(128, 128, 128, 0.15);
}

.pg-btn-new-chat {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 12px 16px 8px;
  padding: 8px 12px;
  border: 1px solid var(--ai-chat-color-border);
  border-radius: 8px;
  background: transparent;
  color: var(--ai-chat-color-text-primary);
  font-size: 14px;
  cursor: pointer;
  transition: background var(--ai-chat-duration-fast) var(--ai-chat-easing);
}

.pg-btn-new-chat svg {
  width: 16px;
  height: 16px;
}

.pg-btn-new-chat:hover {
  background: var(--ai-chat-color-bg-sidebar-hover);
}

.pg-shortcut {
  margin-left: auto;
  font-size: 12px;
  color: var(--ai-chat-color-text-muted);
}

.pg-sidebar-search {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 4px 16px 12px;
  padding: 6px 10px;
  background: var(--ai-chat-color-bg-secondary);
  border-radius: 6px;
  border: 1px solid var(--ai-chat-color-border);
}

.pg-sidebar-search svg {
  width: 16px;
  height: 16px;
  color: var(--ai-chat-color-text-muted);
  flex-shrink: 0;
}

.pg-sidebar-search input {
  border: none;
  background: transparent;
  color: var(--ai-chat-color-text-primary);
  font-size: 13px;
  outline: none;
  width: 100%;
}

.pg-sidebar-search input::placeholder {
  color: var(--ai-chat-color-text-muted);
}

.pg-sidebar-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 0 8px;
}

.pg-section-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--ai-chat-color-text-muted);
  padding: 8px 8px 4px;
  letter-spacing: 0.5px;
}

.pg-conv-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  color: var(--ai-chat-color-text-secondary);
  transition: background var(--ai-chat-duration-fast) var(--ai-chat-easing);
}

.pg-conv-item:hover {
  background: var(--ai-chat-color-bg-sidebar-hover);
}

.pg-conv-item.active {
  background: var(--ai-chat-color-bg-sidebar-active);
  color: var(--ai-chat-color-text-primary);
}

.pg-conv-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.pg-conv-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pg-conv-item.editing {
  cursor: default;
}

.pg-conv-input {
  flex: 1;
  min-width: 0;
  padding: 2px 6px;
  border: 1px solid var(--ai-chat-color-accent);
  border-radius: 4px;
  background: var(--ai-chat-color-bg-primary);
  color: var(--ai-chat-color-text-primary);
  font-size: 13px;
  font-family: inherit;
  outline: none;
}

.pg-conv-actions {
  display: flex;
  gap: 2px;
  margin-left: auto;
  visibility: hidden;
}

.pg-conv-item:hover .pg-conv-actions {
  visibility: visible;
}

.pg-conv-action {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--ai-chat-color-text-muted);
  cursor: pointer;
  transition:
    background var(--ai-chat-duration-fast) var(--ai-chat-easing),
    color var(--ai-chat-duration-fast) var(--ai-chat-easing);
}

.pg-conv-action svg {
  width: 14px;
  height: 14px;
}

.pg-conv-action:hover {
  background: rgba(128, 128, 128, 0.2);
  color: var(--ai-chat-color-text-primary);
}

.pg-conv-empty {
  padding: 16px 8px;
  font-size: 13px;
  color: var(--ai-chat-color-text-muted);
  text-align: center;
}

.pg-sidebar-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--ai-chat-color-border);
}

.pg-user-profile {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pg-user-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: linear-gradient(135deg, #6366f1, #a78bfa);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  flex-shrink: 0;
}

.pg-user-info {
  display: flex;
  flex-direction: column;
}

.pg-user-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--ai-chat-color-text-primary);
}

.pg-user-plan {
  font-size: 12px;
  color: var(--ai-chat-color-text-muted);
}

/* ===== Main ===== */
.pg-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  position: relative;
}

.pg-main-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  border-bottom: 1px solid var(--ai-chat-color-border);
}

.pg-sidebar-toggle {
  display: none;
}

.pg-model-selector {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: 1px solid var(--ai-chat-color-border);
  border-radius: 6px;
  background: transparent;
  color: var(--ai-chat-color-text-primary);
  font-size: 14px;
  cursor: pointer;
}

.pg-model-selector svg {
  width: 14px;
  height: 14px;
}

.pg-header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* ===== Welcome Screen ===== */
.pg-welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
  width: 100%;
}

.pg-welcome-logo {
  width: 52px;
  height: 52px;
  border-radius: 16px;
  background: linear-gradient(135deg, #6366f1, #a78bfa, #c084fc);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}

.pg-welcome-logo svg {
  width: 28px;
  height: 28px;
  color: #fff;
}

.pg-welcome-title {
  font-size: 22px;
  font-weight: 600;
  margin-bottom: 4px;
}

.pg-welcome-subtitle {
  font-size: 14px;
  color: var(--ai-chat-color-text-muted);
  margin-bottom: 24px;
}

.pg-suggestions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  max-width: 560px;
  width: 100%;
}

.pg-suggestion-card {
  padding: 12px 16px;
  border: 1px solid var(--ai-chat-color-border);
  border-radius: 10px;
  background: transparent;
  color: var(--ai-chat-color-text-secondary);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: background var(--ai-chat-duration-fast) var(--ai-chat-easing);
  line-height: 1.4;
}

.pg-suggestion-card:hover {
  background: rgba(128, 128, 128, 0.15);
}

/* ===== Typing Indicator ===== */
.pg-message {
  display: flex;
  gap: 16px;
  padding: 20px 0;
  animation: fadeInUp 0.3s ease-out;
}

.pg-avatar-assistant {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--ai-chat-color-bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 1px solid var(--ai-chat-color-border);
}

.pg-avatar-assistant svg {
  width: 16px;
  height: 16px;
  color: var(--ai-chat-color-accent);
}

.pg-message-body {
  flex: 1;
  min-width: 0;
}

.pg-message-role {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 4px;
}

.pg-typing {
  display: flex;
  gap: 4px;
  padding: 4px 0;
}

.pg-typing span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ai-chat-color-text-muted);
  animation: typing 1.2s infinite;
}

.pg-typing span:nth-child(2) {
  animation-delay: 0.2s;
}

.pg-typing span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing {
  0%,
  100% {
    opacity: 0.3;
    transform: scale(0.8);
  }
  50% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ===== Input Area ===== */
.pg-input-area {
  max-width: 768px;
  width: 100%;
  margin: 0 auto;
  padding: 0 24px 16px;
}

.pg-input-hint {
  font-size: 12px;
  color: var(--ai-chat-color-text-muted);
}

.pg-comparison-result {
  text-align: center;
  font-size: 12px;
  color: var(--ai-chat-color-text-muted);
  padding: 8px 0;
}

/* ===== Mobile ===== */
.pg-mobile-overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 40;
}

.pg-mobile-overlay.open {
  display: block;
}

/* 桌面端折叠侧边栏：宽度收为 0，主区自动扩展；折叠时显示主区展开按钮 */
@media (min-width: 769px) {
  .pg-sidebar.collapsed {
    width: 0;
    min-width: 0;
    border-right: none;
  }

  .pg-sidebar-toggle.show {
    display: flex;
  }

  /* 桌面端屏蔽移动抽屉蒙层，避免展开时残留 */
  .pg-mobile-overlay.open {
    display: none;
  }
}

@media (max-width: 768px) {
  .pg-sidebar {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    z-index: 50;
    transform: translateX(-100%);
    transition: transform 0.2s ease;
  }

  .pg-sidebar.open {
    transform: translateX(0);
  }

  .pg-sidebar-toggle {
    display: flex;
  }

  .pg-suggestions {
    grid-template-columns: 1fr;
  }

  .pg-input-area {
    padding: 0 12px 12px;
  }
}
</style>
