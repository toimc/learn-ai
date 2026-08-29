import { aiChatI18n } from '@toimc/vue'

const zhCN = {
  sidebar: {
    collapse: '收起侧边栏',
    newChat: '新对话',
    searchPlaceholder: '搜索对话...',
    rename: '重命名',
    remove: '删除',
    empty: '暂无对话',
    today: '今天',
    last7: '过去 7 天',
    confirmRemove: '确定删除「{title}」吗？',
  },
  layout: {
    switchToIm: '切换为 IM 左右分列',
    switchToStacked: '切换为统一对齐',
  },
  theme: {
    toggle: '切换主题',
    clearConfirm: '确定清空所有自定义覆盖?',
    applyPreset: '应用主题预设',
    presetPlaceholder: '预设…',
    editMode: '编辑模式',
    editLight: '编辑亮色',
    editDark: '编辑暗色',
    light: '亮色',
    dark: '暗色',
    searchTokens: '搜索令牌…',
    exportAll: '导出全部令牌(否则仅导出改动)',
    exportAllLabel: '全量导出',
    helpTitle: '使用说明',
    helpLabel: '说明',
    reset: '重置',
    import: '导入',
    save: '保存',
    exportCss: '导出 CSS',
    dragWidth: '拖拽调整宽度',
    noMatch: '未找到匹配的令牌',
    previewInput: '预览输入框…',
  },
  welcome: {
    title: '有什么可以帮你的？',
    subtitle: '选择一个话题开始，或直接输入你的问题',
  },
  actions: {
    copy: '复制',
    copied: '已复制',
    regenerate: '重新生成',
    preferred: '你更喜欢的回复：{chosen}',
    edit: '编辑',
    confirmEdit: '确认',
    cancelEdit: '取消',
  },
  tools: {
    upload: '上传文件',
    webSearch: '网页搜索',
    codeInterpreter: '代码解释器',
    imageGen: '图片生成',
  },
  input: {
    placeholder: '给 AI Chat UI 发送消息...',
    hint: 'Enter 换行，Alt+Enter 发送；支持粘贴/拖拽上传',
  },
  multimodalDemo: {
    title: '多模态输入',
    description:
      '三种入口添加附件：点击图标选择、⌘V/Ctrl+V 粘贴、拖拽到输入框；Enter 换行、Alt+Enter 发送。发送前经 mock 上传（800ms），超限（>5 个或 >10MB）会 Toast 拒绝。',
    payloadTitle: '最近一次 send 事件 payload',
    payloadEmpty: '尚未发送——输入文字、附一张图片，然后按 Alt+Enter 试试',
    reset: '清空',
  },
  thinkingDemo: {
    simulate: '模拟一次流式思考',
    replay: '重播',
    userQuestion: 'Vue 3 的响应式系统为什么用 Proxy 重写？',
  },
  mockServer: {
    title: 'Mock 服务端演示',
    description:
      '会话数据与流式回复均来自本地 dev-server（Hono + streamSSE）：切换会话从服务端拉取历史，发送消息经真实 HTTP/SSE 传输，DevTools Network 面板可见 text/event-stream 响应。',
    statusOnline: '已连接',
    statusConnecting: '连接中…',
    statusOffline: '未连接',
    retry: '重试',
    offlineHint:
      '无法连接 dev-server（http://localhost:8787）。请在项目根目录运行 pnpm dev（同时启动文档站与 mock 服务）后重试。',
    loadingMessages: '正在从服务端加载会话消息…',
    loadFailed: '会话消息加载失败',
    newChat: '新建会话',
    inputPlaceholder: '连接 dev-server，发送消息体验真实 SSE 流式…',
    scenarioHint: '触发词：思考 / 工具 天气 / 错误 / 慢速 / markdown',
    triggerThinking: '发送「思考」触发思维链流式演示',
    triggerTool: '发送「工具 天气」触发工具调用演示',
    triggerError: '发送「错误」触发流中断演示',
    triggerSlow: '发送「慢速」触发慢速输出演示',
    triggerMarkdown: '发送「markdown」触发富文本演示',
    conversationLabel: '服务端会话',
    localConversation: '本地新建（未同步服务端列表）',
  },
  mockApi: {
    bannerOnline: '接口文档已连接 dev-server，可直接执行 Test Request',
    bannerConnecting: '正在连接 dev-server…',
    bannerOffline:
      'dev-server 未启动（http://localhost:8787），请先运行 pnpm dev',
    goDemo: '去流式演示 →',
  },
  chat: {
    sendFailed: '发送失败：{msg}',
    contextTruncated: '已省略 {n} 条较早消息（超出上下文窗口）',
  },
  providerSettings: {
    open: '设置 Provider',
    offlineHint:
      '无法连接 dev-server（http://localhost:8787），暂时无法配置 Provider。请在项目根目录运行 pnpm dev 后重试。',
    actionFailed: '操作失败：{message}',
    dismiss: '知道了',
  },
  providerChat: {
    selectModel: '选择模型（对新会话生效）',
    modelDefault: 'AI Chat UI',
    modelDefaultOption: '默认（本地演示）',
    contextWindow: '上下文窗口（token）',
    contextWindowPlaceholder: '0 = 不限制',
    contextWindowHint: '超出窗口时自动省略最旧消息（仅影响发送，不删聊天记录）',
  },
  backend: {
    label: '后端（对新会话生效）',
    local: '本地 Mock',
    localDesc: '前端内置剧本，离线可用，零依赖',
    devServer: 'dev-server · 8787',
    devServerDesc: "{'@'}toimc/server 网关 + SSE 线协议（模型下拉选择）",
    offline: '（离线）',
    offlineHint: '无法连接 {url}，请先启动对应服务后再切换。',
  },
  multiAgent: {
    title: '多 Agent 协作演示',
    description:
      '同一问题、三种编排形态（委托 / 并行 / 流水线）：发送前自动在消息最前注入形态指令 system 消息，orchestrate 工具的协作过程以卡片呈现，回复经 SSE 来自本地 dev-server。',
    patternLabel: '编排形态',
    patternDelegate: '委托',
    patternParallel: '并行',
    patternPipeline: '流水线',
    patternDescDelegate:
      'researcher 检索 → writer 起草，两步委托（Explorer/Executor）',
    patternDescParallel:
      'researcher ×3 从三个角度并行检索，结果并列呈现，综合汇报交给 orchestrator',
    patternDescPipeline:
      '检索 → 起草 → 审查；审查不过打回重写一次（重写后不再复审）',
    presetLabel: '示例问题',
    statusOnline: '已连接',
    statusConnecting: '连接中…',
    statusOffline: '未连接',
    retry: '重试',
    offlineHint:
      '无法连接 dev-server（http://localhost:8787）。请在项目根目录运行 pnpm dev（同时启动文档站与 dev 服务）后重试。',
    modeMock: 'mock 剧本回放',
    modeOrchestrator: 'orchestrator-agent 真实编排',
    inputPlaceholder: '选择形态与示例问题，发送体验多 Agent 协作…',
    emptyHint: '同一问题切换三种形态，对比编排行为与协作卡片。',
    directiveBadge: '形态指令',
    card: {
      badgeDelegate: '委托',
      badgeParallel: '并行',
      badgePipeline: '流水线',
      agentsCount: '{n} 个子 Agent',
      totalDuration: '总耗时 {ms} ms',
      roleResearcher: '检索员',
      roleWriter: '起草员',
      roleReviewer: '审查员',
      retried: '已打回重写',
      verdictPass: '审查通过',
      verdictRevise: '需修订',
      showOutput: '产出',
      hideOutput: '收起',
      parallelNote: '三路并行检索（单路失败不影响其余两路）',
      invalidTitle: '协作结果结构异常，以下为原始 JSON：',
      pending: '编排进行中…',
    },
  },
}

const enUS: typeof zhCN = {
  sidebar: {
    collapse: 'Collapse sidebar',
    newChat: 'New chat',
    searchPlaceholder: 'Search conversations...',
    rename: 'Rename',
    remove: 'Delete',
    empty: 'No conversations',
    today: 'Today',
    last7: 'Last 7 days',
    confirmRemove: 'Delete "{title}"?',
  },
  layout: {
    switchToIm: 'Switch to IM layout',
    switchToStacked: 'Switch to stacked layout',
  },
  theme: {
    toggle: 'Toggle theme',
    clearConfirm: 'Clear all custom overrides?',
    applyPreset: 'Apply theme preset',
    presetPlaceholder: 'Preset…',
    editMode: 'Edit mode',
    editLight: 'Edit light theme',
    editDark: 'Edit dark theme',
    light: 'Light',
    dark: 'Dark',
    searchTokens: 'Search tokens…',
    exportAll: 'Export all tokens (otherwise only changes)',
    exportAllLabel: 'Export all',
    helpTitle: 'Instructions',
    helpLabel: 'Help',
    reset: 'Reset',
    import: 'Import',
    save: 'Save',
    exportCss: 'Export CSS',
    dragWidth: 'Drag to resize',
    noMatch: 'No matching tokens',
    previewInput: 'Preview input…',
  },
  welcome: {
    title: 'How can I help you?',
    subtitle: 'Pick a topic to get started, or type your question',
  },
  actions: {
    copy: 'Copy',
    copied: 'Copied',
    regenerate: 'Regenerate',
    preferred: 'Your preferred response: {chosen}',
    edit: 'Edit',
    confirmEdit: 'Confirm',
    cancelEdit: 'Cancel',
  },
  tools: {
    upload: 'Upload file',
    webSearch: 'Web search',
    codeInterpreter: 'Code interpreter',
    imageGen: 'Image generation',
  },
  input: {
    placeholder: 'Send a message to AI Chat UI...',
    hint: 'Enter for newline, Alt+Enter to send; paste/drag to upload',
  },
  multimodalDemo: {
    title: 'Multimodal Input',
    description:
      'Add attachments three ways: click the icons, paste (⌘V/Ctrl+V), or drag files onto the input; Enter for newline, Alt+Enter to send. Mock upload takes 800ms; limits (>5 files or >10MB) are rejected with a toast.',
    payloadTitle: 'Last send event payload',
    payloadEmpty:
      'Nothing sent yet — type something, attach an image, then press Alt+Enter',
    reset: 'Clear',
  },
  thinkingDemo: {
    simulate: 'Simulate streaming thinking',
    replay: 'Replay',
    userQuestion: 'Why was Vue 3 reactivity rewritten with Proxy?',
  },
  mockServer: {
    title: 'Mock Server Demo',
    description:
      'Conversations and streaming replies come from the local dev-server (Hono + streamSSE): switching conversations fetches history from the server; sending messages goes over real HTTP/SSE — watch the text/event-stream response in DevTools Network panel.',
    statusOnline: 'Connected',
    statusConnecting: 'Connecting…',
    statusOffline: 'Offline',
    retry: 'Retry',
    offlineHint:
      'Cannot reach dev-server (http://localhost:8787). Run pnpm dev at the project root (starts the docs site and the mock server together), then retry.',
    loadingMessages: 'Loading conversation messages from server…',
    loadFailed: 'Failed to load messages',
    newChat: 'New conversation',
    inputPlaceholder:
      'Connected to dev-server — send a message to see real SSE streaming…',
    scenarioHint:
      'Trigger words: thinking / tool weather / error / slow / markdown',
    triggerThinking: 'Send “思考” to trigger streaming thinking',
    triggerTool: 'Send “工具 天气” to trigger a tool call',
    triggerError: 'Send “错误” to trigger a mid-stream error',
    triggerSlow: 'Send “慢速” to trigger slow streaming',
    triggerMarkdown: 'Send “markdown” to trigger rich text',
    conversationLabel: 'Server conversations',
    localConversation: 'Created locally (not synced to server list)',
  },
  mockApi: {
    bannerOnline: 'API docs connected to dev-server — Test Request is ready',
    bannerConnecting: 'Connecting to dev-server…',
    bannerOffline:
      'dev-server is not running (http://localhost:8787). Run pnpm dev first',
    goDemo: 'Streaming demo →',
  },
  chat: {
    sendFailed: 'Send failed: {msg}',
    contextTruncated: '{n} earlier messages omitted (context window exceeded)',
  },
  providerSettings: {
    open: 'Configure providers',
    offlineHint:
      'Cannot reach dev-server (http://localhost:8787) — provider settings are unavailable. Run pnpm dev at the project root, then retry.',
    actionFailed: 'Action failed: {message}',
    dismiss: 'Got it',
  },
  providerChat: {
    selectModel: 'Select model (applies to new chats)',
    modelDefault: 'AI Chat UI',
    modelDefaultOption: 'Default (local demo)',
    contextWindow: 'Context window (tokens)',
    contextWindowPlaceholder: '0 = unlimited',
    contextWindowHint:
      'Oldest messages are omitted when exceeded (send-only, chat history kept)',
  },
  backend: {
    label: 'Backend (applies to new chats)',
    local: 'Local mock',
    localDesc: 'Built-in frontend scripts, works offline, zero deps',
    devServer: 'dev-server · 8787',
    devServerDesc:
      "{'@'}toimc/server gateway + SSE protocol (pick model in dropdown)",
    offline: ' (offline)',
    offlineHint: 'Cannot reach {url} — start the service first, then switch.',
  },
  multiAgent: {
    title: 'Multi-Agent Collaboration Demo',
    description:
      'One question, three orchestration patterns (delegate / parallel / pipeline): a pattern directive system message is injected at the front before sending; the orchestrate tool renders a collaboration card; replies stream from the local dev-server over SSE.',
    patternLabel: 'Orchestration pattern',
    patternDelegate: 'Delegate',
    patternParallel: 'Parallel',
    patternPipeline: 'Pipeline',
    patternDescDelegate:
      'researcher retrieves → writer drafts, two-step delegation (Explorer/Executor)',
    patternDescParallel:
      '3 researchers retrieve in parallel from three angles; synthesis is left to the orchestrator',
    patternDescPipeline:
      'retrieve → draft → review; a failed review triggers one rewrite (no re-review after)',
    presetLabel: 'Sample questions',
    statusOnline: 'Connected',
    statusConnecting: 'Connecting…',
    statusOffline: 'Offline',
    retry: 'Retry',
    offlineHint:
      'Cannot reach dev-server (http://localhost:8787). Run pnpm dev at the project root (starts the docs site and the dev server together), then retry.',
    modeMock: 'Mock script replay',
    modeOrchestrator: 'orchestrator-agent live orchestration',
    inputPlaceholder: 'Pick a pattern and a sample question, then send…',
    emptyHint:
      'Switch between the three patterns on the same question and compare behaviors and collaboration cards.',
    directiveBadge: 'Pattern directive',
    card: {
      badgeDelegate: 'Delegate',
      badgeParallel: 'Parallel',
      badgePipeline: 'Pipeline',
      agentsCount: '{n} sub-agents',
      totalDuration: 'Total {ms} ms',
      roleResearcher: 'Researcher',
      roleWriter: 'Writer',
      roleReviewer: 'Reviewer',
      retried: 'Rewritten after review',
      verdictPass: 'Review passed',
      verdictRevise: 'Needs revision',
      showOutput: 'Output',
      hideOutput: 'Hide',
      parallelNote:
        'Three parallel retrievals (one lane failing does not affect the others)',
      invalidTitle: 'Unexpected collaboration result — raw JSON below:',
      pending: 'Orchestrating…',
    },
  },
}

// setLocaleMessage 是整体替换（非深合并），必须带上库原有字典再合并 pg，
// 直接传 { pg } 会抹掉库内置文案。
function mergeInto(locale: 'zh-CN' | 'en-US', pg: Record<string, unknown>) {
  aiChatI18n.global.setLocaleMessage(locale, {
    ...aiChatI18n.global.getLocaleMessage(locale),
    pg,
  })
}
mergeInto('zh-CN', zhCN)
mergeInto('en-US', enUS)
