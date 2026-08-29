import { describe, expect, it } from 'vitest'
import { MCPServer } from '@mastra/mcp'
import {
  WEATHER_MCP_SERVER_ID,
  weatherMcpServer,
} from '../../src/mcp/weather-server'

describe('weatherMcpServer（宿主侧 MCPServer）', () => {
  it('构造成功且元数据完整（@mastra/mcp 与 core 1.60 兼容性的回归锚）', () => {
    expect(weatherMcpServer).toBeInstanceOf(MCPServer)
    expect(weatherMcpServer.name).toBe('ai-chat-ui Weather Server')
  })

  it('具备 stdio 与 HTTP 两种启动能力（供 MCP 客户端连接）', () => {
    expect(typeof weatherMcpServer.startStdio).toBe('function')
    expect(typeof weatherMcpServer.startHTTP).toBe('function')
  })

  it('id 导出为常量（Mastra 实例注册与端点路径引用同一来源）', () => {
    expect(WEATHER_MCP_SERVER_ID).toBe('weather-mcp-server')
  })
})
