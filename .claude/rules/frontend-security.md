# 前端安全规范

> 适用范围：全部 `packages` 源码。本项目是嵌入任意宿主的组件库，任何安全缺陷都会被复制到所有宿主应用，标准从严。沙箱 iframe（Mermaid）与 XSS 白名单的具体实现在 `packages/markdown`，此处为通用规则。

## 1. XSS 与 v-html

- **`v-html` 只允许渲染经过 DOMPurify 消毒的内容**，且消毒必须发生在渲染前最后一次拼接之后（先转义/消毒，再拼结构，不再插入原始文本）
- 用户/AI 产出的内容（消息正文、代码块、公式、文件名）一律视为不可信输入，进入 HTML 前必须过管道；markdown-it 渲染结果同样过 DOMPurify，不因"来源是 markdown"而豁免
- 禁止 `innerHTML`/`outerHTML` 赋值、`document.write`、`eval`、`new Function`、`javascript:` URL
- 代码高亮（Shiki）输出若含双解码风险（`decodeEntities` 类选项）保持默认安全配置，改动需复查

## 2. 沙箱隔离

- 嵌入第三方渲染产物（Mermaid SVG 等）统一走 **sandbox iframe 且不带 `allow-same-origin`**（opaque origin，当前 `sandbox="allow-scripts"` 方案），改动前先读记忆 [mermaid-sandbox-iframe]
- iframe 内不注入宿主凭据、不发宿主域名请求；渲染产物先剔除 `<script>` 再注入
- 未来 Teleport 弹层、消息预览等脱离文档流的 UI，注意 z-index 令牌约束（见 style-isolation.md 第 6 条）

## 3. 密钥与敏感信息

```ts
// 严禁：硬编码密钥进源码/示例/测试
const apiKey = 'sk-proj-xxxxx'

// 正确：环境变量 + 启动校验；密钥只存在于 .env（不提交）或宿主侧
const apiKey = import.meta.env.OPENAI_API_KEY
if (!apiKey) throw new Error('OPENAI_API_KEY not configured')
```

- 组件库代码本身不持有任何密钥：API Key 由宿主在 `ChatAdapter` 实现中注入，组件/核心层不得出现密钥字段
- 不提交 `.env`、token、内部代理地址到版本控制（代理前缀只允许出现在 `.env`）
- 日志/错误信息不打用户消息原文与个人数据，只打 id、长度、错误类型等元信息

## 4. 输入与输出

- 宿主传入的 props（消息列表、附件 URL、文件对象）在使用前做基本校验：URL 只接受 `http(s)`/`blob:`/`data:image`，拒绝 `javascript:`
- `URL.createObjectURL` 创建的预览地址用完 `revokeObjectURL`，不留可被复用的 blob 引用
- 附件大小/类型限制交给宿主决策，组件只展示；不在库内静默处理越权文件
- localStorage（主题、会话持久化）读写包 try-catch，并视为不可信数据反序列化（解析失败回退默认值，不执行恢复逻辑）

## 5. 依赖与供应链

- 新增依赖先查维护状态与已知漏洞（`pnpm audit`）；`core` 零依赖红线不动摇
- 第三方 CSS 必须走可选子路径导出由宿主显式 import（style-isolation.md 第 4 条），隐式注入既是样式问题也是供应链问题
- 不在库内发任意网络请求；请求都发生在宿主提供的 adapter 里，库代码最多透传 `AbortSignal`

## 6. 提交前自查

- [ ] 新增的 `v-html` / 动态 HTML 构造都有 DOMPurify 消毒？
- [ ] 无密钥、token、内网地址硬编码？
- [ ] iframe sandbox 没有引入 `allow-same-origin`？
- [ ] 外部 URL 有协议白名单校验？
- [ ] 错误信息不泄漏用户消息内容？
