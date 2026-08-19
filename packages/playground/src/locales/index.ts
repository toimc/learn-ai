import { aiChatI18n } from '@ai-chat/vue'

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
    regenerate: '重新生成',
    preferred: '你更喜欢的回复：{chosen}',
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
    regenerate: 'Regenerate',
    preferred: 'Your preferred response: {chosen}',
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
