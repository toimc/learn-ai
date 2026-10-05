import { describe, expect, it } from 'vitest'
import { readDevServerEnv } from '../src/env'

describe('readDevServerEnv', () => {
  it('缺 MASTRA_MODEL 时 mastra 为 null（纯 mock 模式），端口默认 8787', () => {
    const env = readDevServerEnv({})
    expect(env.mastra).toBeNull()
    expect(env.port).toBe(8787)
  })

  it('MASTRA_MODEL 存在即启用 mastra agents，可选字段按需带入', () => {
    const env = readDevServerEnv({
      MASTRA_MODEL: 'deepseek/deepseek-chat',
      MASTRA_MODEL_URL: 'https://gw.example/v1',
      MASTRA_MODEL_API_KEY: 'sk-x',
      MASTRA_MODEL_NAME: 'Chat Agent',
      MASTRA_TOKEN: 't',
      DEV_SERVER_PORT: '9000',
    })
    expect(env.mastra).toEqual({
      model: 'deepseek/deepseek-chat',
      modelUrl: 'https://gw.example/v1',
      modelApiKey: 'sk-x',
      modelName: 'Chat Agent',
    })
    expect(env.token).toBe('t')
    expect(env.port).toBe(9000)
  })

  it('MASTRA_MODEL 存在但 URL/KEY 缺省时仅含 model', () => {
    const env = readDevServerEnv({ MASTRA_MODEL: 'deepseek/deepseek-chat' })
    expect(env.mastra).toEqual({ model: 'deepseek/deepseek-chat' })
  })

  it('CONTEXT7_API_KEY 存在时解析为 context7ApiKey，缺省不带该字段', () => {
    expect(
      readDevServerEnv({ CONTEXT7_API_KEY: 'ctx7sk-test' }).context7ApiKey,
    ).toBe('ctx7sk-test')
    expect('context7ApiKey' in readDevServerEnv({})).toBe(false)
  })

  it('observability 默认开启（opt-out）：不设 MASTRA_TELEMETRY 为 true', () => {
    expect(readDevServerEnv({}).observability).toBe(true)
    expect(
      readDevServerEnv({ MASTRA_MODEL: 'deepseek/deepseek-chat' })
        .observability,
    ).toBe(true)
  })

  it('MASTRA_TELEMETRY 显式 false 才关闭 observability', () => {
    expect(readDevServerEnv({ MASTRA_TELEMETRY: 'false' }).observability).toBe(
      false,
    )
  })

  it('MASTRA_TELEMETRY=true 时 observability 为 true', () => {
    expect(readDevServerEnv({ MASTRA_TELEMETRY: 'true' }).observability).toBe(
      true,
    )
  })

  it('auth 默认 static（现状零变化），AUTH_MODE=user 切用户态', () => {
    const def = readDevServerEnv({}).auth
    expect(def.mode).toBe('static')
    expect(def.freeDailyQuota).toBe(20)
    expect(def.proDailyQuota).toBe(200)

    const user = readDevServerEnv({ AUTH_MODE: 'user' }).auth
    expect(user.mode).toBe('user')
    // jwtSecret 缺省为空串，由装配层（createDevApp）报错兜底
    expect(user.jwtSecret).toBe('')
  })

  it('AUTH_JWT_SECRET / AUTH_DAILY_QUOTA_* / AUTH_DB_URL 按需解析，非法配额回退默认', () => {
    const env = readDevServerEnv({
      AUTH_MODE: 'user',
      AUTH_JWT_SECRET: 's3cret',
      AUTH_DAILY_QUOTA_FREE: '3',
      AUTH_DAILY_QUOTA_PRO: 'not-a-number',
      AUTH_DB_URL: 'file:/tmp/x/auth.db',
    }).auth
    expect(env.jwtSecret).toBe('s3cret')
    expect(env.freeDailyQuota).toBe(3)
    expect(env.proDailyQuota).toBe(200)
    expect(env.dbUrl).toBe('file:/tmp/x/auth.db')
  })
})
