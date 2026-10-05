import type { GatewayMiddleware } from '../types'

/** 网关 Hono 应用的 context 变量（认证中间件写入，路由/配额读取） */
export interface GatewayEnv {
  Variables: {
    /** 认证出的用户 id（identifyUser 写入；用户态所有治理逻辑的唯一主线） */
    userId?: string
    /** 本请求后当日剩余配额（quotaGuard 写入） */
    quotaRemaining?: number
  }
}

export type UserPlan = 'free' | 'pro'

export interface UserRecord {
  id: string
  email: string
  plan: UserPlan
  createdAt: string
}

export interface ApiKeyRecord {
  id: string
  userId: string
  /** 明文前缀（如 sk-aichat-ab12），后台展示「sk-aichat-ab12…」用 */
  keyPrefix: string
  status: 'active' | 'revoked'
  createdAt: string
}

/** 一次调用的用量记账行（19-02：计费/成本报表的唯一数据源） */
export interface UsageInsert {
  userId: string
  model: string
  /** provider 真实 usage 可得时为实测值；不可得时为估算兜底 */
  inputTokens: number | null
  outputTokens: number | null
  /** token 为估算值时 true（真实 usage 缺席的兜底口径） */
  estimated: boolean
  createdAt: string
}

export interface UsageRecord extends UsageInsert {
  id: number
}

/** 注册撞已存在邮箱时存储实现抛出（路由层转 409） */
export class EmailTakenError extends Error {
  constructor(email: string) {
    super(`email already registered: ${email}`)
    this.name = 'EmailTakenError'
  }
}

/**
 * 身份存储端口：网关（机制）不绑具体数据库，宿主提供实现
 * （dev-server 默认给 LibSQL 文件库实现，见 packages/dev-server/src/identity）。
 */
export interface IdentityStore {
  /** 注册建号；邮箱已存在抛 EmailTakenError（路由转 409） */
  createUser(input: {
    email: string
    passwordHash: string
    plan?: UserPlan
  }): Promise<UserRecord>
  findUserByEmail(email: string): Promise<UserRecord | null>
  findUserById(id: string): Promise<UserRecord | null>
  /** 取用户密码哈希（登录校验用）；用户不存在返回 null */
  findPasswordHash(userId: string): Promise<string | null>
  insertApiKey(
    userId: string,
    keyHash: string,
    keyPrefix: string,
  ): Promise<ApiKeyRecord>
  /** 哈希命中且 status=active 才返回 userId（撤销即失效） */
  findUserIdByActiveKeyHash(keyHash: string): Promise<string | null>
  /** 撤销自己的 key；目标不存在或不属于该用户返回 false */
  revokeApiKey(keyId: string, userId: string): Promise<boolean>
  /**
   * thread 归属登记（首次使用即归属）：thread 已归本人 → true；
   * 已归他人 → false（IDOR 防线，路由转 403）
   */
  claimThread(threadId: string, userId: string): Promise<boolean>
  /** 当日用量原子自增，返回自增后的次数（配额判定用；持久化、跨重启） */
  incrDailyUsage(userId: string, day: string): Promise<number>
  insertUsage(record: UsageInsert): Promise<void>
  /** 用量明细（成本报表数据源）；day 形如 '2026-10-05'（UTC） */
  listUsage(input: { userId: string; day?: string }): Promise<UsageRecord[]>
}

/** 用户态认证与治理选项（createChatGateway 的 identity 入参） */
export interface GatewayIdentityOptions {
  store: IdentityStore
  /** JWT 签名密钥（登录/注册签发 access token 用；只存在于宿主 env） */
  jwtSecret: string
  /** access token 有效期（秒），默认 900（15 分钟，笔记安全底线：短有效期） */
  accessTokenTtlSeconds?: number
  /** 免费用户每日对话配额，默认 20 */
  freeDailyQuota?: number
  /** pro 用户每日对话配额，默认 200 */
  proDailyQuota?: number
  /** 时钟注入（测试跨日重置），默认真实时间 */
  now?: () => Date
}

export type IdentityMiddleware = GatewayMiddleware
