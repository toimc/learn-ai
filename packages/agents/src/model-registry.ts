import { AnthropicAdapter } from './adapters/anthropic'
import { OpenAICompatibleAdapter } from './adapters/openai-compat'
import type { IModelAdapter, ModelConfig, ModelPublicInfo } from './types'

export interface AdapterInfo {
  name?: string
  description?: string
  provider?: string
}

export interface RegisteredModel {
  id: string
  adapter: IModelAdapter
  info: ModelPublicInfo
}

/** 内置协议 → 适配器工厂；新协议经 registerAdapter 接入 */
const PROVIDER_FACTORIES: Record<
  string,
  (config: ModelConfig) => IModelAdapter
> = {
  'openai-compat': (config) => new OpenAICompatibleAdapter(config),
  anthropic: (config) => new AnthropicAdapter(config),
}

/**
 * 模型注册中心：id → 适配器实例的映射。
 * register 按 provider 自动创建内置适配器；registerAdapter 接入自定义实现（mock 等）。
 */
export class ModelRegistry {
  private models = new Map<string, RegisteredModel>()

  /** 注册内置协议模型（openai-compat / anthropic），重复 id 覆盖 */
  register(config: ModelConfig): this {
    const factory = PROVIDER_FACTORIES[config.provider]
    if (!factory) {
      throw new Error(
        `Unknown provider: ${config.provider}（内置支持 openai-compat / anthropic，自定义适配器请用 registerAdapter）`,
      )
    }
    this.models.set(config.id, {
      id: config.id,
      adapter: factory(config),
      info: {
        id: config.id,
        name: config.name ?? config.id,
        description: config.description ?? '',
        provider: config.provider,
      },
    })
    return this
  }

  /** 注册自定义适配器（如 mock 剧本引擎），重复 id 覆盖 */
  registerAdapter(
    id: string,
    adapter: IModelAdapter,
    info?: AdapterInfo,
  ): this {
    this.models.set(id, {
      id,
      adapter,
      info: {
        id,
        name: info?.name ?? id,
        description: info?.description ?? '',
        ...(info?.provider ? { provider: info.provider } : {}),
      },
    })
    return this
  }

  /** 注销适配器：存在则移除返回 true，不存在返回 false */
  removeAdapter(id: string): boolean {
    return this.models.delete(id)
  }

  /** 未注册 id 抛错（消息包含 id） */
  get(id: string): RegisteredModel {
    const model = this.models.get(id)
    if (!model) throw new Error(`Model not registered: ${id}`)
    return model
  }

  has(id: string): boolean {
    return this.models.has(id)
  }

  /** 注册顺序的公开视图（脱敏：无 apiKey / model / baseURL），返回浅拷贝 */
  list(): ModelPublicInfo[] {
    return [...this.models.values()].map((m) => ({ ...m.info }))
  }
}
