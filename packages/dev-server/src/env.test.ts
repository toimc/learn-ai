import { describe, expect, it } from 'vitest'
import { readDevServerEnv } from './env'

describe('readDevServerEnv', () => {
  it('缺 MASTRA_MODEL 时 mastra 为 null（纯 mock 模式），端口默认 8787', () => {
    const env = readDevServerEnv({})
    expect(env.mastra).toBeNull()
    expect(env.port).toBe(8787)
    expect(env.telemetry).toBe(false)
  })

  it('MASTRA_MODEL 存在即启用 mastra agents，可选字段按需带入', () => {
    const env = readDevServerEnv({
      MASTRA_MODEL: 'deepseek/deepseek-chat',
      MASTRA_MODEL_URL: 'https://gw.example/v1',
      MASTRA_MODEL_API_KEY: 'sk-x',
      MASTRA_MODEL_NAME: 'Chat Agent',
      MASTRA_TELEMETRY: 'true',
      MASTRA_TOKEN: 't',
      DEV_SERVER_PORT: '9000',
    })
    expect(env.mastra).toEqual({
      model: 'deepseek/deepseek-chat',
      modelUrl: 'https://gw.example/v1',
      modelApiKey: 'sk-x',
      modelName: 'Chat Agent',
    })
    expect(env.telemetry).toBe(true)
    expect(env.token).toBe('t')
    expect(env.port).toBe(9000)
  })

  it('MASTRA_MODEL 存在但 URL/KEY 缺省时仅含 model', () => {
    const env = readDevServerEnv({ MASTRA_MODEL: 'deepseek/deepseek-chat' })
    expect(env.mastra).toEqual({ model: 'deepseek/deepseek-chat' })
  })
})
