<script setup lang="ts">
import { ref, computed, nextTick, watch, onMounted, onUnmounted } from 'vue'
import { useChat } from '@toimc/core'
import type { Attachment } from '@toimc/core'
import {
  mockMessages,
  thinkingDemoMessages,
  emptyMessages,
  comparisonDemoMessages,
} from '../mock/mock-messages'
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
  ThinkingBlock,
  ProviderSettingsDialog,
  useLayoutConfig,
  useTheme,
} from '@toimc/vue'
import type { ProviderFormPayload, ProviderOption } from '@toimc/vue'
import { createDispatchAdapter } from '../mock/dispatch-adapter'
import { useProviderModels } from '../composables/useProviderModels'
import {
  BACKEND_BASE_URLS,
  useBackendSelector,
} from '../composables/useBackendSelector'
import type { PlaygroundBackendId } from '../composables/useBackendSelector'
import MessageEditor from './MessageEditor.vue'
import '../locales' // 副作用：合并 pg 字典

const { t } = aiChatI18n.global
// FR-4（spec 04）：KaTeX 样式已改为可选子路径，playground 显式引入保持公式渲染体验。
// 走 workspace 源码路径；发布包对应 '@toimc/markdown/katex.css'
import '../../../markdown/src/styles/katex.css'

// 运行时模型与 Provider 状态（spec 11）：拉取 /api/models、/api/providers，
// 选中模型 id 持久化 localStorage（仅 id，绝存 apiKey）
const {
  models: modelList,
  providers: providerList,
  status: providerStatus,
  selectedModelId,
  createProvider,
  updateProvider,
  removeProvider,
  restoreSavedProviders,
  selectModel,
} = useProviderModels()

// 后端选择器（spec 12）：本地 Mock / dev-server 8787；
// 选中 id 持久化 localStorage，切换远端前探活，不可达不切换并标离线禁用
const {
  backend: backendId,
  serverOnline,
  probeAll: probeBackends,
  selectBackend,
  isOffline: isBackendOffline,
} = useBackendSelector()

// —— 上下文窗口（spec 13）：模型级配置持久化，getter 每次发送时求值 ——
const CONTEXT_WINDOW_KEY = 'pg.modelContextTokens'

function loadContextWindowMap(): Record<string, number> {
  try {
    const raw = JSON.parse(localStorage.getItem(CONTEXT_WINDOW_KEY) ?? '{}')
    if (raw && typeof raw === 'object') {
      return raw as Record<string, number>
    }
  } catch {
    // 损坏数据回退默认（安全规范：localStorage 视为不可信输入）
  }
  return {}
}

const contextWindowMap = ref(loadContextWindowMap())
// 窗口设置 popover 状态：目标模型 id + 输入草稿
const contextTargetModelId = ref<string | null>(null)
const contextWindowDraft = ref('')

function contextWindowOf(modelId: string): number {
  return contextWindowMap.value[modelId] ?? 0
}

function openContextWindow(modelId: string) {
  contextTargetModelId.value = modelId
  contextWindowDraft.value = String(contextWindowOf(modelId) || '')
}

function closeContextWindow() {
  contextTargetModelId.value = null
}

function saveContextWindow() {
  const id = contextTargetModelId.value
  if (!id) return
  const value = Math.max(0, Math.floor(Number(contextWindowDraft.value) || 0))
  contextWindowMap.value = { ...contextWindowMap.value, [id]: value }
  try {
    localStorage.setItem(
      CONTEXT_WINDOW_KEY,
      JSON.stringify(contextWindowMap.value),
    )
  } catch {
    // 写失败不阻断（隐私模式等场景）
  }
  closeContextWindow()
}

// 当前生效窗口：选中模型的配置，缺省回退 default 档（本地 Mock 无模型概念）
function resolveChatMaxContextTokens(): number {
  const key = selectedModelId.value ?? 'default'
  return contextWindowMap.value[key] || contextWindowMap.value.default || 0
}

// 初始消息由会话加载逻辑统一注入（见下方 conversations 定义后），避免双重数据
// adapter 分发闭包：发送时才解析当前会话（带 model → 真实模型 SSE，否则本地 mock）
const chat = useChat(
  createDispatchAdapter({
    getConversation: () =>
      conversations.value.find((c) => c.id === activeConversationId.value),
  }),
  { maxContextTokens: resolveChatMaxContextTokens },
)

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
// ComparisonMessage 偏好回调：选中后原地固化为普通 assistant 消息（content = 选中内容），
// 状态存于消息本身，切换会话再回来依然保留
function onPrefer(
  msg: typeof import('@toimc/core').Message,
  p: { chosen: 'A' | 'B'; left: string; right: string },
) {
  msg.content = p.chosen === 'A' ? p.left : p.right
  msg.comparison = undefined
}

// —— 消息操作（spec 13）——
// 命名带 Message 后缀：与侧边栏会话标题编辑（editingId/startEdit/cancelEdit）区分
const copiedId = ref<string | null>(null)

async function copyMessage(
  msg: typeof import('@toimc/core').Message,
): Promise<void> {
  try {
    await navigator.clipboard.writeText(msg.content)
    copiedId.value = msg.id
    setTimeout(() => {
      if (copiedId.value === msg.id) copiedId.value = null
    }, 1500)
  } catch {
    // 剪贴板权限被拒时静默（不打断聊天）
  }
}

const editingMessageId = ref<string | null>(null)

function startEditMessage(msg: typeof import('@toimc/core').Message): void {
  if (chat.isStreaming) return
  editingMessageId.value = msg.id
}

function cancelEditMessage(): void {
  editingMessageId.value = null
}

async function confirmEditMessage(
  msg: typeof import('@toimc/core').Message,
  content: string,
): Promise<void> {
  editingMessageId.value = null
  await chat.editMessage(msg.id, content)
}

function regenerateMessage(msg: typeof import('@toimc/core').Message): void {
  if (chat.isStreaming) return
  void chat.regenerate(msg.id)
}

// 主题统一走 @toimc/vue 的 useTheme 单例（持久化 + 系统跟随 + 写 data-theme）
const { resolvedTheme, toggleTheme } = useTheme()
const chatAreaRef = ref<HTMLElement>()
const isAtBottom = ref(true)

interface PlaygroundConv {
  id: string
  title: string
  group: 'today' | 'week'
  active: boolean
  messages: (typeof import('@toimc/core').Message)[]
  /** 绑定的服务端模型 id（spec 11）：带值会话经 SSE 走真实模型，缺省走本地 mock */
  model?: string
}

const conversations = ref<PlaygroundConv[]>([
  {
    id: '1',
    title: '✨ 思考过程演示',
    group: 'today',
    active: true,
    messages: [...thinkingDemoMessages],
  },
  {
    id: '2',
    title: '⚖️ A/B 回复对比',
    group: 'today',
    active: false,
    messages: [...comparisonDemoMessages],
  },
  {
    id: '3',
    title: 'Vue 3 组件库架构设计',
    group: 'today',
    active: false,
    messages: [mockMessages[0], mockMessages[1]],
  },
  {
    id: '4',
    title: 'CSS Variables 主题系统',
    group: 'today',
    active: false,
    messages: [mockMessages[2], mockMessages[3]],
  },
  {
    id: '5',
    title: 'StreamText 流式渲染优化',
    group: 'today',
    active: false,
    messages: [mockMessages[4], mockMessages[5]],
  },
  {
    id: '6',
    title: 'Vitest 单元测试覆盖率',
    group: 'week',
    active: false,
    messages: [...emptyMessages],
  },
  {
    id: '7',
    title: 'Markdown 渲染与代码高亮',
    group: 'week',
    active: false,
    messages: [...emptyMessages],
  },
  {
    id: '8',
    title: 'pnpm workspace 最佳实践',
    group: 'week',
    active: false,
    messages: [...emptyMessages],
  },
])

// 当前激活的会话ID
const activeConversationId = ref('1')

// 当前激活会话：adapter 分发与真实模型渲染路径的依据
const activeConv = computed(() =>
  conversations.value.find((c) => c.id === activeConversationId.value),
)
// 真实模型会话（绑定 model）：工具过程进思考面板的渲染路径
const isAgentConv = computed(() => Boolean(activeConv.value?.model))

// 初始化时加载第一个会话的消息
chat.messages.push(...conversations.value[0].messages)

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
  // 保存当前会话的消息
  const currentConv = conversations.value.find(
    (c) => c.id === activeConversationId.value,
  )
  if (currentConv) {
    currentConv.messages = [...chat.messages]
  }

  // 切换到新会话
  activeConversationId.value = id
  conversations.value.forEach((c) => (c.active = c.id === id))

  // 加载新会话的消息
  const selectedConv = conversations.value.find((c) => c.id === id)
  if (selectedConv) {
    // 使用 reactive 方式更新消息
    chat.messages.length = 0
    chat.messages.push(...selectedConv.messages)
  }

  if (window.innerWidth <= 768) sidebarOpen.value = false
}

function newChat() {
  // 保存当前会话的消息
  const currentConv = conversations.value.find(
    (c) => c.id === activeConversationId.value,
  )
  if (currentConv) {
    currentConv.messages = [...chat.messages]
  }

  // 创建新会话；选中模型时快照进会话（此后本会话经真实模型收发）
  const newId = `${Date.now()}`
  const newConv: PlaygroundConv = {
    id: newId,
    title: '新对话',
    group: 'today',
    active: true,
    messages: [],
    ...(selectedModelId.value ? { model: selectedModelId.value } : {}),
  }

  // 取消其他会话的激活状态
  conversations.value.forEach((c) => (c.active = false))
  conversations.value.unshift(newConv)
  activeConversationId.value = newId

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

// ===== Provider 设置与模型选择（spec 11：运行时注册真实模型会话） =====
const settingsOpen = ref(false)
const modelMenuOpen = ref(false)
// 顶栏通知条：离线点击提示 / Provider 操作失败（离线提示样式模式）
const notice = ref<string | null>(null)

// 发送失败可见化：useChat 把 error chunk 写进 state.error（不进气泡），
// 不接出来用户只会看到空气泡；经顶栏通知条展示，下次发送自动清除
watch(
  () => chat.error,
  (err) => {
    if (err) notice.value = t('pg.chat.sendFailed', { msg: err.message })
  },
)

// 无可选项（服务端未启动）时下拉保持装饰外观，与现状一致
const hasModelOptions = computed(() => modelList.value.length > 0)
const selectedModelName = computed(() => {
  const id = selectedModelId.value
  if (!id) return t('pg.providerChat.modelDefault')
  return (
    modelList.value.find((m) => m.id === id)?.name ??
    t('pg.providerChat.modelDefault')
  )
})

/** 设置弹层的 providers 数据源：dev-server 的 /api/providers 列表 */
const dialogProviders = computed<ProviderOption[]>(() => providerList.value)

function openSettings() {
  if (providerStatus.value === 'offline') {
    notice.value = t('pg.providerSettings.offlineHint')
    return
  }
  settingsOpen.value = true
}

function toggleModelMenu() {
  if (!hasModelOptions.value) return
  backendMenuOpen.value = false
  modelMenuOpen.value = !modelMenuOpen.value
}

function pickModel(id: string | undefined) {
  selectModel(id)
  // 即时作用于当前会话：同步分发快照，下一次发送就走新模型（用户预期：
  // 顶部切换对当前会话立即生效，而不是只影响新会话）；选回默认则摘除快照回本地 mock
  const conv = conversations.value.find(
    (c) => c.id === activeConversationId.value,
  )
  if (conv) {
    if (id) conv.model = id
    else delete conv.model
  }
  modelMenuOpen.value = false
}

// ===== 后端选择器（spec 12：本地 Mock / dev-server 8787） =====
const backendMenuOpen = ref(false)

const backendOptions = computed(() => [
  {
    id: 'local' as const,
    label: t('pg.backend.local'),
    desc: t('pg.backend.localDesc'),
  },
  {
    id: 'dev-server' as const,
    label: t('pg.backend.devServer'),
    desc: t('pg.backend.devServerDesc'),
  },
])

const currentBackendLabel = computed(
  () =>
    backendOptions.value.find((o) => o.id === backendId.value)?.label ??
    backendOptions.value[0].label,
)

function toggleBackendMenu() {
  backendMenuOpen.value = !backendMenuOpen.value
  if (backendMenuOpen.value) modelMenuOpen.value = false
}

function showBackendOfflineNotice(id: PlaygroundBackendId) {
  if (id === 'local') return
  notice.value = t('pg.backend.offlineHint', {
    url: BACKEND_BASE_URLS['dev-server'],
  })
}

async function pickBackend(id: PlaygroundBackendId) {
  backendMenuOpen.value = false
  // 重选当前远端项 = 重试探活；探活失败不切换并提示（重选 local 恒成功）
  const ok = await selectBackend(id)
  if (!ok) showBackendOfflineNotice(id)
}

async function onCreateProvider(payload: ProviderFormPayload) {
  try {
    await createProvider(payload)
  } catch (err) {
    notice.value = t('pg.providerSettings.actionFailed', {
      message: err instanceof Error ? err.message : String(err),
    })
  }
}

async function onUpdateProvider(id: string, payload: ProviderFormPayload) {
  try {
    await updateProvider(id, payload)
  } catch (err) {
    notice.value = t('pg.providerSettings.actionFailed', {
      message: err instanceof Error ? err.message : String(err),
    })
  }
}

async function onRemoveProvider(id: string) {
  try {
    await removeProvider(id)
    // 删除的是当前选中模型 → 回退默认，新会话回到本地 mock 行为
    if (selectedModelId.value === id) selectModel(undefined)
  } catch (err) {
    notice.value = t('pg.providerSettings.actionFailed', {
      message: err instanceof Error ? err.message : String(err),
    })
  }
}

// 点击菜单外部时关闭（模型 / 后端两个下拉）
function onDocClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest?.('.pg-model-wrap')) modelMenuOpen.value = false
  if (!target.closest?.('.pg-backend-wrap')) backendMenuOpen.value = false
}

// 服务端恢复在线后自动撤掉离线提示
watch(
  () => providerStatus.value,
  (s) => {
    if (s === 'online') notice.value = null
  },
)

// 远端后端探活恢复在线后同样撤掉离线提示
watch(serverOnline, (online) => {
  if (online === true) notice.value = null
})

onMounted(() => {
  // 「记住配置」的 provider 恢复：重注册内部自带列表刷新，离线时静默跳过
  void restoreSavedProviders().catch(() => {})
  void probeBackends()
  window.addEventListener('keydown', onShortcutKeydown, true)
  window.addEventListener('click', onDocClick)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onShortcutKeydown, true)
  window.removeEventListener('click', onDocClick)
})

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
  // 清上一轮错误提示：错误经 notice 展示（useChat 的 error chunk 不进消息气泡）
  if (chat.error) notice.value = null
  chat.send(payload.text, payload.attachments)

  // 保存消息到当前会话
  const currentConv = conversations.value.find(
    (c) => c.id === activeConversationId.value,
  )
  if (currentConv) {
    // 延迟保存，等待消息添加到 chat.messages
    setTimeout(() => {
      currentConv.messages = [...chat.messages]
      // 更新会话标题为第一条消息的前20个字符
      if (currentConv.messages.length >= 2) {
        const lastMsg = currentConv.messages[currentConv.messages.length - 1]
        if (lastMsg.role === 'user' && lastMsg.content) {
          const title =
            lastMsg.content.slice(0, 20) +
            (lastMsg.content.length > 20 ? '...' : '')
          if (currentConv.title.startsWith('新对话')) {
            currentConv.title = title
          }
        }
      }
    }, 100)
  }
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
          <!-- 后端选择器（spec 12）：本地 Mock / dev-server 8787，只对新会话生效 -->
          <div class="pg-backend-wrap">
            <button
              class="pg-backend-selector"
              :class="{ open: backendMenuOpen }"
              :title="t('pg.backend.label')"
              @click="toggleBackendMenu"
            >
              {{ currentBackendLabel }}
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
            <div v-if="backendMenuOpen" class="pg-backend-menu">
              <button
                v-for="opt in backendOptions"
                :key="opt.id"
                class="pg-backend-option"
                :class="{ selected: opt.id === backendId }"
                :disabled="isBackendOffline(opt.id) && opt.id !== backendId"
                @click="pickBackend(opt.id)"
              >
                <span class="pg-backend-option-name">
                  {{ opt.label }}
                  <span
                    v-if="isBackendOffline(opt.id)"
                    class="pg-backend-offline"
                    >{{ t('pg.backend.offline') }}</span
                  >
                </span>
                <span class="pg-backend-option-desc">{{ opt.desc }}</span>
              </button>
            </div>
          </div>
          <div class="pg-model-wrap">
            <button
              class="pg-model-selector"
              :class="{ open: modelMenuOpen }"
              :title="
                hasModelOptions ? t('pg.providerChat.selectModel') : undefined
              "
              @click="toggleModelMenu"
            >
              {{ selectedModelName }}
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
            <!-- 模型下拉：数据源 GET /api/models（mock 三模型 + custom-*）；
                 齿轮配置每模型上下文窗口（spec 13），default 档兜底 -->
            <div v-if="modelMenuOpen" class="pg-model-menu">
              <button
                class="pg-model-option"
                :class="{ selected: !selectedModelId }"
                @click="pickModel(undefined)"
              >
                <span>{{ t('pg.providerChat.modelDefaultOption') }}</span>
                <span
                  class="pg-model-option-gear"
                  :title="t('pg.providerChat.contextWindow')"
                  @click.stop="openContextWindow('default')"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <circle cx="12" cy="12" r="3" />
                    <path
                      d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.09a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
                    />
                  </svg>
                </span>
              </button>
              <button
                v-for="m in modelList"
                :key="m.id"
                class="pg-model-option"
                :class="{ selected: m.id === selectedModelId }"
                @click="pickModel(m.id)"
              >
                <span>{{ m.name }}</span>
                <span
                  class="pg-model-option-gear"
                  :title="t('pg.providerChat.contextWindow')"
                  @click.stop="openContextWindow(m.id)"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <circle cx="12" cy="12" r="3" />
                    <path
                      d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.09a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
                    />
                  </svg>
                </span>
              </button>
              <!-- 窗口设置 popover（spec 13） -->
              <div
                v-if="contextTargetModelId"
                class="pg-context-popover"
                @click.stop
              >
                <label class="pg-context-popover__label">
                  {{ t('pg.providerChat.contextWindow') }}
                </label>
                <input
                  v-model="contextWindowDraft"
                  type="number"
                  min="0"
                  class="pg-context-popover__input"
                  :placeholder="t('pg.providerChat.contextWindowPlaceholder')"
                />
                <p class="pg-context-popover__hint">
                  {{ t('pg.providerChat.contextWindowHint') }}
                </p>
                <div class="pg-context-popover__actions">
                  <button
                    class="pg-message-editor__btn"
                    @click="closeContextWindow"
                  >
                    {{ t('pg.actions.cancelEdit') }}
                  </button>
                  <button
                    class="pg-message-editor__btn pg-message-editor__btn--primary"
                    @click="saveContextWindow"
                  >
                    {{ t('pg.actions.confirmEdit') }}
                  </button>
                </div>
              </div>
            </div>
          </div>
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
          <button
            class="pg-btn-icon"
            :title="t('pg.providerSettings.open')"
            @click="openSettings"
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
              <circle cx="12" cy="12" r="3" />
              <path
                d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
              />
            </svg>
          </button>
          <LanguageToggle />
        </div>
      </header>

      <!-- 离线/操作失败通知条（复用 mock 演示的离线提示样式模式） -->
      <div v-if="notice" class="pg-notice">
        <span>{{ notice }}</span>
        <button
          class="pg-notice-close"
          :title="t('pg.providerSettings.dismiss')"
          @click="notice = null"
        >
          &times;
        </button>
      </div>

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

          <!-- 上下文窗口截断提示（spec 13）：只影响发送，聊天记录完整保留 -->
          <div v-if="chat.truncatedCount > 0" class="pg-context-truncated">
            {{ t('pg.chat.contextTruncated', { n: chat.truncatedCount }) }}
          </div>

          <!-- Messages -->
          <Message v-for="msg in chat.messages" :key="msg.id" :from="msg.role">
            <!-- A/B 回复对比：消息类型驱动渲染，选中后固化为普通消息 -->
            <ComparisonMessage
              v-if="msg.comparison"
              :left="msg.comparison.left"
              :right="msg.comparison.right"
              :left-label="msg.comparison.leftLabel"
              :right-label="msg.comparison.rightLabel"
              @prefer="(p) => onPrefer(msg, p)"
            />

            <template v-else>
              <!-- 真实模型会话（绑定 model）：工具过程进思考面板，随折叠/展开 -->
              <template v-if="isAgentConv && msg.role === 'assistant'">
                <ThinkingBlock
                  v-if="msg.thinking || msg.toolCalls?.length"
                  :content="msg.thinking?.content"
                  :duration="msg.thinking?.duration"
                  :streaming="chat.isStreaming"
                >
                  <ToolCall
                    v-for="tc in msg.toolCalls"
                    :key="tc.id"
                    :data="tc"
                  />
                </ThinkingBlock>
                <MessageContent
                  :content="msg.content"
                  :streaming="chat.isStreaming"
                />
              </template>

              <!-- 纯 mock 会话：现有渲染路径（用户消息支持编辑态替换） -->
              <template v-else>
                <MessageContent
                  v-if="msg.role === 'assistant'"
                  :content="msg.content"
                  :thinking="msg.thinking"
                  :streaming="chat.isStreaming"
                />
                <MessageEditor
                  v-else-if="editingMessageId === msg.id"
                  :content="msg.content"
                  @confirm="(content) => confirmEditMessage(msg, content)"
                  @cancel="cancelEditMessage"
                />
                <MessageContent v-else>
                  {{ msg.content }}
                </MessageContent>

                <!-- ToolCalls -->
                <ToolCall v-for="tc in msg.toolCalls" :key="tc.id" :data="tc" />
              </template>

              <MessageActions v-if="msg.role === 'assistant'">
                <MessageAction
                  :title="
                    copiedId === msg.id
                      ? t('pg.actions.copied')
                      : t('pg.actions.copy')
                  "
                  @click="copyMessage(msg)"
                >
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
                <MessageAction
                  :title="t('pg.actions.regenerate')"
                  :disabled="chat.isStreaming"
                  @click="regenerateMessage(msg)"
                >
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

              <!-- 用户消息操作区：复制 + 编辑（spec 13） -->
              <MessageActions v-else-if="msg.role === 'user'">
                <MessageAction
                  :title="
                    copiedId === msg.id
                      ? t('pg.actions.copied')
                      : t('pg.actions.copy')
                  "
                  @click="copyMessage(msg)"
                >
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
                <MessageAction
                  :title="t('pg.actions.edit')"
                  :disabled="chat.isStreaming"
                  @click="startEditMessage(msg)"
                >
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
                    <path
                      d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
                    />
                    <path
                      d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
                    />
                  </svg>
                </MessageAction>
              </MessageActions>
            </template>
          </Message>

          <!-- 空窗期反馈已由 MessageContent 内置三点指示接管（消息流内渲染，
               不再叠加独立 typing 气泡——此前双份呈现为"2 个回复"） -->
        </ConversationContent>

        <ConversationScrollBtn
          v-if="!isAtBottom && chat.messages.length > 0"
          @click="scrollToBottom"
        />

        <!-- Input -->
        <div class="pg-input-area">
          <PromptInput
            send-key="enter"
            :before-send="mockUpload"
            @send="onSend"
          >
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

    <!-- Provider 设置弹层（纯 UI 组件，事件交宿主处理；数据源随后端分流） -->
    <ProviderSettingsDialog
      v-model:open="settingsOpen"
      :providers="dialogProviders"
      @create="onCreateProvider"
      @update="onUpdateProvider"
      @remove="onRemoveProvider"
    />
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
  height: 32px;
  padding: 0 12px;
  border: 1px solid var(--ai-chat-color-border);
  border-radius: 6px;
  background: transparent;
  color: var(--ai-chat-color-text-primary);
  font-size: 14px;
  cursor: pointer;
}

.pg-model-selector.open {
  border-color: var(--ai-chat-color-accent);
}

.pg-model-selector svg {
  width: 14px;
  height: 14px;
}

/* 模型下拉菜单：仅当 GET /api/models 有可选项时打开 */
.pg-model-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.pg-model-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  min-width: 220px;
  max-height: 280px;
  overflow-y: auto;
  padding: 4px;
  background: var(--ai-chat-color-bg-primary);
  border: 1px solid var(--ai-chat-color-border);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  z-index: 20;
}

.pg-model-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  height: 32px;
  width: 100%;
  padding: 0 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--ai-chat-color-text-secondary);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: background var(--ai-chat-duration-fast) var(--ai-chat-easing);
}

.pg-model-option:hover {
  background: rgba(128, 128, 128, 0.15);
}

.pg-model-option.selected {
  color: var(--ai-chat-color-accent);
  font-weight: 500;
}

/* ===== 后端选择器（本地 Mock / dev-server 8787） ===== */
.pg-backend-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.pg-backend-selector {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 32px;
  padding: 0 12px;
  border: 1px solid var(--ai-chat-color-border);
  border-radius: 6px;
  background: transparent;
  color: var(--ai-chat-color-text-primary);
  font-size: 14px;
  cursor: pointer;
}

.pg-backend-selector.open {
  border-color: var(--ai-chat-color-accent);
}

.pg-backend-selector svg {
  width: 14px;
  height: 14px;
}

.pg-backend-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  min-width: 200px;
  padding: 4px;
  background: var(--ai-chat-color-bg-primary);
  border: 1px solid var(--ai-chat-color-border);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  z-index: 20;
}

.pg-backend-option {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 2px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--ai-chat-color-text-secondary);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: background var(--ai-chat-duration-fast) var(--ai-chat-easing);
}

.pg-backend-option:hover:not(:disabled) {
  background: rgba(128, 128, 128, 0.15);
}

.pg-backend-option.selected {
  color: var(--ai-chat-color-accent);
  font-weight: 500;
}

/* 探活失败的远端不可选（当前选中项保留可点 = 重试探活） */
.pg-backend-option:disabled {
  cursor: not-allowed;
  color: var(--ai-chat-color-text-muted);
}

.pg-backend-offline {
  margin-left: auto;
  font-size: 11px;
  color: var(--ai-chat-color-text-muted);
}

.pg-backend-option-name {
  display: flex;
  align-items: center;
  gap: 6px;
}

.pg-backend-option-desc {
  font-size: 12px;
  color: var(--ai-chat-color-text-muted);
}

/* 离线/操作失败通知条 */
.pg-notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 8px 16px 0;
  padding: 8px 12px;
  font-size: 12px;
  border-radius: 8px;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.25);
  color: var(--ai-chat-color-text-secondary);
}

.pg-notice-close {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--ai-chat-color-text-muted);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
}

.pg-notice-close:hover {
  background: rgba(128, 128, 128, 0.15);
  color: var(--ai-chat-color-text-primary);
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

/* ===== 消息编辑卡片（spec 13，供 MessageEditor 使用） ===== */
.pg-message-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.pg-message-editor__textarea {
  width: 100%;
  min-height: 44px;
  max-height: 240px;
  padding: 8px 12px;
  border: 1px solid var(--ai-chat-color-border);
  border-radius: var(--ai-chat-radius-md);
  background: var(--ai-chat-color-bg-primary);
  color: var(--ai-chat-color-text-primary);
  font: inherit;
  line-height: 1.6;
  resize: none;
  overflow-y: auto;
}

.pg-message-editor__textarea:focus {
  outline: none;
  border-color: var(--ai-chat-color-accent-500);
}

.pg-message-editor__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.pg-message-editor__btn {
  height: 28px;
  padding: 0 12px;
  border: 1px solid var(--ai-chat-color-border);
  border-radius: var(--ai-chat-radius-sm);
  background: var(--ai-chat-color-bg-primary);
  color: var(--ai-chat-color-text-primary);
  font-size: 13px;
  cursor: pointer;
}

.pg-message-editor__btn--primary {
  background: var(--ai-chat-color-accent-500);
  border-color: var(--ai-chat-color-accent-500);
  color: var(--ai-chat-color-text-on-accent);
}

.pg-message-editor__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ===== 上下文窗口截断提示条（spec 13） ===== */
.pg-context-truncated {
  margin: 4px auto 8px;
  padding: 4px 12px;
  border-radius: 999px;
  background: rgba(128, 128, 128, 0.15);
  color: var(--ai-chat-color-text-secondary);
  font-size: 12px;
  text-align: center;
  width: fit-content;
}

/* ===== 模型项齿轮与窗口 popover（spec 13） ===== */
.pg-model-option-gear {
  display: inline-flex;
  align-items: center;
  padding: 4px;
  border-radius: var(--ai-chat-radius-sm);
  color: var(--ai-chat-color-text-secondary);
  visibility: hidden;
  cursor: pointer;
}

.pg-model-option:hover .pg-model-option-gear,
.pg-model-option.selected .pg-model-option-gear {
  visibility: visible;
}

.pg-model-option-gear:hover {
  background: rgba(128, 128, 128, 0.15);
  color: var(--ai-chat-color-text-primary);
}

.pg-context-popover {
  position: relative;
  margin: 4px 0;
  padding: 10px;
  border-top: 1px solid var(--ai-chat-color-border);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.pg-context-popover__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--ai-chat-color-text-primary);
}

.pg-context-popover__input {
  height: 30px;
  padding: 0 8px;
  border: 1px solid var(--ai-chat-color-border);
  border-radius: var(--ai-chat-radius-sm);
  background: var(--ai-chat-color-bg-primary);
  color: var(--ai-chat-color-text-primary);
  font-size: 13px;
}

.pg-context-popover__hint {
  font-size: 12px;
  color: var(--ai-chat-color-text-secondary);
  line-height: 1.5;
}

.pg-context-popover__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
