import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'

import {
  ChatWindow,
  MessageList,
  MessageBubble,
  InputArea,
  StreamText,
  Button as AiButton,
} from '@ai-chat/vue'
import { MarkdownRenderer, CodeBlock, LatexBlock } from '@ai-chat/markdown'

import DemoContainer from '../components/DemoContainer.vue'

import './style.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('ChatWindow', ChatWindow)
    app.component('MessageList', MessageList)
    app.component('MessageBubble', MessageBubble)
    app.component('InputArea', InputArea)
    app.component('StreamText', StreamText)
    app.component('Button', AiButton)

    app.component('MarkdownRenderer', MarkdownRenderer)
    app.component('CodeBlock', CodeBlock)
    app.component('LatexBlock', LatexBlock)

    app.component('DemoContainer', DemoContainer)
  },
} satisfies Theme
