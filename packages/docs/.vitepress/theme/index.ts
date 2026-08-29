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
  MessageAttachments,
  // Comparison series
  ComparisonMessage,
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
  Toast,
  // Markdown renderer inject key
  markdownRendererKey,
} from '@toimc/vue'
import { MarkdownRenderer, CodeBlock, LatexBlock } from '@toimc/markdown'
// FR-4（spec 04）：KaTeX 样式已改为可选子路径，docs 站显式引入保持公式渲染体验。
// docs 走 workspace 源码别名，直接引源码 css；发布包对应 '@toimc/markdown/katex.css'
import '../../../markdown/src/styles/katex.css'

import DemoContainer from '../components/DemoContainer.vue'
import {
  PlaygroundPage,
  ThemeBuilderPage,
  MultimodalDemoPage,
  ConversationLayoutDemo,
  MessageShowcaseDemo,
  ConversationScrollDemo,
  ThinkingMessageDemo,
  ComparisonFlowDemo,
  AttachmentsMessageDemo,
} from '@toimc/playground'

import './style.css'

// Pages 构建剔除 mock 页面组件：config.ts 的 vite.define 把该值替换为字面量，
// 分支被常量折叠后动态 import 不进产物，Scalar standalone（~1MB+）不进 Pages bundle
const isPagesBuild = import.meta.env.DOCS_TARGET === 'pages'

export default {
  extends: DefaultTheme,
  async enhanceApp({ app }) {
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
    app.component('MessageAttachments', MessageAttachments)

    // Comparison
    app.component('ComparisonMessage', ComparisonMessage)

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
    app.component('Toast', Toast)

    // Markdown
    app.component('MarkdownRenderer', MarkdownRenderer)
    app.component('CodeBlock', CodeBlock)
    app.component('LatexBlock', LatexBlock)
    // 经 app.provide 注入，MessageContent 收到 content prop 即自动走 MarkdownRenderer
    app.provide(markdownRendererKey, MarkdownRenderer)

    // Docs
    app.component('DemoContainer', DemoContainer)
    app.component('PlaygroundPage', PlaygroundPage)
    app.component('ThemeBuilderPage', ThemeBuilderPage)
    app.component('MultimodalDemoPage', MultimodalDemoPage)
    if (!isPagesBuild) {
      const {
        MockServerDemoPage,
        MultiAgentDemoPage,
        WorkflowDemoPage,
        MockApiPage,
      } = await import('@toimc/playground')
      app.component('MockServerDemoPage', MockServerDemoPage)
      app.component('MultiAgentDemoPage', MultiAgentDemoPage)
      app.component('WorkflowDemoPage', WorkflowDemoPage)
      app.component('MockApiPage', MockApiPage)
    }
    // 组件文档内嵌交互演示
    app.component('ConversationLayoutDemo', ConversationLayoutDemo)
    app.component('MessageShowcaseDemo', MessageShowcaseDemo)
    app.component('ConversationScrollDemo', ConversationScrollDemo)
    app.component('ThinkingMessageDemo', ThinkingMessageDemo)
    app.component('ComparisonFlowDemo', ComparisonFlowDemo)
    app.component('AttachmentsMessageDemo', AttachmentsMessageDemo)
  },
} satisfies Theme
