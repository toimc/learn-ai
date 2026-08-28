import type { StreamChunk } from '@toimc/core'
import { nextId } from './data/conversations'

export interface ScriptedChunk {
  chunk: StreamChunk
  /** 发送本块前等待的毫秒数（chat 路由会乘以 speed 倍率） */
  delayMs: number
}

type Script = Array<
  [StreamChunk['type'], string, number, StreamChunk['metadata']?]
>

/** 打字机粒度：每 token 字符数与间隔（模拟 LLM 逐 token 输出的手感） */
const TOKEN_CHARS = 4
const TOKEN_DELAY_MS = 45

/**
 * 编译剧本：text / thinking 内容按 token 粒度展开（首 token 前保留
 * 原始 delayMs 的停顿，后续 token 按 tokenDelay 间隔连续吐出），
 * tool_call / tool_result / error / done 为原子事件不拆分。
 */
function compile(
  script: Script,
  tokenDelayMs = TOKEN_DELAY_MS,
): ScriptedChunk[] {
  const out: ScriptedChunk[] = []
  for (const [type, content, delayMs, metadata] of script) {
    if (
      (type === 'text' || type === 'thinking') &&
      content.length > TOKEN_CHARS
    ) {
      for (let i = 0; i < content.length; i += TOKEN_CHARS) {
        out.push({
          chunk: { type, content: content.slice(i, i + TOKEN_CHARS) },
          delayMs: i === 0 ? delayMs : tokenDelayMs,
        })
      }
    } else {
      out.push({
        chunk: metadata ? { type, content, metadata } : { type, content },
        delayMs,
      })
    }
  }
  return out
}

/** 思维链演示：先流式思考，再输出正文 */
const thinkingScript: Script = [
  ['thinking', '先把问题拆开：关键词是「流式」和「安全」。\n', 400],
  ['thinking', '- 流式：内容分块到达，解析器必须容错不完整语法\n', 220],
  ['thinking', '- 安全：v-html 前必须消毒，拼接要在消毒之后\n', 220],
  ['thinking', '\n结论：分块解析 + 渲染前统一过 DOMPurify。', 260],
  ['text', '流式 Markdown 渲染要同时解决两件事：\n\n', 500],
  ['text', '1. **容错解析**：不完整语法降级为纯文本，下一块到达再重析\n', 90],
  ['text', '2. **安全消毒**：在最后一次拼接后过 DOMPurify，再进 v-html\n', 90],
  ['done', '', 200],
]

/** 工具调用演示：tool_call → tool_result → 正文 */
function toolScript(city: string): Script {
  const toolCallId = nextId('call')
  return [
    [
      'tool_call',
      '',
      500,
      {
        toolCallId,
        toolName: 'get_weather',
        toolArguments: { city, unit: 'celsius' },
      },
    ],
    [
      'tool_result',
      '',
      900,
      {
        toolCallId,
        toolResult: {
          condition: '多云转晴',
          temp: [25, 32],
          wind: '东南风 3 级',
          rain: 0.1,
        },
        duration: 820,
      },
    ],
    ['text', `已查询到 ${city} 的实时天气：`, 300],
    ['text', '**多云转晴**，气温 25–32°C，东南风 3 级，降水概率 10%。', 120],
    ['done', '', 200],
  ]
}

/** 错误演示：正文输出到一半流中断 */
const errorScript: Script = [
  ['text', '这是一次模拟的失败请求：正文输出到一半时，', 300],
  ['text', '上游模型服务将会中断…\n\n', 120],
  [
    'error',
    '上游服务暂时不可用（模拟错误）：请稍后重试，或点击重新生成。',
    600,
  ],
  ['done', '', 100],
]

/** 慢速演示：验证 loading/中止在弱网下的表现 */
const slowScript: Script = [
  ['text', '慢速流式演示：', 900],
  ['text', '每块间隔约 500ms，', 500],
  ['text', '适合观察光标闪烁、', 500],
  ['text', '滚动跟随与中止按钮的表现。', 500],
  ['text', '\n\n试试在输出过程中点击「停止」。', 500],
  ['done', '', 500],
]

/** 富 Markdown 演示 */
const markdownScript: Script = [
  ['text', '### Markdown 渲染综合演示\n\n', 400],
  [
    'text',
    '**粗体**、*斜体*、`行内代码`、[链接](https://github.com) 都支持。\n\n',
    110,
  ],
  [
    'text',
    '| 能力 | 状态 |\n| --- | --- |\n| 表格 | ✅ |\n| 代码块 | ✅ |\n| 引用 | ✅ |\n\n',
    130,
  ],
  ['text', '> 流式场景下，语法不完整时先降级为纯文本。\n\n', 120],
  [
    'text',
    "```typescript\nconst stream = adapter.sendMessage({ messages, signal })\nfor await (const chunk of stream) {\n  if (chunk.type === 'done') break\n}\n```\n",
    160,
  ],
  ['done', '', 200],
]

/** 问好演示 */
const greetingScript: Script = [
  ['text', '你好！我是运行在 **dev-server** 上的模拟助手。', 350],
  [
    'text',
    '\n\n发送包含「思考 / 工具 / 错误 / 慢速 / markdown」关键词的消息，可以触发不同的流式场景。',
    120,
  ],
  ['done', '', 200],
]

/** 默认场景：摘取用户输入关键片段的上下文回复 */
function defaultScript(input: string): Script {
  const brief = input.replace(/\s+/g, ' ').trim().slice(0, 40)
  return [
    [
      'text',
      `关于「${brief || '你的问题'}」，这是来自 dev-server 的流式回复：\n\n`,
      450,
    ],
    [
      'text',
      '```typescript\n// dev-server 用 Hono streamSSE 逐块输出 StreamChunk\nawait stream.writeSSE({ event: "chunk", data: JSON.stringify(chunk) })\nawait stream.sleep(delayMs)\n```\n\n',
      140,
    ],
    [
      'text',
      '真实的请求经过 HTTP 层，可以在浏览器 DevTools 的 Network 面板看到 `text/event-stream` 响应。',
      120,
    ],
    ['done', '', 200],
  ]
}

interface Scenario {
  name: string
  match: (input: string) => boolean
  build: (input: string) => ScriptedChunk[]
}

const scenarios: Scenario[] = [
  {
    name: 'thinking',
    match: (s) => /思考|thinking|think/i.test(s),
    build: () => compile(thinkingScript),
  },
  {
    name: 'tool',
    match: (s) => /工具|tool|天气|weather/i.test(s),
    build: (s) => {
      const cityMatch = s.match(/(北京|上海|广州|深圳|杭州|成都|西安|南京)/)
      return compile(toolScript(cityMatch?.[1] ?? '上海'))
    },
  },
  {
    name: 'error',
    match: (s) => /错误|error|失败/i.test(s),
    build: () => compile(errorScript),
  },
  {
    name: 'slow',
    match: (s) => /慢|slow/i.test(s),
    // 每个 token 都间隔 500ms，保持弱网手感
    build: () => compile(slowScript, 500),
  },
  {
    name: 'markdown',
    match: (s) => /markdown|渲染示例|综合示例/i.test(s),
    build: () => compile(markdownScript),
  },
  {
    name: 'greeting',
    match: (s) => /^\s*(你好|您好|hello|hi|嗨|在吗)/i.test(s),
    build: () => compile(greetingScript),
  },
]

/** 按用户输入选择剧本；无命中时走默认上下文回复 */
export function buildReply(input: string): ScriptedChunk[] {
  const scenario = scenarios.find((s) => s.match(input))
  return scenario ? scenario.build(input) : compile(defaultScript(input))
}

/** 场景名导出，供测试与文档对齐 */
export const scenarioNames = scenarios.map((s) => s.name)
