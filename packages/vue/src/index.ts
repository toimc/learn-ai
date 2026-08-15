// Styles
import './styles/tokens.css'
import './styles/animations.css'

// Shared components
export { default as StreamText } from './shared/StreamText.vue'
export { default as Button } from './shared/Button.vue'
export { default as Shimmer } from './shared/Shimmer.vue'
export { default as Toast } from './shared/Toast.vue'

// Conversation series
export {
  Conversation,
  ConversationContent,
  ConversationEmpty,
  ConversationScrollBtn,
} from './conversation'

// Composables
export { useScrollAnchor } from './composables/useScrollAnchor'
export {
  markdownRendererKey,
  provideMarkdownRenderer,
  useMarkdownRenderer,
} from './composables/useMarkdownRenderer'

// Message series
export {
  Message,
  MessageContent,
  MessageActions,
  MessageAction,
  MessageAttachments,
} from './message'

// PromptInput series
export {
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
  PromptInputButton,
  PromptInputSubmit,
  PromptInputHeader,
} from './prompt-input'

// Comparison series
export { ComparisonMessage } from './comparison'

// Attachment series
export {
  Attachments,
  Attachment,
  AttachmentPreview,
  AttachmentInfo,
  AttachmentRemove,
  AttachmentEmpty,
} from './attachment'

// ToolCall series
export {
  ToolCall,
  ToolCallHeader,
  ToolCallContent,
  ToolCallInput,
  ToolCallOutput,
} from './tool-call'

// Preview series
export { ImageLightbox } from './preview'

// Old components (deprecated, will be removed in v1.0.0)
/** @deprecated Use Conversation + ConversationContent instead */
export { default as ChatWindow } from './ChatWindow.vue'
/** @deprecated Use ConversationContent with v-for directly instead */
export { default as MessageList } from './MessageList.vue'
/** @deprecated Use Message + MessageContent instead */
export { default as MessageBubble } from './MessageBubble.vue'
/** @deprecated Use PromptInput instead */
export { default as InputArea } from './InputArea.vue'

// 主题系统
export { useTheme, resolvedTheme, componentTheme } from './composables/useTheme'
export type {
  ThemeMode,
  ResolvedTheme,
  ThemeTarget,
  UseThemeOptions,
} from './composables/useTheme'
export { useThemePreset } from './composables/useThemePreset'
export { presets } from './theme/presets'
export type { ThemePreset, PresetKey } from './theme/presets'
export { tokensMeta } from './theme/tokens-meta'
export type { TokenMeta, TokenType, TokenLayer } from './theme/tokens-meta'

// 布局配置
export { useLayoutConfig } from './composables/useLayoutConfig'
export type {
  LayoutConfig,
  LayoutConfigResult,
} from './composables/useLayoutConfig'
export type { MessageLayout, MessageAlign } from './composables/layout-types'
