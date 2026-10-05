import { defineConfig } from 'vitepress'
import type { DefaultTheme } from 'vitepress'
import { resolve } from 'path'

const root = resolve(__dirname, '..')

// GitHub Pages 发布构建开关：DOCS_TARGET=pages 时剔除依赖本地 dev-server 的页面（spec 08 FR-2）
const isPages = process.env.DOCS_TARGET === 'pages'

// 仅本地开发可用的导航项（依赖 pnpm dev 同时启动的 dev-server）：
// 关联演示合并为单一下拉，避免顶栏被演示入口挤占
const mockOnlyNav: DefaultTheme.NavItem[] = [
  {
    text: '演示',
    items: [
      { text: '向量检索演示', link: '/vector-search-demo' },
      { text: 'Mock 演示', link: '/mock-server-demo' },
      { text: '多 Agent 演示', link: '/multi-agent-demo' },
      { text: 'Workflow 演示', link: '/workflow-demo' },
      { text: '接口文档', link: '/mock-api' },
    ],
  },
]

export default defineConfig({
  lang: 'zh-CN',
  title: 'AI Chat UI',
  description: '后端无关的 AI 聊天界面组件库',
  base: process.env.BASE_PATH || '/',
  srcExclude: isPages
    ? [
        'vector-search-demo.md',
        'mock-server-demo.md',
        'multi-agent-demo.md',
        'workflow-demo.md',
        'mock-api.md',
      ]
    : [],
  // 死链检查是静态 AST 扫描，MockOnly 的运行时条件渲染豁免不了它；
  // 仅 pages 模式精确放行被剔除页面的链接（playground.md 内 MockOnly 包裹的提示块）。
  // localhost 链接指向运行时服务（如 Studio 4111），静态构建无法验证，两模式均放行
  ignoreDeadLinks: [
    /^https?:\/\/localhost(?::\d+)?/,
    ...(isPages
      ? [
          '/vector-search-demo',
          '/mock-server-demo',
          '/multi-agent-demo',
          '/workflow-demo',
          '/mock-api',
        ]
      : []),
  ],

  head: [
    // 首屏防闪：在 Vue 挂载前同步读取 localStorage 设 data-theme，避免亮暗闪屏
    [
      'script',
      {},
      `(function(){try{var t=localStorage.getItem('ai-chat-theme')||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.setAttribute('data-theme',d?'dark':'light');}catch(e){}})();`,
    ],
  ],

  vite: {
    define: {
      // 构建期注入字面量：客户端组件（MockOnly）与 theme 的条件分支据此做常量折叠
      'import.meta.env.DOCS_TARGET': JSON.stringify(
        process.env.DOCS_TARGET ?? '',
      ),
    },
    resolve: {
      alias: {
        '@toimc/core': resolve(root, '../core/src/index.ts'),
        '@toimc/vue': resolve(root, '../vue/src/index.ts'),
        '@toimc/markdown': resolve(root, '../markdown/src/index.ts'),
        '@toimc/playground': resolve(root, '../playground/src/index.ts'),
        // Scalar 免 React 的 standalone 构建（exports 未放行深路径，alias 绕过）
        '@scalar/api-reference-standalone': resolve(
          root,
          'node_modules/@scalar/api-reference/dist/browser/standalone.esm.js',
        ),
      },
    },
  },

  themeConfig: {
    siteTitle: 'AI Chat UI',

    nav: [
      {
        text: '指南',
        items: [
          {
            text: '使用',
            items: [
              { text: '快速开始', link: '/guide/getting-started' },
              { text: '安装', link: '/guide/installation' },
              { text: '使用指南', link: '/guide/usage' },
              { text: '主题定制', link: '/guide/theming' },
              { text: '国际化', link: '/guide/i18n' },
            ],
          },
          {
            // 与左侧栏「智能体&服务」分组对齐
            text: '智能体与服务',
            items: [
              { text: '服务端网关', link: '/guide/server' },
              { text: '智能体接入', link: '/guide/mastra' },
              { text: '会话记忆', link: '/guide/memory' },
              { text: '语义检索', link: '/guide/rag' },
            ],
          },
          {
            text: '开发与测试',
            items: [
              { text: '开发指南', link: '/guide/development' },
              { text: '测试指南', link: '/guide/testing' },
              { text: '单元测试实战', link: '/guide/unit-testing' },
              { text: 'E2E 测试', link: '/guide/e2e-testing' },
            ],
          },
        ],
      },
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
      {
        text: 'Playground',
        items: [
          { text: '完整 Playground', link: '/playground' },
          { text: 'RAG 引用演示', link: '/citation-demo' },
          { text: '模型元数据演示', link: '/model-meta-demo' },
          { text: '反馈与操作演示', link: '/feedback-demo' },
        ],
      },
      ...(isPages ? [] : mockOnlyNav),
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
            { text: '国际化', link: '/guide/i18n' },
            { text: '主题配置器', link: '/theme-builder' },
          ],
        },
        {
          text: '智能体&服务',
          items: [
            { text: '服务端网关', link: '/guide/server' },
            { text: '智能体接入', link: '/guide/mastra' },
            { text: '会话记忆', link: '/guide/memory' },
            { text: '语义检索', link: '/guide/rag' },
          ],
        },
        {
          text: '开发与测试',
          items: [
            { text: '开发指南', link: '/guide/development' },
            { text: '测试指南', link: '/guide/testing' },
            { text: '单元测试实战', link: '/guide/unit-testing' },
            { text: 'E2E 测试', link: '/guide/e2e-testing' },
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
          text: '工具调用',
          items: [{ text: 'ToolCall', link: '/components/tool-call' }],
        },
        {
          text: '附件组件',
          items: [
            { text: 'Attachments', link: '/components/attachments' },
            { text: 'ImageLightbox', link: '/components/image-lightbox' },
          ],
        },
        {
          text: '基础组件',
          items: [
            { text: 'Button', link: '/components/button' },
            { text: 'Input', link: '/components/input' },
            { text: 'Select', link: '/components/select' },
            { text: 'Radio', link: '/components/radio' },
          ],
        },
        {
          text: '通用组件',
          items: [
            { text: 'LanguageToggle', link: '/components/language-toggle' },
            { text: 'Shimmer', link: '/components/shimmer' },
            { text: 'Toast', link: '/components/toast' },
            {
              text: 'ProviderSettingsDialog',
              link: '/components/provider-settings-dialog',
            },
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
