import { Agent } from '@mastra/core/agent'
import type { Memory } from '@mastra/memory'
import { CHAT_AGENT_INSTRUCTIONS } from './mastra/agents/instructions'
import { createMemory } from './mastra/memory'
import { getTimeTool } from './mastra/tools/get-time'
import { getWeatherTool } from './mastra/tools/get-weather'
import type { ResolvedModelConfig } from './mastra/agents/model-config'

/** 表单载荷（与 @toimc/vue ProviderFormPayload 字段一致；本包禁引 @toimc/*，独立定义） */
export interface RuntimeModelPayload {
  name: string
  provider: 'openai-compat' | 'anthropic'
  /** openai-compat 必填（路由校验）；anthropic 走官方端点可省 */
  baseURL?: string
  apiKey: string
  model: string
}

/** 运行时配置的公开视图（绝不含 apiKey） */
export interface RuntimeModelPublicConfig {
  name: string
  provider: 'openai-compat' | 'anthropic'
  model: string
  baseURL?: string
}

/** 测试注入：model 覆盖按 payload 组装的配置；memory 传 null 显式不带记忆 */
export interface SetRuntimeModelOptions {
  model?: ConstructorParameters<typeof Agent>[0]['model']
  memory?: Memory | null
}

/**
 * payload → Mastra model 字段，语义同 mock-server 的 registerRuntimeProvider：
 * - openai-compat：{ id, url, apiKey }，id 带 `openai/` 前缀 + apiKey 显式进对象
 *   （@mastra/core 1.60 实测要求，spec 附录 A.3：url 场景不自动读 provider env）
 * - anthropic：`anthropic/<model>` 路由串，key 经 process.env 注入（见 setRuntimeModel）
 */
export function buildRuntimeModel(
  payload: RuntimeModelPayload,
): ResolvedModelConfig {
  return payload.provider === 'openai-compat'
    ? {
        id: `openai/${payload.model}`,
        ...(payload.baseURL ? { url: payload.baseURL } : {}),
        apiKey: payload.apiKey,
      }
    : `anthropic/${payload.model}`
}

let runtimeAgent: Agent | undefined
let runtimeConfig: RuntimeModelPublicConfig | undefined
/** 跨多次换模型共用同一 Memory 实例：thread 历史在换模型后保持连续 */
let sharedRuntimeMemory: Memory | undefined

function runtimeMemory(): Memory {
  sharedRuntimeMemory ??= createMemory()
  return sharedRuntimeMemory
}

/**
 * 表单提交即换模型（免重启）：组装带工具与会话记忆的 custom-agent 并存入运行时。
 * 注册不做上游连通性校验（惰性，首次对话才真连）。apiKey 只进内存不回显。
 */
export async function setRuntimeModel(
  payload: RuntimeModelPayload,
  options: SetRuntimeModelOptions = {},
): Promise<void> {
  if (payload.provider === 'anthropic') {
    process.env.ANTHROPIC_API_KEY = payload.apiKey
  }
  const memory =
    options.memory === undefined
      ? runtimeMemory()
      : (options.memory ?? undefined)
  runtimeAgent = new Agent({
    id: 'custom-agent',
    name: 'custom-agent',
    // as 收窄对齐 chat-agent 先例：组装只产 string / { id, url, apiKey } 两种形态，
    // id 的 provider/model 模板串约束由路由 validate 保证（openai-compat 必带 baseURL）
    model: (options.model ??
      buildRuntimeModel(payload)) as ConstructorParameters<
      typeof Agent
    >[0]['model'],
    instructions: CHAT_AGENT_INSTRUCTIONS,
    tools: { getTimeTool, getWeatherTool },
    ...(memory ? { memory } : {}),
  })
  runtimeConfig = {
    name: payload.name,
    provider: payload.provider,
    model: payload.model,
    ...(payload.provider === 'openai-compat' && payload.baseURL
      ? { baseURL: payload.baseURL }
      : {}),
  }
}

/** 脱敏公开视图；未配置时 undefined */
export function getRuntimeConfig(): RuntimeModelPublicConfig | undefined {
  return runtimeConfig
}

/** 当前运行时 agent；未配置时 undefined（stream 端点据此 404） */
export function getRuntimeAgent(): Agent | undefined {
  return runtimeAgent
}

/** 清空运行时配置（DELETE 端点）：回到 .env 静态模型，thread 历史仍在共用 Memory 中 */
export function clearRuntimeModel(): void {
  runtimeAgent = undefined
  runtimeConfig = undefined
}
