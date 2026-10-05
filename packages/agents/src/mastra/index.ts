import type { Agent, AgentConfig } from '@mastra/core/agent'
import { generateId } from '@toimc/core'
import type { StreamChunk } from '@toimc/core'
import type {
  ChatMessage,
  ChatRequest,
  ChatResponse,
  IModelAdapter,
} from '../types'
import type {
  MastraAdapterOptions,
  MastraModel,
  MastraModelConfig,
} from './types'

/** AI SDK UserContent 的 parts 子集（多模态透传的转换目标形态） */
type AiSdkUserPart =
  { type: 'text'; text: string } | { type: 'image'; image: string }

/** Mastra ModelMessage 的 system/user/assistant 字面量变体（本包内转换目标） */
type ModelMessageShape =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string | AiSdkUserPart[] }
  | { role: 'assistant'; content: string }

/**
 * OpenAI wire parts（text / image_url）→ AI SDK parts（text / image）方言转换。
 * wire 输入未经 schema 校验，逐字段运行时收窄；未知 part 形态静默丢弃，
 * 不进模型输入。
 */
function toUserParts(parts: unknown): AiSdkUserPart[] {
  if (!Array.isArray(parts)) return []
  return parts.flatMap((part): AiSdkUserPart[] => {
    if (!part || typeof part !== 'object') return []
    const p = part as Record<string, unknown>
    if (p.type === 'text' && typeof p.text === 'string') {
      return [{ type: 'text', text: p.text }]
    }
    if (p.type === 'image_url') {
      const url = (p.image_url as { url?: unknown } | undefined)?.url
      if (typeof url === 'string') return [{ type: 'image', image: url }]
    }
    return []
  })
}

/** parts 数组降级为拼接文本（system/assistant 的防御路径，协议上不该出现数组） */
function textFromParts(parts: unknown[]): string {
  return parts
    .filter(
      (p): p is { text: string } =>
        !!p &&
        typeof p === 'object' &&
        (p as Record<string, unknown>).type === 'text' &&
        typeof (p as Record<string, unknown>).text === 'string',
    )
    .map((p) => p.text)
    .join('')
}

/**
 * ChatMessage → Mastra ModelMessage：string content 零转换直传；
 * user 的 parts 数组做 OpenAI → AI SDK 方言转换（image_url → image）；
 * system/assistant 的数组形态（wire 不可信输入）降级拼接文本。
 */
function toModelMessages(messages: ChatMessage[]): ModelMessageShape[] {
  return messages.map((m): ModelMessageShape => {
    if (typeof m.content === 'string') {
      return { role: m.role, content: m.content }
    }
    if (m.role === 'user') {
      return { role: m.role, content: toUserParts(m.content) }
    }
    return { role: m.role, content: textFromParts(m.content) }
  })
}

/**
 * Agent 构造项中宽联合字段的收窄目标：
 * model / tools / memory 接受大量形态（magic string、OpenAICompatibleConfig、
 * AI SDK 实例、createTool 产物、Memory 实例），本包配置层刻意声明为宽松
 * Record，构造时收窄——宿主无需接触这些 Mastra 类型。
 */
type AgentCtorConfig = AgentConfig

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return String(error ?? fallback)
}

function toArguments(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    // 依据：Mastra ToolCallPayload.args 为工具入参对象（JSON.parse 产物或 provider 给到的对象）
    return value as Record<string, unknown>
  }
  return undefined
}

/**
 * Mastra Agent 适配器：把 Mastra 1.60 原生流 chunk（`{ type, payload }`）映射为 StreamChunk 线协议。
 *
 * - `text-delta` → text；`reasoning-delta` → thinking
 * - `tool-call-input-streaming-start` → tool_call（id+name，无参数）
 * - `tool-call-delta` 累积参数片段、不发包；`tool-call-input-streaming-end` → tool_call（完整 toolArguments）
 * - `tool-call`（未走流式分解的完整调用，如 provider 不流式工具入参）→ tool_call，
 *   与流式路径按 toolCallId 去重，避免双发
 * - `tool-result` → tool_result（`isError` 时映射 toolError）；`tool-error` → tool_result（toolError）
 * - `error` → error 后终止；适配器不发 done 帧（网关兜底补帧）
 * - 会话记忆：passthrough.conversationId 作为 thread，缺省生成 `mastra_thread` 前缀 id；
 *   仅当 agent.hasOwnMemory() 为 true 时透传 memory 配置
 * - 静默丢弃的已知事件：source/file（引用来源）、tool-call-approval/tool-call-suspended
 *   （HITL 审批/挂起）、tool-output（输出处理器流）、raw（原始帧）——
 *   后续接入 citation / HITL 能力时从这里扩展
 */
/** 公共类型随子路径导出（宿主标注 config/返回值用） */
export type {
  MastraAdapterOptions,
  MastraModel,
  MastraModelConfig,
} from './types'

export class MastraAdapter implements IModelAdapter {
  constructor(
    private readonly agent: Agent,
    private readonly options: MastraAdapterOptions = {},
  ) {}

  private memoryConfig(request: ChatRequest): {
    thread: string
    resource: string
  } {
    // generateId() 无参（core 现状签名），前缀用模板拼接保持 mastra_thread 命名空间
    const thread =
      typeof request.passthrough?.conversationId === 'string'
        ? request.passthrough.conversationId
        : `mastra_thread_${generateId()}`
    return { thread, resource: this.options.resource ?? 'ai-chat' }
  }

  /** stream / generate 共用的执行项；temperature 在 Mastra 1.60 走 modelSettings */
  private executionOptions(request: ChatRequest): {
    abortSignal: AbortSignal | undefined
    memory?: { thread: string; resource: string }
    modelSettings?: { temperature: number }
  } {
    return {
      abortSignal: request.signal,
      // 无 Memory 的 Agent 透传 memory 字段无意义且可能触发 Mastra 记忆装配，
      // 以 hasOwnMemory() 运行时探测代替宿主声明（评审 I2）
      ...(this.agent.hasOwnMemory()
        ? { memory: this.memoryConfig(request) }
        : {}),
      ...(request.temperature !== undefined
        ? { modelSettings: { temperature: request.temperature } }
        : {}),
    }
  }

  async *chatStream(request: ChatRequest): AsyncGenerator<StreamChunk> {
    const streamResult = await this.agent.stream(
      toModelMessages(request.messages),
      this.executionOptions(request),
    )

    /** tool-call-delta 累积的参数 JSON 片段（按 toolCallId） */
    const pendingArgs = new Map<string, string>()
    /** 已发出完整参数的 toolCallId（tool-call 完整事件去重） */
    const completedArgs = new Set<string>()
    /** streaming-end payload 不带 toolName，从 start 事件记录 */
    const toolNames = new Map<string, string>()

    for await (const part of streamResult.fullStream) {
      switch (part.type) {
        case 'text-delta': {
          if (part.payload.text)
            yield { type: 'text', content: part.payload.text }
          break
        }
        case 'reasoning-delta': {
          if (part.payload.text)
            yield { type: 'thinking', content: part.payload.text }
          break
        }
        case 'tool-call-input-streaming-start': {
          const { toolCallId, toolName } = part.payload
          toolNames.set(toolCallId, toolName)
          yield {
            type: 'tool_call',
            content: '',
            metadata: { toolCallId, toolName },
          }
          break
        }
        case 'tool-call-delta': {
          const key = part.payload.toolCallId
          pendingArgs.set(
            key,
            (pendingArgs.get(key) ?? '') + part.payload.argsTextDelta,
          )
          break
        }
        case 'tool-call-input-streaming-end': {
          const key = part.payload.toolCallId
          const raw = pendingArgs.get(key) ?? ''
          pendingArgs.delete(key)
          completedArgs.add(key)
          let args: Record<string, unknown> | undefined
          if (raw) {
            try {
              // 合法 JSON 但非对象（"42"/true 等标量）不是工具入参，与解析失败同退 { raw }
              args = toArguments(JSON.parse(raw)) ?? { raw }
            } catch {
              args = { raw }
            }
          }
          yield {
            type: 'tool_call',
            content: '',
            metadata: {
              toolCallId: key,
              toolName: toolNames.get(key),
              toolArguments: args,
            },
          }
          break
        }
        case 'tool-call': {
          const { toolCallId, toolName, args } = part.payload
          if (completedArgs.has(toolCallId)) break
          completedArgs.add(toolCallId)
          toolNames.set(toolCallId, toolName)
          yield {
            type: 'tool_call',
            content: '',
            metadata: {
              toolCallId,
              toolName,
              toolArguments: toArguments(args),
            },
          }
          break
        }
        case 'tool-result': {
          const { toolCallId, toolName, result, isError } = part.payload
          yield {
            type: 'tool_result',
            content: '',
            metadata: isError
              ? {
                  toolCallId,
                  toolName,
                  toolError: toErrorMessage(result, 'tool error'),
                }
              : { toolCallId, toolName, toolResult: result },
          }
          break
        }
        case 'tool-error': {
          const { toolCallId, toolName, error } = part.payload
          yield {
            type: 'tool_result',
            content: '',
            metadata: {
              toolCallId,
              toolName,
              toolError: toErrorMessage(error, 'tool error'),
            },
          }
          break
        }
        case 'error': {
          yield {
            type: 'error',
            content: toErrorMessage(part.payload.error, 'stream error'),
          }
          return
        }
        default:
          break
      }
    }
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const result = await this.agent.generate(
      toModelMessages(request.messages),
      this.executionOptions(request),
    )
    const usage = result.usage
    return {
      content: result.text,
      model: this.options.modelId ?? 'mastra-agent',
      usage:
        typeof usage?.inputTokens === 'number' ||
        typeof usage?.outputTokens === 'number'
          ? {
              promptTokens: usage.inputTokens ?? 0,
              completionTokens: usage.outputTokens ?? 0,
            }
          : undefined,
    }
  }
}

/**
 * 声明式工厂：config → { adapter, info, agent }，直接喂 registry.registerAdapter(id, adapter, info)。
 * 内部构造 Mastra Agent 并包成 MastraAdapter，宿主不接触 Mastra 类型。
 *
 * @mastra/core 是 optional peer 依赖：Agent 构造器走函数内动态 import，
 * 缺依赖时抛含安装指引的友好错误（spec FR1），而不是子路径加载即裸 ERR_MODULE_NOT_FOUND。
 * 因此本函数是 async，调用方需 await。
 */
export async function createMastraModel(
  config: MastraModelConfig,
): Promise<MastraModel> {
  const agentModule = await import('@mastra/core/agent').catch(() => null)
  if (!agentModule) {
    throw new Error(
      'Mastra 集成需要 @mastra/core：请先安装 pnpm add @mastra/core（peer 可选依赖，未装时 @toimc/agents/mastra 子路径的 Agent 构造不可用）',
    )
  }
  const agent = new agentModule.Agent({
    id: config.id,
    name: config.name ?? config.id,
    instructions: config.instructions ?? '',
    model: config.model as AgentCtorConfig['model'],
    ...(config.tools
      ? { tools: config.tools as AgentCtorConfig['tools'] }
      : {}),
    ...(config.memory
      ? { memory: config.memory as AgentCtorConfig['memory'] }
      : {}),
  })
  const adapter = new MastraAdapter(agent, {
    resource: config.resource,
    modelId: config.id,
  })
  return {
    adapter,
    info: {
      name: config.name ?? config.id,
      description: config.description ?? '',
      provider: 'mastra',
    },
    agent,
  }
}
