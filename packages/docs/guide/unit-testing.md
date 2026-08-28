# 单元测试实战

本篇是 [测试指南](/guide/testing) 的实战篇：单元与组件测试的用例如何设计（三场景 + AAA）、组件与 composable 测试的两个代表性技巧，以及一个被测试当场抓获的真实生产 bug。素材全部来自 2026-08 的全量补测——61 个测试文件、483 个用例，三包行覆盖率从 87% 提到 98%。

## 用例设计：三场景 + AAA

每个被测单元（函数、组件交互、composable 分支）至少覆盖三类场景，每条用例遵循 Arrange-Act-Assert 结构。这是本仓库 `.claude/rules/frontend-testing.md` 的硬要求，也是覆盖率能站上 96% 的方法论：

| 场景 | 覆盖什么 | 本仓库真实用例 |
|------|----------|----------------|
| **正常** | 主路径行为 | ThinkingBlock 传入 `duration: 5300` 渲染「已思考 5.3 秒」 |
| **边界** | 空输入、阈值分界、极端值、恰好等于上限 | `formatFileSize(1023)` → `'1023 B'`、`formatFileSize(1024)` → `'1.0 KB'`（1024 分界）；`useScrollAnchor` 距底恰好 50px 判**不在**底部（`<` 而非 `<=`）；`maxHistory` 消息数恰好等于上限时不裁剪 |
| **异常** | 抛错、失败、非法输入、中断 | 适配器抛 `AbortError` 不进入 error 分支；剪贴板 `writeText` reject 时静默放弃不进「已复制」态；高亮渲染抛错降级为空串保留结构 |

边界场景的重点是**分界值的两侧都要测**：ThinkingBlock 的时长格式化在 10 秒处切换规则（`9500ms → '9.5'`、`10500ms → '11'`），只测一侧发现不了 `Math.round` 与 `toFixed(1)` 的切换 bug。异常场景必须有显式断言，不允许只期望「不崩」——中断测试要断言状态回到 idle 且 `error` 为 null，剪贴板失败要断言按钮**没有**进入 `is-copied` 类。

AAA 结构示例（`useScrollAnchor` 的阈值边界用例，`packages/vue/__tests__/composables/useScrollAnchor.test.ts`）：

```ts
it('边界：距底恰好等于阈值 50 判定为在底部（< 而非 <=）', () => {
  // Arrange：构造距底恰好 50px 的滚动容器
  const anchor = useScrollAnchor()
  const el = makeScrollEl({ scrollTop: 550, scrollHeight: 1000, clientHeight: 400 })
  anchor.bindContainer(el)

  // Act：触发 scroll 事件
  el.dispatchEvent(new Event('scroll'))

  // Assert：1000 - 550 - 400 = 50，不小于 50 → 不在底部
  expect(anchor.isAtBottom.value).toBe(false)
})
```

一条实战经验：**优先攻击从未测过的公开选项**。`useChat` 的 `maxHistory` 与 `abort` 是文档里明写的 API，却长期没有用例——补上第一条 `maxHistory` 用例就直接暴露了一个启用即栈溢出的生产 bug（见下文）。

## 技巧一：provide/inject 组件族用 `global.provide` 直挂

tool-call 目录的五个组件共享一个 inject 上下文（`ToolCall` 外壳 `provide('toolCallData', data)`，Header / Input / Output 消费）。测子组件不需要拼装真实外壳，直接在 `mount` 选项里 provide：

```ts
// packages/vue/__tests__/tool-call/ToolCall.test.ts
function mountInsideShell(component: typeof ToolCallHeader, data: ToolCallInfo) {
  return mount(component, {
    global: { provide: { toolCallData: data } },
  })
}

it.each([
  ['calling', '⚡', 'ai-chat-tool-call-header--calling'],
  ['completed', '✓', 'ai-chat-tool-call-header--completed'],
  ['error', '✗', 'ai-chat-tool-call-header--error'],
] as const)('status=%s 渲染 %s 图标与对应类名', (status, icon, cls) => {
  const w = mountInsideShell(ToolCallHeader, makeToolCall({ status }))
  expect(w.get('.ai-chat-tool-call-header__icon').text()).toBe(icon)
  expect(w.get('.ai-chat-tool-call-header').classes()).toContain(cls)
})
```

比拼装外壳少一层间接：mock 边界落在「父组件给的上下文」这一外部契约上，外壳自身的 slot 与展开行为另立用例单独测。

## 技巧二：jsdom 没有布局引擎，滚动类 composable 手造环境

`useScrollAnchor` 的核心逻辑读 `scrollTop / scrollHeight / clientHeight` 并依赖 `ResizeObserver` 与 `requestAnimationFrame`——jsdom 里前三个永远是 0，根级 `tests/setup.ts` 的 ResizeObserver polyfill 是空实现（驱动不了回调）。解法：`Object.defineProperty` 直接控滚动指标，用一个可手动 `trigger()` 的 mock 类替代 ResizeObserver：

```ts
// packages/vue/__tests__/composables/useScrollAnchor.test.ts
function makeScrollEl(metrics: {
  scrollTop: number
  scrollHeight: number
  clientHeight: number
}) {
  const el = document.createElement('div')
  for (const [key, value] of Object.entries(metrics)) {
    Object.defineProperty(el, key, { value, writable: true, configurable: true })
  }
  document.body.appendChild(el)
  return el
}

class MockResizeObserver {
  static instances: MockResizeObserver[] = []
  disconnected = false
  constructor(
    private readonly cb: () => void,
    public readonly observed: Element[] = [],
  ) {
    MockResizeObserver.instances.push(this)
  }
  observe(el: Element) {
    this.observed.push(el)
  }
  disconnect() {
    this.disconnected = true
  }
  trigger() {
    this.cb() // 测试里手动驱动「容器尺寸变化」
  }
}
```

`beforeEach` 里替换 `window.ResizeObserver`，`afterEach` 恢复原值并清理 DOM。配合 `await new Promise(r => requestAnimationFrame(r))` 等 rAF 落地，就能断言「内容增高时若在底部自动滚到底、用户上滑后不再强制跟随」这类交互行为。凡是断言「disconnect 被调用」的生命周期用例，都依赖 mock 类上自记的 `disconnected` 标记——空 polyfill 给不了这个信号。

## 一个被测试当场抓获的生产 bug

给 `useChat` 的 `maxHistory` 选项写下**第一条**用例就直接栈溢出——这个公开 API 从文档写明起就没人测过，启用即崩的 bug 一直沉睡。

原实现想在 push 上挂裁剪逻辑：

```ts
// 反例：对 reactive 数组 monkey-patch push
const originalPush = state.messages.push.bind(state.messages)
state.messages.push = function (...items: Message[]) {
  const result = originalPush(...items) // ← 无限递归
  while (state.messages.length > max) state.messages.shift()
  return result
}
```

根因是 Vue 3 reactivity 对 `push` / `pop` / `shift` / `unshift` / `splice` 做了 **instrumentation**：proxy 的 `get('push')` 永远返回 instrumented 版本（优先级高于自身属性），而 instrumented push 内部执行 `toRaw(this)['push'](...)`——此时从 raw 数组读到的 `push` 正是被 set 写进 target 的包装函数自身，于是包装函数调 originalPush（bind 的 instrumented push）→ 再次 `toRaw().push` → 无限递归。

修复是把行为收敛为显式函数，在写入点调用：

```ts
// 正例：显式 trim，不碰数组方法
function trimHistory(): void {
  const max = options?.maxHistory
  if (!max) return
  while (state.messages.length > max) {
    state.messages.shift()
  }
}

// send 内：assistant 消息入列后裁一次
state.messages.push(assistantMessage)
trimHistory()
```

两条教训：**对 reactive 数组加自定义行为永远不要覆盖数组方法**，在写入点显式调用函数；**文档里写了但没测过的公开选项是最高风险的测试缺口**——补测时优先攻击它们。

## 延伸阅读

- 上一篇：[测试指南](/guide/testing)——测试分层体系、工具链配置与集成测试实战
- [开发指南](/guide/development)——项目结构、常用命令与编码规范
- [useChat composable 文档](/composables/use-chat)——`maxHistory` / `abort` 的 API 说明
