import { Agent } from '@mastra/core/agent'
import type { MastraAgentDefinition } from '@toimc/server/mastra'
import { resolveModelConfig } from '../agents/model-config'
import type { MastraEnv } from '../env'
import { searchDocsTool } from '../tools/search-docs'

/**
 * 子 agent 定义 → Mastra Agent 实例（spec 16 §4）：
 * 编排闭包与 Studio 宿主共用的唯一映射，收窄方式对齐原 src/mastra/index.ts 内联写法。
 */
export function instantiateAgent(def: MastraAgentDefinition): Agent {
  return new Agent({
    id: def.id,
    name: def.name ?? def.id,
    instructions: def.instructions ?? '',
    // 定义层宽松 Record 在此收窄（env 组装只产 string / { id, url, apiKey? } 两种形态）
    model: def.model as ConstructorParameters<typeof Agent>[0]['model'],
    tools: def.tools as ConstructorParameters<typeof Agent>[0]['tools'],
    memory: def.memory
      ? (def.memory() as ConstructorParameters<typeof Agent>[0]['memory'])
      : undefined,
  })
}

/**
 * 三个子 agent 定义（纯配置，spec 16 §2/§3.1）：
 * 不进网关注册表，仅 Studio 宿主与编排闭包消费。
 * 按角色选模型：researcher 是高频便宜活，配了 MASTRA_SUB_MODEL 就用之；
 * writer/reviewer 始终用主模型。次级模型与主模型共用端点配置（url 场景同一网关）。
 */
export function teamDefinitions(env: MastraEnv): MastraAgentDefinition[] {
  return [
    {
      id: 'researcher-agent',
      name: '检索员',
      description: '只读检索：search_docs 查 ai-chat-ui 文档，供编排链路取材',
      model: resolveModelConfig({
        model: env.subModel ?? env.model,
        ...(env.modelUrl ? { modelUrl: env.modelUrl } : {}),
        ...(env.modelApiKey ? { modelApiKey: env.modelApiKey } : {}),
      }),
      instructions: `你是检索员，多 agent 编排中的只读检索角色。
- 收到任务后提取 1-3 个独立关键词（优先组件英文名，如 MessageBubble），用 search_docs 检索 ai-chat-ui 文档
- 只做只读检索，不修改任何数据，不调用其他工具
- 把检索到的要点整理成简明清单返回，每条附文档出处；检索结果不含相关信息时如实返回"未命中"，不凭记忆编造
- 你只提供检索材料，不回答问题、不起草内容`,
      tools: { searchDocsTool },
    },
    {
      id: 'writer-agent',
      name: '起草员',
      description: '基于检索结果起草回答：无工具，不越检索结果半步',
      model: resolveModelConfig(env),
      instructions: `你是起草员，多 agent 编排中的写作角色。
- 你没有任何工具，只基于 prompt 中给出的检索结果起草回答
- 回答必须落在检索结果范围内：检索结果没有的信息不编造，缺什么就说明缺什么
- 先给结论再给要点，语言简洁，中文，不写与任务无关的寒暄`,
    },
    {
      id: 'reviewer-agent',
      name: '审查员',
      description: '对照检索结果审查草稿：首行输出 [pass]/[revise] 审查结论',
      model: resolveModelConfig(env),
      instructions: `你是审查员，多 agent 编排中的审查角色。
- 你没有任何工具，对照 prompt 中给出的检索结果审查草稿
- 输出契约：第一行必须是 [pass] 或 [revise]（方括号原样输出），随后另起一行给出审查意见
- 草稿与检索结果一致、无编造、无关键遗漏 → [pass]
- 存在事实错误、编造检索结果里没有的内容、遗漏任务问到的关键信息 → [revise]，意见中具体指出要补充或修正什么
- 审查意见必须可执行（改哪里、以检索结果哪条为准），不写空话`,
    },
  ]
}
