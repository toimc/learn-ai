import { generateId, type Message } from '@ai-chat/core'

const baseTime = Date.now()

// 用数组按行 join，避免模板字符串与 Markdown 中的反引号（行内代码、代码围栏）冲突
const archContent = [
  '# ai-chat-ui 架构设计',
  '',
  '这是一个 **后端无关** 的 AI 聊天界面组件库，核心理念是让 *组件与 AI 后端完全解耦*，通过统一的 `ChatAdapter` 接口适配任意后端。',
  '',
  '## 数据流向',
  '',
  '整体数据流非常清晰：',
  '',
  '```text',
  '用户代码 → @ai-chat/vue → @ai-chat/core → ChatAdapter → 任意后端',
  '```',
  '',
  '## 三个核心包',
  '',
  '`@ai-chat/core` 定义全部类型与 `useChat` composable，零外部依赖，是纯逻辑层。',
  '',
  '`@ai-chat/vue` 提供 `Conversation`、`Message`、`PromptInput` 等 UI 组件，通过 peerDependencies 引入 Vue。',
  '',
  '`@ai-chat/markdown` 负责流式 Markdown 渲染，支持代码高亮与公式。',
  '',
  '## 流式适配器示例',
  '',
  '下面是最简的流式适配器实现，通过 `AsyncGenerator` 逐块产出文本：',
  '',
  '```typescript',
  'async function* adapter(options) {',
  "  yield { type: 'text', content: '你好，' }",
  "  yield { type: 'text', content: '世界！' }",
  "  yield { type: 'done', content: '' }",
  '}',
  '```',
  '',
  '只要实现这个接口，无论是 *OpenAI*、*Anthropic* 还是自建服务，都能无缝接入。',
].join('\n')

const themeContent = [
  '## 三层 Design Token',
  '',
  '主题系统基于 **三层令牌** 架构，组件代码完全不感知具体色值：',
  '',
  '```css',
  ':root {',
  '  /* 第一层：原始令牌 */',
  '  --ai-chat-color-indigo-500: #6366f1;',
  '',
  '  /* 第二层：语义令牌 */',
  '  --ai-chat-color-accent: var(--ai-chat-color-indigo-500);',
  '}',
  '```',
  '',
  '切换 **暗色模式** 时，只需重新定义 *语义令牌*，所有组件自动跟随，真正做到 `零修改` 适配。',
  '',
  '这种分层让品牌定制非常灵活——改一个变量，就能切换整站风格。',
].join('\n')

export const mockMessages: Message[] = [
  {
    id: generateId(),
    role: 'user',
    content: '帮我设计一个 Vue 3 聊天组件库的架构方案，要求组件和 AI 后端解耦',
    createdAt: new Date(baseTime),
  },
  {
    id: generateId(),
    role: 'assistant',
    content: archContent,
    createdAt: new Date(baseTime + 1000),
  },
  {
    id: generateId(),
    role: 'user',
    content: '它的主题系统是怎么设计的？',
    createdAt: new Date(baseTime + 2000),
  },
  {
    id: generateId(),
    role: 'assistant',
    content: themeContent,
    createdAt: new Date(baseTime + 3000),
  },
]
