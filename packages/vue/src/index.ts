// Styles
import './styles/tokens.css'
import './styles/animations.css'

// Shared components
export { default as StreamText } from './shared/StreamText.vue'
export { default as Button } from './shared/Button.vue'
export { default as Shimmer } from './shared/Shimmer.vue'

// Conversation series
export {
  Conversation,
  ConversationContent,
  ConversationEmpty,
  ConversationScrollBtn,
} from './conversation'

// Composables
export { useScrollAnchor } from './composables/useScrollAnchor'

// Old components (deprecated, will be removed in v1.0.0)
/** @deprecated Use Conversation + ConversationContent instead */
export { default as ChatWindow } from './ChatWindow.vue'
/** @deprecated Use ConversationContent with v-for directly instead */
export { default as MessageList } from './MessageList.vue'
/** @deprecated Use Message + MessageContent instead */
export { default as MessageBubble } from './MessageBubble.vue'
/** @deprecated Use PromptInput instead */
export { default as InputArea } from './InputArea.vue'
