# 测试指南

本篇介绍 ai-chat-ui 的测试体系：单元测试、组件测试与集成测试如何分层，工具链如何配置，以及如何编写与运行测试。承接 [开发指南](/guide/development)，面向参与组件库开发的贡献者。

## 测试分层

| 层次 | 被测对象 | 工具与视角 | 示例 |
|------|----------|-----------|------|
| 单元测试 | `core` 纯逻辑（工具函数、`useChat` 状态机、AsyncGenerator 流消费） | Vitest 纯断言，不依赖 DOM | `packages/core/src/utils/index.test.ts` |
| 组件测试 | 单个 Vue 组件的 props / emits / slots / provide 上下文 | @vue/test-utils，`mount` 直查实现细节 | `packages/vue/src/prompt-input/PromptInput.test.ts` |
| 集成测试 | 多组件 + `useChat` + adapter 拼成的完整链路 | Testing Library，宿主视角只查用户可感知信号 | `packages/vue/src/integration/chat-flow.test.ts` |

三层互补，不是替代关系：

- **VTU 查实现细节**：`mount` 返回 wrapper，可以直接断言 props 传递、provide/inject 上下文、`emitted()` 事件——验证的是「组件契约」。例如 `PromptInput.test.ts` 在 default slot 里放一个探针组件，拿到 `provide` 出来的上下文逐项断言。
- **TL 查用户行为**：查询只走 role / 文本 / placeholder（用户可感知的信号），交互用 userEvent 模拟真实键盘鼠标——验证的是「用户能否完成任务」。实现重构（换类名、改内部结构）时测试不需要跟着改。
- **单元测试守 `core` 零依赖红线**：纯函数与 mock 流不碰浏览器 API，任何环境下都能跑；`core` 的行为正确性在这一层兜底。

选型经验：验证组件对外契约用 VTU；验证「输入 → 发送 → 流式回复上屏」这类用户旅程用 TL；不碰 DOM 的逻辑沉到 `core` 用纯单元测试。

## 工具链

| 工具 | 角色 |
|------|------|
| Vitest 4 | 测试框架与 runner，测试文件与源码同目录 |
| @vue/test-utils | 组件测试（存量） |
| jsdom | 浏览器 DOM 模拟环境 |
| @testing-library/vue 8 | 集成测试：`render` / `screen` / `cleanup`（新增） |
| @testing-library/jest-dom 7 | DOM 断言 matchers（新增） |
| @testing-library/user-event 14 | 真实键盘鼠标交互模拟（新增） |

测试配置集中在根目录 `vitest.config.ts`，所有包共用一份：

- `globals: true`：`describe` / `it` / `expect` 无需 import
- `environment: 'jsdom'`：全局 DOM 环境
- `include: ['packages/*/src/**/*.{test,spec}.{ts,tsx}']`：测试文件放在被测模块旁（`foo.ts` ↔ `foo.test.ts`），不集中建 `__tests__` 目录
- `@toimc/core` 别名指向 `packages/core/src/index.ts`：包 exports 指向 dist 产物，测试内的值导入统一走源码解析

### 根级 tests/setup.ts

每个测试文件加载前执行，做两件事：

1. `import '@testing-library/jest-dom/vitest'` — 全局注册 jest-dom matchers（`toBeInTheDocument` 等），运行时对所有用例生效
2. polyfill jsdom 缺失的 `window.matchMedia` 与 `ResizeObserver` — 暗色模式监听、容器查询等能力依赖这两个 API

## 如何跑测试

> 本仓库的 pnpm 由 corepack 托管，以下命令均可通过 `corepack pnpm <command>` 调用。

| 命令 | 作用 |
|------|------|
| `corepack pnpm test` | 全量跑所有包的测试 |
| `corepack pnpm test:watch` | 监听模式，文件变更自动重跑 |
| `corepack pnpm vitest run packages/vue/src/integration/chat-flow.test.ts` | 只跑单个测试文件 |
| `corepack pnpm vitest run packages/core` | 按目录过滤，只跑某个包的测试 |
| `corepack pnpm vitest run -t "maxHistory"` | 按用例名过滤（`-t` 匹配 describe/it 名称，跨文件生效） |
| `corepack pnpm vitest run --coverage` | 带覆盖率报告（见下文门禁说明） |

提交前三绿：`pnpm test` / `pnpm type-check` / `pnpm lint`。worktree 或全新环境中跑 type-check 前，需先 `pnpm build` 出 `core` 的 dist（类型检查消费构建产物，详见 [开发指南](/guide/development)）。

用例如何设计（正常 / 边界 / 异常三场景 + AAA）、组件与 composable 测试的实操技巧，见 [单元测试实战](/guide/unit-testing)。

## 写集成测试：宿主视角

以 `packages/vue/src/integration/chat-flow.test.ts` 为例。思路：用与真实宿主（playground 的 MockServerDemo）一致的组装方式，把 `Conversation` / `Message` / `PromptInput` 与 `@toimc/core` 的 `useChat` 拼成一个内联 `ChatFlowDemo`，端到端验证「输入 → 发送 → 流式回复上屏」整条链路。

### 第一步：mock adapter 模拟后端流

`ChatAdapter` 是唯一的后端边界，mock 只打在这里——不 mock 组件内部实现。用 `async *function` 按预置顺序 yield chunk，即可模拟后端 SSE 流：

```ts
function textChunk(content: string): StreamChunk {
  return { type: 'text', content }
}

/** 流式 mock adapter：按预置顺序 yield chunk，模拟后端 SSE 流 */
function makeAdapter(chunks: StreamChunk[]): ChatAdapter {
  return {
    async *sendMessage() {
      for (const chunk of chunks) yield chunk
    },
  }
}
```

被测组件由工厂函数创建：adapter 通过闭包注入（对应真实宿主在 `setup` 里 `useChat(adapter)` 的写法），错误按宿主契约渲染成 `role="alert"` 提示条。结构节选：

```ts
function createChatFlowDemo(adapter: ChatAdapter) {
  return defineComponent({
    name: 'ChatFlowDemo',
    setup() {
      const chat = useChat(adapter)

      return () =>
        h(Conversation, null, {
          default: () => [
            // ConversationContent 内渲染 Message + MessageContent 消息列表
            chat.error ? h('div', { role: 'alert' }, chat.error.message) : null,
            // PromptInput 组装输入区，onSend 里 void chat.send(payload.text)
          ],
        })
    },
  })
}
```

完整实现见源文件，组装方式与 playground 一一对应——集成测试就是一段「会断言的 Demo」。

### 第二步：render + userEvent + findBy* 走完用户旅程

第一个用例覆盖「键盘发送 + 流式上屏」：

```ts
it('Alt+Enter 发送后，用户消息与流式回复的完整文本依次上屏', async () => {
  const reply = '流式渲染分块到达，最终拼成完整回复'
  const adapter = makeAdapter([
    textChunk('流式渲染'),
    textChunk('分块到达，'),
    textChunk('最终拼成完整回复'),
  ])
  render(createChatFlowDemo(adapter))

  // Arrange：发送前对话区没有任何回复
  expect(screen.queryByText(reply)).not.toBeInTheDocument()

  const user = userEvent.setup()
  await user.type(screen.getByRole('textbox'), '讲讲流式渲染')
  // sendKey 默认 alt-enter：Enter 原生换行，Alt+Enter 才提交
  await user.keyboard('{Alt>}{Enter}{/Alt}')

  // 用户消息立即上屏；助手回复以 chunk 顺序拼接，最终完整可见
  expect(await screen.findByText('讲讲流式渲染')).toBeInTheDocument()
  expect(await screen.findByText(reply)).toBeInTheDocument()
})
```

逐段拆解：

- **`render(...)`**：Testing Library 的 render 把组件挂到 `document.body`，此后所有查询都走全局 `screen`，测试不需要持有组件引用
- **`screen.getByRole('textbox')`**：查询只走用户可感知的信号（role / 文本 / placeholder），不触碰组件内部——这是 TL 与 VTU（`wrapper.find('.ai-chat-xxx')`）的本质区别
- **`userEvent.setup()` → `user.type` / `user.keyboard`**：模拟真实键盘与鼠标的事件序列。`{Alt>}{Enter}{/Alt}` 表示按住 Alt 再按 Enter——sendKey 默认 `alt-enter` 时，Enter 是原生换行，Alt+Enter 才提交
- **`queryByText` 同步断言「发送前没有」**、**`findByText` 异步等待「发送后出现」**：流式回复要经过多个微任务才逐块上屏，`findBy*` 会轮询重试直到命中或超时——这是断言异步流式输出的标准姿势，不需要手写 `sleep` 或 `nextTick` 轮询

第二个用例补充「点击发送按钮」路径与输入框状态断言：

```ts
// placeholder 走 i18n 默认 zh-CN 文案
const input = screen.getByPlaceholderText('给 AI Chat UI 发送消息...')
await user.type(input, '你好')
await user.click(screen.getByRole('button', { name: '发送' }))

await screen.findByText('收到')
expect(screen.getByRole('textbox')).toHaveValue('')
```

## 两个必踩的坑（本项目真实经验）

### 坑一：jsdom 下默认 locale 是 en-US

组件 i18n 是模块级单例，模块加载时 `getInitialLocale()` 会读 `navigator.language`——jsdom 里它是 `en-US`，于是单例被初始化为英文，所有断言中文文案的用例都会失败。解决：用例前显式切回中文；又因为单例状态跨用例共享，`afterEach` 里也要复位：

```ts
// jsdom 的 navigator.language 是 en-US，i18n 单例据此初始化为英文；
// 断言默认中文文案前需显式切回（与 PromptInput.i18n.test.ts 同约定）
beforeEach(() => setAiChatLocale('zh-CN', { persist: false }))
afterEach(() => setAiChatLocale('zh-CN', { persist: false }))
afterEach(cleanup)
```

`persist: false` 避免把测试语言写进 jsdom 的 localStorage；`cleanup` 是 Testing Library 的清理函数，卸载本用例渲染的组件，防止 DOM 跨用例泄漏。

### 坑二：jest-dom matcher 的类型对 vue-tsc 不可见

根级 `tests/setup.ts` 已经全局注册了 jest-dom matchers，但**运行时生效 ≠ 类型可见**：`setup.ts` 不在各包 tsconfig 的程序（`include`）内，jest-dom 的类型增强（给 `expect(...)` 声明合并 `toBeInTheDocument` 等方法）对本包的 `vue-tsc` 检查不可见。解决：测试文件里再 import 一次：

```ts
// setup.ts 在根目录、不在本包 tsconfig 程序内：文件内再引入一次，
// 让 jest-dom matcher 的类型增强对 vue-tsc 可见（运行时幂等）
import '@testing-library/jest-dom/vitest'
```

该模块运行时幂等（重复导入无副作用），多这一次 import 换来类型检查通过。

## jest-dom 常用 matchers 速查

| Matcher | 断言 | 示例 |
|---------|------|------|
| `toBeInTheDocument()` | 元素已在文档中渲染 | `expect(await screen.findByText(reply)).toBeInTheDocument()` |
| `toBeVisible()` | 元素可见（非 `display:none` / `visibility:hidden` / `hidden`） | `expect(screen.getByRole('button')).toBeVisible()` |
| `toBeDisabled()` | 表单控件处于禁用态 | `expect(submit).toBeDisabled()` |
| `toBeEnabled()` | 表单控件可用 | `expect(submit).toBeEnabled()` |
| `toHaveValue(v)` | 输入框 / textarea 的当前值 | `expect(screen.getByRole('textbox')).toHaveValue('')` |
| `toHaveTextContent(t)` | 文本内容（支持子串与正则） | `expect(alert).toHaveTextContent('模型服务暂时不可用')` |
| `toHaveAttribute(name, value?)` | 属性断言 | `expect(input).toHaveAttribute('placeholder', '...')` |
| `toHaveClass(...cls)` | class 断言 | `expect(el).toHaveClass('ai-chat-message')` |
| `toHaveFocus()` | 元素持有焦点 | `expect(input).toHaveFocus()` |

## 覆盖率门禁

覆盖率配置在根目录 `vitest.config.ts`（V8 provider）。**当前只对 `markdown` 包设门禁**：

```ts
coverage: {
  provider: 'v8',
  include: ['packages/markdown/src/**'],
  exclude: [
    'packages/markdown/src/**/*.test.ts',
    'packages/markdown/src/types/**',
  ],
  thresholds: {
    statements: 80,
    branches: 75,
    functions: 80,
    lines: 80,
  },
},
```

即 `markdown` 包的语句 / 行 / 函数覆盖率 ≥ 80%、分支 ≥ 75%，低于阈值时 `vitest run --coverage` 直接以失败退出。`core` / `vue` 包暂未纳入门禁（按仓库 `.claude/rules/frontend-testing.md` 的口径，目标是 core 90%+ / vue 70%+，后续逐步纳入）。

### 查看三包全量覆盖率

门禁之外的日常摸底，可以临时把 `--coverage.include` 扩到三个发布包、阈值归零，只看报告不拦截：

```bash
corepack pnpm vitest run --coverage \
  --coverage.include='packages/core/src/**' \
  --coverage.include='packages/vue/src/**' \
  --coverage.include='packages/markdown/src/**' \
  --coverage.thresholds.statements=0 --coverage.thresholds.branches=0 \
  --coverage.thresholds.functions=0 --coverage.thresholds.lines=0
```

报告按文件列出未覆盖行号（`Uncovered Line #s` 列），直接对着源码补用例。2026-08 全量补测后的基线：**61 个测试文件 / 483 个用例，三包语句 96.6% / 分支 90.7% / 函数 95.2% / 行 98.2%**——新改动不应让这个基线回退。

## 延伸阅读

- 下一篇：[单元测试实战](/guide/unit-testing)——三场景用例设计、组件/composable 测试技巧与真实 bug 案例
- 上一篇：[开发指南](/guide/development)——项目结构、常用命令与编码规范
- [使用指南](/guide/usage)——ChatAdapter 接口与 useChat 的完整用法
- [PromptInput 组件文档](/components/prompt-input)、[Message 组件文档](/components/message)
- [useChat composable 文档](/composables/use-chat)
