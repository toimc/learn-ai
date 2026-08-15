import { defineConfig } from 'vitepress'
import { resolve } from 'path'

const root = resolve(__dirname, '..')

export default defineConfig({
  lang: 'zh-CN',
  title: 'AI Chat UI',
  description: '后端无关的 AI 聊天界面组件库',

  head: [
    // 首屏防闪：在 Vue 挂载前同步读取 localStorage 设 data-theme，避免亮暗闪屏
    [
      'script',
      {},
      `(function(){try{var t=localStorage.getItem('ai-chat-theme')||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.setAttribute('data-theme',d?'dark':'light');}catch(e){}})();`,
    ],
  ],

  vite: {
    resolve: {
      alias: {
        '@ai-chat/core': resolve(root, '../core/src/index.ts'),
        '@ai-chat/vue': resolve(root, '../vue/src/index.ts'),
        '@ai-chat/markdown': resolve(root, '../markdown/src/index.ts'),
        '@ai-chat/playground': resolve(root, '../playground/src/index.ts'),
      },
    },
  },

  themeConfig: {
    siteTitle: 'AI Chat UI',

    nav: [
      { text: '指南', link: '/guide/getting-started' },
      { text: '组件', link: '/components/conversation' },
      {
        text: 'Composables',
        items: [
          { text: 'useChat', link: '/composables/use-chat' },
          { text: 'useTheme', link: '/composables/use-theme' },
          { text: 'useThemePreset', link: '/composables/use-theme-preset' },
          { text: 'useLayoutConfig', link: '/composables/use-layout-config' },
        ],
      },
      { text: 'Playground', link: '/playground' },
      { text: '主题配置器', link: '/theme-builder' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: '开发指南',
          items: [
            { text: '快速开始', link: '/guide/getting-started' },
            { text: '安装', link: '/guide/installation' },
            { text: '使用指南', link: '/guide/usage' },
            { text: '主题定制', link: '/guide/theming' },
            { text: '主题配置器', link: '/theme-builder' },
          ],
        },
      ],
      '/components/': [
        {
          text: '对话容器',
          items: [{ text: 'Conversation', link: '/components/conversation' }],
        },
        {
          text: '消息组件',
          items: [
            { text: 'Message', link: '/components/message' },
            {
              text: 'ComparisonMessage',
              link: '/components/comparison-message',
            },
          ],
        },
        {
          text: '输入组件',
          items: [{ text: 'PromptInput', link: '/components/prompt-input' }],
        },
        {
          text: '附件与工具调用',
          items: [
            { text: 'Attachments', link: '/components/attachments' },
            { text: 'ToolCall', link: '/components/tool-call' },
            { text: 'Shimmer', link: '/components/shimmer' },
            { text: 'Toast', link: '/components/toast' },
            { text: 'ImageLightbox', link: '/components/image-lightbox' },
          ],
        },
        {
          text: '旧版组件',
          items: [
            { text: 'ChatWindow', link: '/components/chat-window' },
            { text: 'MessageList', link: '/components/message-list' },
            { text: 'MessageBubble', link: '/components/message-bubble' },
            { text: 'InputArea', link: '/components/input-area' },
            { text: 'StreamText', link: '/components/stream-text' },
            { text: 'Button', link: '/components/button' },
          ],
        },
        {
          text: 'Markdown 渲染',
          items: [
            { text: 'MarkdownRenderer', link: '/components/markdown-renderer' },
            { text: 'CodeBlock', link: '/components/code-block' },
            { text: 'LatexBlock', link: '/components/latex-block' },
          ],
        },
      ],
      '/composables/': [
        {
          text: 'Composables',
          items: [
            { text: 'useChat', link: '/composables/use-chat' },
            { text: 'useTheme', link: '/composables/use-theme' },
            { text: 'useThemePreset', link: '/composables/use-theme-preset' },
            { text: 'useLayoutConfig', link: '/composables/use-layout-config' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/ai-chat-ui/ai-chat-ui' },
    ],

    search: {
      provider: 'local',
    },
  },
})
