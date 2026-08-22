import { describe, expect, it } from 'vitest'
import { DEFAULT_PORT, readAppEnv } from './env'

describe('readAppEnv', () => {
  it('缺 MASTRA_APP_MODEL 抛出指明该 env 的可读错误', () => {
    expect(() => readAppEnv({})).toThrow(/MASTRA_APP_MODEL/)
  })

  it('空串 MASTRA_APP_MODEL 同样视为缺失', () => {
    expect(() => readAppEnv({ MASTRA_APP_MODEL: '' })).toThrow(
      /MASTRA_APP_MODEL/,
    )
  })

  it('仅 model 时：路由串直传、port 取默认 4111、telemetry 关', () => {
    const env = readAppEnv({ MASTRA_APP_MODEL: 'deepseek/deepseek-chat' })
    expect(env.model).toBe('deepseek/deepseek-chat')
    expect(env.modelUrl).toBeUndefined()
    expect(env.token).toBeUndefined()
    expect(env.port).toBe(4111)
    expect(env.telemetry).toBe(false)
  })

  it('全字段 env 完整解析（值均为手写字面量）', () => {
    const env = readAppEnv({
      MASTRA_APP_MODEL: 'anthropic/claude-sonnet-4-20250514',
      MASTRA_APP_MODEL_URL: 'https://api.example.com/v1',
      MASTRA_APP_TOKEN: 'secret-token',
      MASTRA_APP_PORT: '4222',
      MASTRA_APP_TELEMETRY: 'true',
    })
    expect(env).toEqual({
      model: 'anthropic/claude-sonnet-4-20250514',
      modelUrl: 'https://api.example.com/v1',
      token: 'secret-token',
      port: 4222,
      telemetry: true,
    })
  })

  it('非法端口值回退默认 4111 而非 NaN 崩溃', () => {
    expect(
      readAppEnv({
        MASTRA_APP_MODEL: 'openai/gpt-4o',
        MASTRA_APP_PORT: 'not-a-number',
      }).port,
    ).toBe(DEFAULT_PORT)
  })

  it('MASTRA_APP_TELEMETRY 非 true 字符串不开遥测', () => {
    expect(
      readAppEnv({
        MASTRA_APP_MODEL: 'openai/gpt-4o',
        MASTRA_APP_TELEMETRY: '1',
      }).telemetry,
    ).toBe(false)
  })
})
