---
title: 会话记忆
---

# 会话记忆

[智能体接入](/guide/mastra)展示了 `memory: () => new Memory({ ... })` 的一行挂载；本页深入这一行背后的落盘工程：memory 为什么是工厂、库文件锚在哪、网关与 Studio 为什么必须同库、composite 双域怎么路由，以及 token 成本三档的取舍。实现集中在 `packages/dev-server/src/memory.ts` 与 `packages/dev-server/src/paths.ts`。

## 为什么需要会话记忆

不挂 memory 的网关是纯转发：每轮请求发给模型的只有本轮 `messages`，多轮上下文要么靠前端回传全量历史（`useChat` 的 `maxHistory` 截断），要么没有；服务端进程重启后什么都不剩，每次对话都是新会话。

挂上 Mastra Memory 后行为改变：每轮消息写入 thread 落盘，下一轮请求 Mastra 自动把该 thread 的近期历史注入 prompt——上下文由服务端记忆补全，不再依赖前端回传。dev-server 的验证方式最直接：重启 `pnpm dev:server`，前端用同一 `conversationId` 继续对话，Agent 仍记得之前说了什么。

## 挂载方式：工厂函数，不是实例

`MastraAgentDefinition`（`packages/server/src/mastra/index.ts`）里 memory 的类型是工厂而非实例：

```ts
export interface MastraAgentDefinition {
  /** Memory 实例工厂（惰性：注册时调用一次；不传则无记忆） */
  memory?: () => unknown
  /** memory.resource，默认 'ai-chat' */
  resource?: string
}
```

惰性语义在两条装配线各调用一次：

| 装配线 | 调用点 | 时机 |
| --- | --- | --- |
| 网关线（8787） | `createMastraGateway` 内 `def.memory()` | agent 注册阶段，一次性 |
| Studio 线（4111） | `instantiateAgent` 内 `def.memory()` | `src/mastra/index.ts` 模块加载时 |

定义层因此保持纯配置对象（不 import 任何 Mastra 类型），实例化收敛到装配层——「新增 agent = 一个定义文件 + 注册表一行」的架构不被记忆破坏。

当前两个挂记忆的 agent 配置完全一致，都是**最小形态**：

```ts
// packages/dev-server/src/agents/docs-agent.ts
memory: createMemory,
// 最小 memory：只要 thread 持久化（Studio 调试对话可回看、threadId 可分享），
// 不开 semanticRecall/workingMemory，无跨会话语义记忆副作用
```

`createMemory`（`src/memory.ts`）只传 `storage` 不传 `options`——即只落盘、不额外改变喂给模型的上下文范围（默认行为见 [token 三档](#token-三档控制-可选能力-当前未启用)）。chat-agent 同款（`memory: createMemory`）。docs-agent 的取舍是刻意设计：组件库助手需要的是「对话可回看」，不是「跨会话记住用户偏好」。

两个行为边界：

- **不传 memory 就真的没有记忆**：适配层以 `agent.hasOwnMemory()` 运行时探测，未配置工厂的 agent 连 memory 字段都不透传（无 Memory 的 Agent 透传该字段无意义且可能误触发 Mastra 记忆装配）
- **resource 是网关层归属标识**：默认 `'ai-chat'`，透传为 Mastra 记忆的 resource 命名空间（见下文双层隔离）

## 落盘决策：网关与 Studio 同库

dev-server 有两条装配线，但会话库只有一个：`file:.temp/dev-server.db`。`memory.ts` 里 `STORAGE_DB_URL = MEMORY_DB_URL` 不是巧合，注释写明了约束：

> 1.60 的 memory REST API（Studio 线程列表/历史消息的数据源）从实例 storage 读线程，分库会造成写(dev-server.db)读(mastra.db) split-brain——Studio 对话落地却查不到历史。

即 Studio 的记忆 REST 接口不读各 agent 的 `memory.storage`，只读 Mastra 实例的 `storage`。若 Studio 线把实例 storage 指到另一个文件，网关线写的会话在 Studio 里查不到。同文件后 traces / workflow 状态与记忆表共存——本地 dev 便利优先于文件级分离。

## 路径锚定：包根 .temp/

库文件锚在 dev-server 包根的 `.temp/`，由 `paths.ts` 的 `resolvePkgRoot` 保证——从模块所在目录逐级向上找 `name === '@toimc/dev-server'` 的 `package.json`。不能用相对路径，两个原因都源于 `mastra dev` 是 bundle 运行：

- 模块被内联进 `.mastra/output/` 产物，目录层级与 `src/` 不同，锚相对路径会随目录结构漂移
- **rebuild 会清空 `.mastra/` 整个目录**，锚在其下的库文件随重启陪葬——这是 Studio 历史反复丢失的根因

以包名做标记上溯则稳定：bundle 内层的 `package.json`（name 为 `"server"`）会被跳过，最终命中包根，与 tsx / vitest 直跑（`src/` 上一级）殊途同归。

配套的 `ensureDbDir` 处理另一个启动坑：libsql 本地 `file:` 模式**不自动建父目录**，目录缺失时 `SQLITE_CANTOPEN` 直接崩启动——所以 `createMemory` / `createStorage` / composite 构造都先跑它。`paths.ts` 独立成模块（而非并进 memory.ts）也有工程理由：记忆、向量库等多处消费路径工具，且测试常整体 `vi.mock` memory 模块，路径工具不随记忆 mock 漂移。

## composite 双域路由：会话与观测分文件分引擎

Studio 线的实例级 storage 是 `MastraCompositeStore` 双域路由：

| 域 | 引擎 | 文件 | 数据性质 |
| --- | --- | --- | --- |
| default | LibSQL | `.temp/dev-server.db` | 会话 / threads / workflow 状态——用户数据，不可重建 |
| observability | DuckDB | `.temp/observability.duckdb` | traces / logs / metrics——派生数据，可重建 |

观测域不用 LibSQL 是硬约束：`@mastra/libsql` 1.21.x 未实现 `batchCreateLogs`（core 默认只警告不写，logs 落不了库）；DuckDB 是官方 quickstart 的本地推荐组合（LibSQL 主库 + DuckDB 观测域），附带 metrics 聚合。分文件的收益：删掉 `observability.duckdb` 重置演示数据，不伤会话历史。

`createCompositeStorage` 的三个细节：

- `domains` 放的是**域实例**而非 store：DuckDB 域经 `duckdb.getStore('observability')` 异步取出，函数因此是 `async`；`ensureDbDir` 先跑，避免原生模块对缺失目录报错
- composite 的 init 先跑 default 父 store，再单独 init 未覆盖域
- `CompositeStorageOptions`（`defaultDbUrl` / `observabilityDomain`）支持注入：测试用临时目录 + LibSQL 域替身，不加载 DuckDB 原生模块、不污染真实 `.temp`

## thread / resource 双层隔离

Mastra 记忆两个坐标：thread（会话）与 resource（归属者）。映射发生在适配层（`packages/agents/src/mastra`）：

```ts
const thread =
  typeof request.passthrough?.conversationId === 'string'
    ? request.passthrough.conversationId
    : `mastra_thread_${generateId()}`
return { thread, resource: this.options.resource ?? 'ai-chat' }
```

- 前端把 `conversationId` 放进请求体（playground 的 `sse-adapter` 取 `getConversationId()`），网关透传为 `passthrough.conversationId`，同一个会话的上下文由记忆补全
- 未传时每轮生成独立 thread（`mastra_thread_` 前缀 id），不跨轮记忆
- `resource` 默认 `'ai-chat'`，是记忆的命名空间：多用户场景按用户区分（如 `user:{userId}`，服务端强制覆写防客户端伪造），thread 在 resource 内才是全局唯一

## token 三档控制（可选能力，当前未启用）

Memory 的 `options` 控制每轮**喂给模型多少历史**，三档由浅入深：

| 档 | 字段 | 机制 | 默认 |
| --- | --- | --- | --- |
| 滑窗 | `options.lastMessages` | 取 thread 最近 N 条，`false` 关闭历史 | `10` |
| 语义召回 | `options.semanticRecall` | 向量检索召回相关历史消息（`{ topK, messageRange, scope }`），需配 `vector` + `embedder` | `false` |
| 工作记忆 | `options.workingMemory` | 精简状态文件（markdown 模板或 zod schema）随 prompt 注入，agent 运行中自行更新 | 关闭 |

设计哲学是「存得多、喂得少」：落盘永远是全量消息（不可重建的用户数据），喂给模型的按档裁剪——滑窗管「最近聊了什么」，semanticRecall 管「之前聊过相关的什么」（背后是向量检索，原理见 [语义检索](/guide/mastra#语义检索-libsqlvector-本地-ollama-rag)），workingMemory 管「当前任务状态摘要」。

三档是可选能力，**当前项目未启用后两档**（`createMemory` 只传 storage）。若要开启，形如：

```ts
// 可选能力示例，当前未启用
new Memory({
  storage: new LibSQLStore({ id: 'dev-server-memory', url: dbUrl }),
  vector, // MastraVector 实例，semanticRecall 的前置依赖
  embedder, // embedding 模型，查询与历史消息需同模型
  options: {
    lastMessages: 20,
    semanticRecall: { topK: 3, messageRange: 2, scope: 'resource' },
    workingMemory: { enabled: true, scope: 'resource', template: '# 用户偏好\n- ' },
  },
})
```

不启用的理由与 docs-agent 的最小 memory 注释一致：semanticRecall 引入向量库与 embedder 的运行成本和复杂度，workingMemory 会跨会话累积用户画像——对演示型 dev-server 是副作用大于收益；需要时三档都挂在同一个 `Memory` 构造上，装配层一行不改。
