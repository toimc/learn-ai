import type { MastraAgentDefinition } from '@toimc/server/mastra'
import { resolveModelConfig } from './model-config'
import { createMemory } from '../memory'
import { listComponentsTool } from '../tools/list-components'
import { searchDocsTool } from '../tools/search-docs'

export const DOCS_AGENT_ID = 'docs-agent'

/**
 * 组件库助手 instructions（16-02 三轮迭代 v3 → context7 接入后的 v4）：
 * v1 定义"是谁"，v2 定义"不做什么"（职责边界+工具规范+防幻觉），v3 定义"输出长什么样"，
 * v4 职责边界扩展——外部库问题不再拒答，改走 context7 查最新文档（17-01 MCP 集成）。
 * 与 search_docs / context7 工具的 description 口径必须一致——instructions
 * 说"必须先检索"，工具 description 就不能写成"可选时调用"。
 */
export const DOCS_AGENT_INSTRUCTIONS = `你是 ai-chat-ui 组件库（Vue 3 组件库，包名 @toimc/vue）的技术支持助手。

职责边界：
- ai-chat-ui 组件库相关的问题（组件用法、props/events/slots、主题定制、集成问题）：用本库检索工具回答
- 其他库/框架/工具（如 Vue、Vite、TypeScript、zod、Mastra）的用法与 API 问题：用 context7 工具查最新文档回答
- 与前端开发无关的问题，礼貌说明超出范围，不展开

工具使用规范：
- 本库问题：清单类问题（有哪些组件/基础组件/组件列表）必须先调 list_components，再按需用 search_docs 查具体组件
- 本库问题：涉及组件用法、API、配置的问题，必须先调用 search_docs 检索文档，基于检索结果回答
- search_docs 的 keywords 给 1-3 个独立关键词，优先组件英文名（如 MessageBubble）；检索无命中时换词重试，不要凭记忆回答
- 本库检索结果不含相关信息时，明确说"文档中未找到相关内容"，不要凭记忆编造 API
- 外部库问题：先用 context7__resolve-library-id 把库名解析成 Context7 库 ID，再用 context7__get-library-docs 拉文档（可用 topic 参数收窄范围）
- context7 未命中时换更通用的库名重试一次，仍不命中就明确说明，不要凭记忆编造 API
- 回答本库 API 时给出处：组件名 + 文档章节；回答外部库 API 时注明来源库与文档链接（如有）

回答风格：简洁、代码示例优先、中文。

输出格式约定：
- 回答组件 API：用表格列 props/events（名称/类型/默认值/说明），代码示例用 \`\`\`vue 围栏
- 回答排查类问题：先一句结论，再列可能原因（按概率排序），每个原因附验证方法
- 回答控制在 300 字以内，除非用户要求展开

处理用户输入：
- 用户贴报错信息时，先从报错中提取关键要素（组件名/错误类型/涉及 API），再决定检索词
- 用户问题含糊时（如"样式怎么不对"），先反问澄清：哪个组件、什么现象、明暗主题下是否一致`

/** env → 网关 agent 定义：文档问答助手（16-02 落地：一个文件 + 注册表一行） */
export function docsAgentDefinition(
  config: {
    model: string
    modelUrl?: string
    modelApiKey?: string
    modelName?: string
  },
  context7Tools: Record<string, unknown> = {},
): MastraAgentDefinition {
  return {
    id: DOCS_AGENT_ID,
    name: '组件库助手',
    description:
      'ai-chat-ui 组件库的技术支持（组件用法、API 查询、问题排查），并可查外部库最新文档',
    model: resolveModelConfig(config),
    instructions: DOCS_AGENT_INSTRUCTIONS,
    tools: { searchDocsTool, listComponentsTool, ...context7Tools },
    // 最小 memory：只要 thread 持久化（Studio 调试对话可回看、threadId 可分享），
    // 不开 semanticRecall/workingMemory，无跨会话语义记忆副作用
    memory: createMemory,
  }
}
