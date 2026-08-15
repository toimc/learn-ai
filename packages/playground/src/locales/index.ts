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
  },
  tools: {
    upload: '上传文件',
    webSearch: '网页搜索',
    codeInterpreter: '代码解释器',
    imageGen: '图片生成',
  },
  input: {
    placeholder: '给 AI Chat UI 发送消息...',
    hint: 'Enter 发送，Shift+Enter 换行',
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
  },
  tools: {
    upload: 'Upload file',
    webSearch: 'Web search',
    codeInterpreter: 'Code interpreter',
    imageGen: 'Image generation',
  },
  input: {
    placeholder: 'Send a message to AI Chat UI...',
    hint: 'Enter to send, Shift+Enter for newline',
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
