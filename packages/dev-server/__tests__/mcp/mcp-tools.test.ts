import { describe, expect, it } from 'vitest'
import {
  createMcpTools,
  jsonSchemaPassthrough,
  mcpToolName,
} from '../../src/mcp/mcp-tools'

describe('mcpToolName', () => {
  it('命名空间前缀防冲突：server 名 + 双下划线 + 工具名', () => {
    expect(mcpToolName('context7', 'resolve-library-id')).toBe(
      'context7__resolve-library-id',
    )
  })
})

describe('jsonSchemaPassthrough', () => {
  const remote = {
    type: 'object',
    properties: { query: { type: 'string' } },
    required: ['query'],
  }

  it('实现 Standard Schema v1：version=1 且 validate 透传（校验交给 MCP server 端）', () => {
    const schema = jsonSchemaPassthrough(remote)
    expect(schema['~standard'].version).toBe(1)
    // Standard Schema 允许 validate 同步返回 Result；消费方 await 同样成立
    expect(schema['~standard'].validate({ query: 'vue' })).toEqual({
      value: { query: 'vue' },
    })
  })

  it('jsonSchema converter 原样返回远端 schema（LLM 拿到真实参数定义，不做克隆改写）', () => {
    const schema = jsonSchemaPassthrough(remote)
    expect(schema['~standard'].jsonSchema.input()).toBe(remote)
  })

  it('缺 inputSchema 的远端工具兜底为空对象 schema', () => {
    const schema = jsonSchemaPassthrough(undefined)
    expect(schema['~standard'].jsonSchema.input()).toEqual({ type: 'object' })
  })
})

describe('createMcpTools', () => {
  it('连接失败降级为空工具集（不抛错、不阻塞启动）', async () => {
    const tools = await createMcpTools({
      name: 'ghost',
      command: 'no-such-bin-ai-chat-ui',
      args: [],
      timeoutMs: 5_000,
    })
    expect(tools).toEqual({})
  })
})
