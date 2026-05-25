import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'

import {
  // Old components (deprecated)
  ChatWindow,
  MessageList,
  MessageBubble,
  InputArea,
  StreamText,
  Button as AiButton,
  // Conversation series
  Conversation,
  ConversationContent,
  ConversationEmpty,
  ConversationScrollBtn,
  // Message series
  Message,
  MessageContent,
  MessageActions,
  MessageAction,
  // PromptInput series
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
  PromptInputButton,
  PromptInputSubmit,
  PromptInputHeader,
  // Attachment series
  Attachments,
  Attachment,
  AttachmentPreview,
  AttachmentInfo,
  AttachmentRemove,
  AttachmentEmpty,
  // ToolCall series
  ToolCall,
  ToolCallHeader,
  ToolCallContent,
  ToolCallInput,
  ToolCallOutput,
  // Shared
  Shimmer,
} from '@ai-chat/vue'
import { MarkdownRenderer, CodeBlock, LatexBlock } from '@ai-chat/markdown'

import DemoContainer from '../components/DemoContainer.vue'
import PlaygroundDemo from '../components/PlaygroundDemo.vue'

import './style.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    // Old components (backward compat)
    app.component('ChatWindow', ChatWindow)
    app.component('MessageList', MessageList)
    app.component('MessageBubble', MessageBubble)
    app.component('InputArea', InputArea)
    app.component('StreamText', StreamText)
    app.component('Button', AiButton)

    // Conversation
    app.component('Conversation', Conversation)
    app.component('ConversationContent', ConversationContent)
    app.component('ConversationEmpty', ConversationEmpty)
    app.component('ConversationScrollBtn', ConversationScrollBtn)

    // Message
    app.component('Message', Message)
    app.component('MessageContent', MessageContent)
    app.component('MessageActions', MessageActions)
    app.component('MessageAction', MessageAction)

    // PromptInput
    app.component('PromptInput', PromptInput)
    app.component('PromptInputBody', PromptInputBody)
    app.component('PromptInputTextarea', PromptInputTextarea)
    app.component('PromptInputFooter', PromptInputFooter)
    app.component('PromptInputTools', PromptInputTools)
    app.component('PromptInputButton', PromptInputButton)
    app.component('PromptInputSubmit', PromptInputSubmit)
    app.component('PromptInputHeader', PromptInputHeader)

    // Attachment
    app.component('Attachments', Attachments)
    app.component('Attachment', Attachment)
    app.component('AttachmentPreview', AttachmentPreview)
    app.component('AttachmentInfo', AttachmentInfo)
    app.component('AttachmentRemove', AttachmentRemove)
    app.component('AttachmentEmpty', AttachmentEmpty)

    // ToolCall
    app.component('ToolCall', ToolCall)
    app.component('ToolCallHeader', ToolCallHeader)
    app.component('ToolCallContent', ToolCallContent)
    app.component('ToolCallInput', ToolCallInput)
    app.component('ToolCallOutput', ToolCallOutput)

    // Shared
    app.component('Shimmer', Shimmer)

    // Markdown
    app.component('MarkdownRenderer', MarkdownRenderer)
    app.component('CodeBlock', CodeBlock)
    app.component('LatexBlock', LatexBlock)

    // Docs
    app.component('DemoContainer', DemoContainer)
    app.component('PlaygroundDemo', PlaygroundDemo)
  },
} satisfies Theme
