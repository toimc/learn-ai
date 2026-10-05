import type { StreamChunk } from '@toimc/core'
import type { OrchestrationResult } from '../orchestration/patterns'
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

// ---------------------------------------------------------------------------
// 多 agent 编排演示剧本（spec 16 §5.3）：thinking（编排意图）→ orchestrate
// 工具调用 → 手写 OrchestrationResult → 汇报正文 → done。三种形态结构一致、
// 数据不同；toolResult 字面量与 src/orchestration/patterns.ts 的真实产出同构
// （type-only import：零运行时耦合，且类型漂移在编译期即被拦下）。
// ---------------------------------------------------------------------------

type OrchestrationResultMock = OrchestrationResult

const MAIN_MODEL = 'deepseek/deepseek-chat'
/** MASTRA_SUB_MODEL 语境的副模型名：高频检索活走便宜模型（spec 16 §2 按角色选模型） */
const SUB_MODEL = 'zhipu/glm-4-flash'

function orchestrationScript(options: {
  pattern: OrchestrationResultMock['pattern']
  task: string
  thinking: Array<[string, number]>
  /** task 不在字面量里重复：由上方 options.task 统一注入 */
  result: Omit<OrchestrationResultMock, 'task'>
  /** orchestrate 工具整体执行耗时（ms）：串行形态为各阶段之和，并行取最长一路 */
  duration: number
  report: Array<[string, number]>
}): Script {
  const toolCallId = nextId('call')
  const script: Script = []
  for (const [content, delayMs] of options.thinking) {
    script.push(['thinking', content, delayMs])
  }
  script.push([
    'tool_call',
    '',
    500,
    {
      toolCallId,
      toolName: 'orchestrate',
      toolArguments: { pattern: options.pattern, task: options.task },
    },
  ])
  script.push([
    'tool_result',
    '',
    900,
    {
      toolCallId,
      toolResult: { ...options.result, task: options.task },
      duration: options.duration,
    },
  ])
  for (const [content, delayMs] of options.report) {
    script.push(['text', content, delayMs])
  }
  script.push(['done', '', 200])
  return script
}

/** 委托编排：researcher 检索 → writer 起草，finalDraft 即 writer 稿 */
function delegateScript(task: string): Script {
  const writerDraft = [
    'PromptInput 的按键行为：\n',
    '- `sendKey="enter"`：**Enter 发送**，Shift+Enter 插入换行\n',
    '- `sendKey="alt-enter"`（默认）：Enter 原生换行，Alt/Cmd+Enter 才发送\n',
    '- 输入法组词期间的 Enter 被 `isComposing` / `keyCode 229` 守护，不会误发',
  ].join('')
  return orchestrationScript({
    pattern: 'delegate',
    task,
    thinking: [
      ['用户指定委托模式：我不直接查资料，先把任务交给检索员。', 400],
      [
        '检索完成后把结果连同任务交给起草员成稿，调用 orchestrate 走两步委托。',
        240,
      ],
    ],
    result: {
      pattern: 'delegate',
      stages: [
        {
          role: 'researcher',
          agentId: 'researcher-agent',
          status: 'ok',
          durationMs: 1840,
          model: MAIN_MODEL,
          usage: { inputTokens: 386, outputTokens: 118 },
          output: [
            '检索命中 3 处（packages/vue/src/prompt-input/PromptInputTextarea.vue、',
            'packages/docs/components/prompt-input.md）：\n',
            '- sendKey="enter"：Enter 直接发送，Shift+Enter 插入换行\n',
            '- sendKey="alt-enter"（默认）：Enter 原生换行，Alt/Cmd+Enter 发送\n',
            '- isComposing / keyCode 229 守护输入法组词期间的 Enter，不误发',
          ].join(''),
        },
        {
          role: 'writer',
          agentId: 'writer-agent',
          status: 'ok',
          durationMs: 2620,
          model: MAIN_MODEL,
          usage: { inputTokens: 742, outputTokens: 236 },
          output: writerDraft,
        },
      ],
      finalDraft: writerDraft,
    },
    duration: 4460,
    report: [
      [
        '委托编排完成：**检索员**查到 3 处关键实现，**起草员**基于检索结果成稿（合计 4.46s）。',
        300,
      ],
      [
        '**按键行为**：`sendKey="enter"` 时 Enter 发送、Shift+Enter 换行；默认 `sendKey="alt-enter"` 为 Alt/Cmd+Enter 发送；输入法组词中的 Enter 不会误发。',
        120,
      ],
      ['两个阶段的检索原文与起草稿可在上方卡片内折叠查看。', 120],
    ],
  })
}

/** 并行编排：三路 researcher 各带检索角度，finalDraft 留空由编排者综合汇报 */
function parallelScript(task: string): Script {
  return orchestrationScript({
    pattern: 'parallel',
    task,
    thinking: [
      ['并行模式：这个问题适合从三个角度同时检索，互不依赖。', 400],
      ['三路检索员并发执行，全部返回后我再综合汇报，不预写结论。', 240],
    ],
    result: {
      pattern: 'parallel',
      stages: [
        {
          role: 'researcher',
          agentId: 'researcher-agent',
          status: 'ok',
          durationMs: 2150,
          model: SUB_MODEL,
          usage: { inputTokens: 352, outputTokens: 96 },
          output: [
            '角度：组件用法与 API。组件 API 层没有独立 theme prop，',
            '主题不进 Props，全部经 **CSS 变量** 与 data-theme 属性生效；',
            'Conversation / PromptInput 等组件只引用 --ai-chat-* 令牌。',
          ].join(''),
        },
        {
          role: 'researcher',
          agentId: 'researcher-agent',
          status: 'ok',
          durationMs: 1980,
          model: MAIN_MODEL,
          usage: { inputTokens: 368, outputTokens: 88 },
          output: [
            '角度：配置与主题定制。运行时切换用 useTheme（light/dark/system，',
            'localStorage 键 ai-chat-theme）；预设用 **useThemePreset**，',
            '内置 default/purple/green/warm 四套，只改原始层 accent 色阶。',
          ].join(''),
        },
        {
          role: 'researcher',
          agentId: 'researcher-agent',
          status: 'ok',
          durationMs: 2320,
          model: MAIN_MODEL,
          usage: { inputTokens: 341, outputTokens: 104 },
          output: [
            '角度：集成与数据流转。宿主覆盖写一条未分层 **:root** 规则即可，',
            '天然压过库内 @layer 令牌，无需 !important；',
            '优先级链：inline style > [data-theme] > :root。',
          ].join(''),
        },
      ],
      finalDraft: '',
    },
    duration: 2320,
    report: [
      [
        '三路并行检索完成（最长一路 2.32s，其中一路走了副模型），综合如下：',
        300,
      ],
      [
        '**三层定制入口**：CSS 变量直接覆盖（宿主一行规则）→ useTheme 运行时切换 → useThemePreset 四套预设（只动 accent 色阶）。',
        120,
      ],
      [
        '选型建议：**换主题色用预设、改明暗用 useTheme、深度定制直接覆盖变量**。',
        120,
      ],
    ],
  })
}

/** 流水线编排：检索 → 起草 → 审查打回 → 重写，finalDraft 为重写稿 */
function pipelineScript(task: string): Script {
  const firstDraft =
    '多会话数据全部存在内存里：useChat 的消息数组和 dev-server 的会话 Map，刷新即丢，组件库没有提供任何持久化能力。'
  const revisedDraft = [
    '多会话数据分两层：前端 useChat 的消息是内存 reactive 数组，',
    'dev-server 预置会话是内存 Map（重启还原种子）。\n',
    '组件库刻意不内置持久化——数据归属留给宿主：轻量场景按 ai-chat-theme 同款 ',
    '**localStorage** 模式落盘，多端同步走服务端存储（在 ChatAdapter 边界内实现）。',
  ].join('')
  return orchestrationScript({
    pattern: 'pipeline',
    task,
    thinking: [
      ['流水线模式：检索 → 起草 → 审查，审查不过打回重写一次。', 400],
      ['我先让检索员取事实，起草员成稿，审查员对照检索结果把质量关。', 240],
    ],
    result: {
      pattern: 'pipeline',
      stages: [
        {
          role: 'researcher',
          agentId: 'researcher-agent',
          status: 'ok',
          durationMs: 1920,
          model: MAIN_MODEL,
          usage: { inputTokens: 402, outputTokens: 124 },
          output: [
            '检索命中：会话消息存于 useChat 的内存状态（reactive 数组）；',
            'dev-server 预置会话是内存 Map（structuredClone 种子，重启即还原）；',
            '组件库不内置持久化——数据归属留在宿主，',
            '可参考主题持久化的 localStorage 模式（键 ai-chat-theme）。',
          ].join(''),
        },
        {
          role: 'writer',
          agentId: 'writer-agent',
          status: 'ok',
          durationMs: 2480,
          model: MAIN_MODEL,
          usage: { inputTokens: 698, outputTokens: 214 },
          output: firstDraft,
        },
        {
          role: 'reviewer',
          agentId: 'reviewer-agent',
          status: 'ok',
          durationMs: 1560,
          model: MAIN_MODEL,
          usage: { inputTokens: 812, outputTokens: 96 },
          output: [
            '[revise]\n',
            '草稿把「组件库不内置持久化」说成「没有任何持久化能力」，与检索结果冲突；',
            '需补：数据归属宿主，可按 ai-chat-theme 的 localStorage 模式或服务端存储落地。',
          ].join(''),
          meta: { verdict: 'revise' },
        },
        {
          role: 'writer',
          agentId: 'writer-agent',
          status: 'ok',
          durationMs: 2110,
          model: MAIN_MODEL,
          usage: { inputTokens: 1024, outputTokens: 268 },
          output: revisedDraft,
          meta: { retried: true },
        },
      ],
      finalDraft: revisedDraft,
    },
    duration: 8070,
    report: [
      [
        '流水线跑完：检索 → 起草 → 审查打回一次 → **重写**（串行合计 8.07s），终稿如下。',
        300,
      ],
      [
        '**会话数据在哪里**：useChat 内存数组 + dev-server 内存 Map；**怎么持久化**：库不越界，宿主自选 localStorage（参考 ai-chat-theme）或服务端存储。',
        120,
      ],
      [
        '首版草稿与审查意见可在卡片内折叠查看，`retried` 标记了打回后的重写。',
        120,
      ],
    ],
  })
}

/** 演示页在预置问题前拼接形态前缀（如「【流水线】…」），命中后剥掉前缀取任务原文 */
function stripPatternPrefix(input: string): string {
  return input.replace(/^【[^】]*】\s*/, '').trim()
}

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
  // 多 agent 剧本置于最前（spec 16 §3.5）：委托/并行/流水线是比「工具」更具体的
  // 意图，避免「用流水线工具查一下」这类编排请求被通用 tool 场景截走
  {
    name: 'delegate',
    match: (s) => /委托|delegate/i.test(s),
    build: (s) => compile(delegateScript(stripPatternPrefix(s))),
  },
  {
    name: 'parallel',
    match: (s) => /并行|parallel/i.test(s),
    build: (s) => compile(parallelScript(stripPatternPrefix(s))),
  },
  {
    name: 'pipeline',
    match: (s) => /流水线|pipeline/i.test(s),
    build: (s) => compile(pipelineScript(stripPatternPrefix(s))),
  },
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
