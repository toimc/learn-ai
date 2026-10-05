/** dev-server 环境配置（spec 14 §5.4：两套 MASTRA_* 前缀统一为一套） */
import { tempDbUrl } from './paths'

export interface MastraEnv {
  /** 模型路由串，如 'deepseek/deepseek-chat' */
  model: string
  /** 自定义 OpenAI 兼容端点（可选） */
  modelUrl?: string
  /** 自定义端点的 API key（url 场景必传：Mastra url 场景不自动读 provider env） */
  modelApiKey?: string
  /** 展示名（可选） */
  modelName?: string
  /** 检索等高频轻活用的次级模型（可选；配置则 researcher 用它，演示按角色选模型） */
  subModel?: string
}

/**
 * 用户体系配置（19-01）：AUTH_MODE 门控——
 * 'static'（默认）维持 15 章静态 Bearer 白名单现状；'user' 启用
 * 注册登录 + API Key + 每日配额 + thread 隔离 + 用量记账。
 */
export interface AuthEnv {
  mode: 'static' | 'user'
  /** JWT 签发密钥（user 模式必填，装配层缺省即报错） */
  jwtSecret: string
  /** 身份库落盘 URL（users/api_keys/thread_owners/daily_usage/usage_log） */
  dbUrl: string
  freeDailyQuota: number
  proDailyQuota: number
}

/** 语义检索（RAG 向量路）配置：本地 Ollama 为缺省形态，云端端点只改 env */
export interface EmbeddingEnv {
  /** 模型名；裸名（bge-m3）走本地 Ollama，含 provider/ 前缀（openai/text-embedding-3-small）原样透传 */
  model: string
  /** OpenAI 兼容端点（/embeddings 协议） */
  url: string
  apiKey: string
}

export interface DevServerEnv {
  /** HTTP 端口，默认 8787 */
  port: number
  /** 存在即启用 mastra agents；null = 纯 mock 模式 */
  mastra: MastraEnv | null
  /** 存在即启用 search_docs 的向量检索路；null = 纯关键词（src/rag 消费） */
  embedding: EmbeddingEnv | null
  /** Studio 可观测性开关（默认开启 opt-out，仅 MASTRA_TELEMETRY=false 显式关闭；src/mastra/index.ts 消费） */
  observability: boolean
  /** 网关 Bearer（可选；/health 保持公开；仅 static 模式生效） */
  token?: string
  /** 用户体系（19-01）：默认 static 维持现状 */
  auth: AuthEnv
  /** context7 MCP 的 API key（可选；docs-agent 外部库文档工具，src/mcp/context7.ts 消费） */
  context7ApiKey?: string
}

/** env 正整数解析：非法/缺省回退默认值 */
function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

export function readDevServerEnv(
  env: Record<string, string | undefined> = process.env,
): DevServerEnv {
  const parsedPort = Number(env.DEV_SERVER_PORT)
  const port = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 8787
  const model = env.MASTRA_MODEL
  const embeddingModel = env.EMBEDDING_MODEL
  return {
    port,
    mastra: model
      ? {
          model,
          ...(env.MASTRA_MODEL_URL ? { modelUrl: env.MASTRA_MODEL_URL } : {}),
          ...(env.MASTRA_MODEL_API_KEY
            ? { modelApiKey: env.MASTRA_MODEL_API_KEY }
            : {}),
          ...(env.MASTRA_MODEL_NAME
            ? { modelName: env.MASTRA_MODEL_NAME }
            : {}),
          ...(env.MASTRA_SUB_MODEL ? { subModel: env.MASTRA_SUB_MODEL } : {}),
        }
      : null,
    observability: env.MASTRA_TELEMETRY !== 'false',
    embedding: embeddingModel
      ? {
          model: embeddingModel,
          url: env.EMBEDDING_MODEL_URL ?? 'http://localhost:11434/v1',
          apiKey: env.EMBEDDING_MODEL_API_KEY ?? 'ollama',
        }
      : null,
    ...(env.MASTRA_TOKEN ? { token: env.MASTRA_TOKEN } : {}),
    auth: {
      mode: env.AUTH_MODE === 'user' ? 'user' : 'static',
      jwtSecret: env.AUTH_JWT_SECRET ?? '',
      dbUrl: env.AUTH_DB_URL ?? tempDbUrl('auth.db'),
      freeDailyQuota: positiveInt(env.AUTH_DAILY_QUOTA_FREE, 20),
      proDailyQuota: positiveInt(env.AUTH_DAILY_QUOTA_PRO, 200),
    },
    ...(env.CONTEXT7_API_KEY ? { context7ApiKey: env.CONTEXT7_API_KEY } : {}),
  }
}
