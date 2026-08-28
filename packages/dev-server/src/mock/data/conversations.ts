import type { ChatMessageDTO, ConversationDetail } from '../types'

function msg(
  id: string,
  role: ChatMessageDTO['role'],
  content: string,
  createdAt: string,
  extra?: Pick<ChatMessageDTO, 'thinking' | 'toolCalls'>,
): ChatMessageDTO {
  return { id, role, content, createdAt, ...extra }
}

/**
 * 预置会话种子数据：多会话切换演示的数据源。
 * 涵盖纯文本问答 / 思维链 / 工具调用 / 富 Markdown 四类消息形态。
 */
const seedConversations: ConversationDetail[] = [
  {
    id: 'conv_vue',
    title: 'Vue 3 响应式答疑',
    description: 'ref 与 reactive 的取舍、侦听器用法',
    updatedAt: '2026-08-19T10:20:00.000Z',
    messageCount: 4,
    messages: [
      msg(
        'm_vue_1',
        'user',
        'ref 和 reactive 应该怎么选？',
        '2026-08-19T10:00:00.000Z',
      ),
      msg(
        'm_vue_2',
        'assistant',
        [
          '一个简单的判断标准：**默认用 `ref`，聚合对象再用 `reactive`**。\n\n',
          '- `ref` 可以包裹任意类型，`.value` 的存在让解构不丢响应式\n',
          '- `reactive` 只接受对象，解构后失去响应式，深层属性默认惰性代理\n\n',
          '```typescript\n',
          'const count = ref(0)          // 基础类型\n',
          'const form = reactive({\n',
          '  name: "",\n',
          '  rules: { required: true },  // 惰性代理，不会初始化即递归\n',
          '})\n',
          '```\n',
        ].join(''),
        '2026-08-19T10:00:30.000Z',
      ),
      msg(
        'm_vue_3',
        'user',
        'watch 和 computed 有什么使用边界？',
        '2026-08-19T10:10:00.000Z',
      ),
      msg(
        'm_vue_4',
        'assistant',
        [
          '**能收敛为派生值的一律用 `computed`**，只有产生副作用（请求、DOM、定时器）才用 `watch`。\n\n',
          '> 经验法则：模板里要用的数据 → computed；数据变化要触发动作 → watch。\n',
        ].join(''),
        '2026-08-19T10:20:00.000Z',
      ),
    ],
  },
  {
    id: 'conv_arch',
    title: '组件库架构设计',
    description: 'Monorepo 分层与 ChatAdapter 解耦',
    updatedAt: '2026-08-18T16:40:00.000Z',
    messageCount: 3,
    messages: [
      msg(
        'm_arch_1',
        'user',
        'ai-chat-ui 为什么要设计 ChatAdapter 抽象层？',
        '2026-08-18T16:00:00.000Z',
      ),
      msg(
        'm_arch_2',
        'assistant',
        [
          '核心动机是**组件与后端解耦**：\n\n',
          '1. UI 组件只依赖 `AsyncGenerator<StreamChunk>` 这一最小契约\n',
          '2. 任何后端（OpenAI / Claude / 自建网关）实现一个 adapter 即可接入\n',
          '3. `core` 包保持零依赖，`vue` 包只做渲染，职责单向依赖\n\n',
          '```text\n',
          '用户代码 → @toimc/vue → @toimc/core → ChatAdapter → 任意后端\n',
          '```\n',
        ].join(''),
        '2026-08-18T16:00:45.000Z',
        {
          thinking: {
            content:
              '用户问的是设计动机，需要从依赖方向和可替换性两个角度回答。\n\n- 先说为什么不能直接在组件里调 API\n- 再给出分层带来的三个具体收益\n- 最后用一行依赖链收束',
            duration: 4200,
          },
        },
      ),
      msg(
        'm_arch_3',
        'user',
        '流式输出为什么选 AsyncGenerator 而不是回调？',
        '2026-08-18T16:30:00.000Z',
      ),
      msg(
        'm_arch_4',
        'assistant',
        [
          '`AsyncGenerator` 让**消费端用 `for await...of` 自然表达流**：\n\n',
          '- 中断：`AbortSignal` 透传给底层请求，生成器随请求一起停止\n',
          '- 背压：`await` 天然逐块处理，不会一次性灌满内存\n',
          '- 组合：可以 `yield*` 串接多个流（如先 thinking 后 text）\n',
        ].join(''),
        '2026-08-18T16:40:00.000Z',
      ),
    ],
  },
  {
    id: 'conv_tools',
    title: '工具调用演示',
    description: '天气查询 tool call 完整链路',
    updatedAt: '2026-08-17T09:15:00.000Z',
    messageCount: 2,
    messages: [
      msg(
        'm_tool_1',
        'user',
        '上海今天天气怎么样？',
        '2026-08-17T09:00:00.000Z',
      ),
      msg(
        'm_tool_2',
        'assistant',
        '上海今天多云转晴，气温 26–33°C，东南风 3 级，降水概率 10%，适合户外活动。',
        '2026-08-17T09:00:20.000Z',
        {
          toolCalls: [
            {
              id: 'call_w_001',
              name: 'get_weather',
              arguments: { city: '上海', unit: 'celsius' },
              result: {
                condition: '多云转晴',
                temp: [26, 33],
                wind: '东南风 3 级',
                rain: 0.1,
              },
              status: 'completed',
              duration: 860,
            },
          ],
        },
      ),
    ],
  },
  {
    id: 'conv_markdown',
    title: 'Markdown 渲染测试',
    description: '代码块、表格、公式的综合用例',
    updatedAt: '2026-08-16T14:00:00.000Z',
    messageCount: 2,
    messages: [
      msg(
        'm_md_1',
        'user',
        '给我一份 Markdown 综合示例：代码、表格、引用都要有',
        '2026-08-16T13:50:00.000Z',
      ),
      msg(
        'm_md_2',
        'assistant',
        [
          '### 流式渲染优化对比\n\n',
          '| 策略 | 首帧 | 实现复杂度 |\n',
          '| --- | --- | --- |\n',
          '| 全量重渲染 | 慢 | 低 |\n',
          '| 增量分块 | 快 | 中 |\n',
          '| Web Worker 高亮 | 最快 | 高 |\n\n',
          '> 流式场景下先渲染纯文本代码块，流结束后再异步替换为高亮结果。\n\n',
          '```typescript\n',
          'async function highlightOnIdle(code: string) {\n',
          "  const { codeToHtml } = await import('shiki')\n",
          "  return codeToHtml(code, { lang: 'ts', theme: 'github-dark' })\n",
          '}\n',
          '```\n',
        ].join(''),
        '2026-08-16T14:00:00.000Z',
      ),
    ],
  },
]

/** 运行态存储：种子数据深拷贝，支持会话内增删（重启即还原） */
export function createConversationStore() {
  const store = new Map<string, ConversationDetail>()
  for (const conv of seedConversations) {
    store.set(conv.id, structuredClone(conv))
  }
  return store
}

let idCounter = 0
export function nextId(prefix: string): string {
  idCounter += 1
  return `${prefix}_${Date.now().toString(36)}${idCounter.toString(36)}`
}
