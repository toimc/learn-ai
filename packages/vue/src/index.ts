// Styles
import './styles/tokens.css'
import './styles/animations.css'

// Shared components
export { default as StreamText } from './shared/StreamText.vue'
export { default as Button } from './shared/Button.vue'
export { default as Input } from './shared/Input.vue'
export { default as Select } from './shared/Select.vue'
export { default as Radio } from './shared/Radio.vue'
export { default as Shimmer } from './shared/Shimmer.vue'
export { default as Toast } from './shared/Toast.vue'
export { default as LanguageToggle } from './shared/LanguageToggle.vue'
export { default as ModelIcon } from './shared/ModelIcon.vue'
export { default as JsonDiffView } from './shared/JsonDiffView.vue'

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
  ThinkingBlock,
  MessageFeedback,
  BranchPicker,
} from './message'

// Message preset actions
export {
  MessageActionCopy,
  MessageActionRetry,
  MessageActionEdit,
  MessageActionFeedback,
} from './message/actions'

// Thinking series
export { ThinkingChain } from './thinking'

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
  PromptInputUploadButton,
  PromptInputAttachments,
  PromptInputSuggestion,
  parseSuggestion,
  filterSuggestions,
} from './prompt-input'
export type { SuggestionItem, SuggestionTrigger } from './prompt-input'

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
export { ToolConfirmation } from './tool-call'

// Citation series
export { InlineCitation, Sources, isSafeHttpUrl } from './citation'

// Welcome series
export { Welcome, Prompts } from './welcome'
export type { PromptItem } from './welcome'

// Preview series
export { ImageLightbox } from './preview'

// Provider settings
export { ProviderSettingsDialog } from './provider'
export type { ProviderOption, ProviderFormPayload } from './provider'

// Old components (deprecated, will be removed in v1.0.0)
/** @deprecated Use Conversation + ConversationContent instead */
export { default as ChatWindow } from './deprecated/ChatWindow.vue'
/** @deprecated Use ConversationContent with v-for directly instead */
export { default as MessageList } from './deprecated/MessageList.vue'
/** @deprecated Use Message + MessageContent instead */
export { default as MessageBubble } from './deprecated/MessageBubble.vue'
/** @deprecated Use PromptInput instead */
export { default as InputArea } from './deprecated/InputArea.vue'

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

// i18n
export type { LocaleOption, AiChatLocale, MessageSchema } from './locales'
export { aiChatI18n, setAiChatLocale, getInitialLocale } from './locales'

// 布局配置
export { useLayoutConfig } from './composables/useLayoutConfig'
export type {
  LayoutConfig,
  LayoutConfigResult,
} from './composables/useLayoutConfig'
export type { MessageLayout, MessageAlign } from './composables/layout-types'

// Clipboard composable（core copyText 的响应式包装）
export { useClipboard } from './composables/useClipboard'
