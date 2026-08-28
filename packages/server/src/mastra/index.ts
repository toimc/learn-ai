import type { Hono } from 'hono'
import { ModelRegistry } from '@toimc/agents'
import { createMastraModel } from '@toimc/agents/mastra'
import { createChatGateway } from '../create-gateway'
import type { GatewayOptions } from '../types'

/** agent 定义：纯配置对象（服务层组装），不含任何 Mastra 类型依赖 */
export interface MastraAgentDefinition {
  /** 网关模型 id（/api/models 列表项与前端 model 参数） */
  id: string
  name?: string
  description?: string
  /** Mastra model 字段：'provider/model' 串或 { id, url, apiKey? } 对象 */
  model: string | Record<string, unknown>
  instructions?: string
  /** createTool 产物字典 */
  tools?: Record<string, unknown>
  /** Memory 实例工厂（惰性：注册时调用一次；不传则无记忆） */
  memory?: () => unknown
  /** memory.resource，默认 'ai-chat' */
  resource?: string
}

export interface MastraGatewayOptions extends Omit<GatewayOptions, 'models'> {
  /** 静态模型（mock 剧本等），原 GatewayOptions.models 数组形态保留 */
  models?: GatewayOptions['models']
  /** mastra agent 定义列表；逐个构建并注册为网关模型 */
  agents?: MastraAgentDefinition[]
}

/**
 * 一行组装：网关 + mastra agents 深度集成（spec 14 §4）。
 * agent 构建失败（依赖缺失/env 非法）整体抛可读错误——启动即失败优于静默降级。
 */
export async function createMastraGateway(
  options: MastraGatewayOptions,
): Promise<{ app: Hono; registry: ModelRegistry }> {
  const { models, agents = [], ...gatewayOptions } = options

  const registry =
    models instanceof ModelRegistry
      ? models
      : (models ?? []).reduce(
          (r, config) => r.register(config),
          new ModelRegistry(),
        )

  for (const def of agents) {
    try {
      const created = await createMastraModel({
        id: def.id,
        name: def.name,
        description: def.description,
        model: def.model,
        ...(def.instructions ? { instructions: def.instructions } : {}),
        ...(def.tools ? { tools: def.tools } : {}),
        ...(def.memory ? { memory: def.memory() } : {}),
        ...(def.resource ? { resource: def.resource } : {}),
      })
      registry.registerAdapter(def.id, created.adapter, created.info)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      // base tsconfig target 为 ES2020，Error(msg, { cause }) 构造重载（ES2022）过不了
      // vue-tsc；属性赋值保留 cause（满足 preserve-caught-error）且类型兼容
      const wrapped = new Error(
        `mastra agent「${def.id}」注册失败：${message}（检查 @mastra/core 是否安装与模型配置）`,
      )
      ;(wrapped as Error & { cause?: unknown }).cause = error
      throw wrapped
    }
  }

  const app = createChatGateway({ ...gatewayOptions, models: registry })
  return { app, registry }
}
