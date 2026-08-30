import { describe, expect, it } from 'vitest'
import { readDevServerEnv } from '../../src/env'
import { createEmbedder, embedBatch } from '../../src/rag/embedder'

describe('readDevServerEnv embedding 解析', () => {
  it('EMBEDDING_MODEL 未设置时 embedding 为 null（纯关键词检索模式）', () => {
    expect(readDevServerEnv({}).embedding).toBeNull()
  })

  it('EMBEDDING_MODEL 存在即启用，URL/KEY 缺省指向本地 Ollama', () => {
    const { embedding } = readDevServerEnv({ EMBEDDING_MODEL: 'bge-m3' })
    expect(embedding).toEqual({
      model: 'bge-m3',
      url: 'http://localhost:11434/v1',
      apiKey: 'ollama',
    })
  })

  it('EMBEDDING_MODEL_URL / EMBEDDING_MODEL_API_KEY 显式覆盖缺省', () => {
    const { embedding } = readDevServerEnv({
      EMBEDDING_MODEL: 'text-embedding-3-small',
      EMBEDDING_MODEL_URL: 'https://2api.store/v1',
      EMBEDDING_MODEL_API_KEY: 'sk-xxx',
    })
    expect(embedding).toMatchObject({
      model: 'text-embedding-3-small',
      url: 'https://2api.store/v1',
      apiKey: 'sk-xxx',
    })
  })
})

describe('createEmbedder', () => {
  it('裸模型名加 ollama/ 前缀（本地端点场景 provider 名不进注册表）', () => {
    const embedder = createEmbedder({
      model: 'bge-m3',
      url: 'http://localhost:11434/v1',
      apiKey: 'ollama',
    })
    expect(embedder.provider).toBe('ollama')
    expect(embedder.modelId).toBe('bge-m3')
  })

  it('含 provider/ 前缀的模型串原样透传（云端端点切换只改 env）', () => {
    const embedder = createEmbedder({
      model: 'openai/text-embedding-3-small',
      url: 'https://2api.store/v1',
      apiKey: 'sk-xxx',
    })
    expect(embedder.provider).toBe('openai')
    expect(embedder.modelId).toBe('text-embedding-3-small')
  })
})

describe('embedBatch', () => {
  it('按 batchSize 分批调用 doEmbed 并按原顺序展平', async () => {
    const calls: string[][] = []
    const fake = {
      async doEmbed({ values }: { values: string[] }) {
        calls.push(values)
        return { embeddings: values.map((v) => [v.length]) }
      },
    }
    const out = await embedBatch(fake, ['a', 'bb', 'ccc', 'dddd', 'eeeee'], 2)
    expect(calls).toEqual([['a', 'bb'], ['ccc', 'dddd'], ['eeeee']])
    expect(out).toEqual([[1], [2], [3], [4], [5]])
  })

  it('空数组不发起任何调用', async () => {
    const calls: string[][] = []
    const fake = {
      async doEmbed({ values }: { values: string[] }) {
        calls.push(values)
        return { embeddings: [] }
      },
    }
    const out = await embedBatch(fake, [], 32)
    expect(calls).toEqual([])
    expect(out).toEqual([])
  })
})
