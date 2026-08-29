import { MCPServer } from '@mastra/mcp'
import { getWeatherTool } from '../tools/get-weather'

export const WEATHER_MCP_SERVER_ID = 'weather-mcp-server'

/**
 * 宿主侧 MCP server（对齐官方 "Expose a Mastra MCP Server" 姿势）：
 * 把本地 getWeatherTool 暴露给外部 MCP 客户端（Claude Code / MCP Inspector / 其他 agent 应用）。
 * 与 context7 客户端方向相反——context7 是我们连别人，这里是别人连我们。
 * 挂载两形态：
 * - Mastra 实例 mcpServers（src/mastra/index.ts）：当前 mastra CLI 1.26 的 dev server
 *   尚不自动暴露 HTTP 端点（其 /mcp/v0/* 是 Registry 目录 API），注册先行——CLI 升级后自动获得
 * - weather-stdio.ts：独立 stdio 入口，客户端以 command 形式拉起（已真机验证）
 */
export const weatherMcpServer = new MCPServer({
  id: WEATHER_MCP_SERVER_ID,
  name: 'ai-chat-ui Weather Server',
  version: '1.0.0',
  description:
    'ai-chat-ui dev-server 的工具宿主：get_weather（wttr.in 实时天气）',
  tools: { get_weather: getWeatherTool },
})
