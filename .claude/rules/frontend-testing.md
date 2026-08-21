# 前端测试规范

> 适用范围：全部 `packages` 的 Vitest 测试（`*.test.ts` 与组件测试）。工具链：Vitest + @vue/test-utils + jsdom。覆盖率门禁：core 90%+ / markdown 75%+ / vue 70%+（statements 口径见各包配置）。

## 1. 文件组织

- 测试文件放在被测模块旁（`foo.ts` ↔ `foo.test.ts`），不集中建 `__tests__` 目录
- 按模块分文件：`useChat.test.ts`、`MessageBubble.test.ts`；一个被测单元一个测试文件
- 命名描述行为而非实现：`'空内容时点击发送不触发 send 事件'` 优于 `'test send 1'`

## 2. 用例设计：三场景 + AAA

每个函数/组件交互至少覆盖三类场景，每条用例遵循 Arrange-Act-Assert：

```ts
it('流式结束时拼接完整文本', async () => {
  // Arrange
  const chunks = [textChunk('你'), textChunk('好')]
  // Act
  const state = await consume(makeAdapter(chunks))
  // Assert
  expect(state.messages[0].content).toBe('你好')
})
```

- **正常**：主路径行为
- **边界**：空数组、空字符串、中断（abort）、超长输入、并发流
- **异常**：适配器抛错、网络失败、非法 chunk 类型 —— 异常路径必须有断言，不允许只期望"不崩"

### 预期值独立性（防同义反复断言）

断言的预期值必须独立于实现来源，否则测试与实现同源同错，形同虚设：

```ts
// 反例：预期值用与实现完全相同的表达式计算——实现把缩进写错（如 null, 4）测试照样绿
expect(w.get('pre').text()).toBe(JSON.stringify({ city: 'Beijing' }, null, 2))

// 正例：预期值写死字面量（来自需求/手工计算），实现偏离格式时测试必须红
expect(w.get('pre').text()).toBe(`{
  "city": "Beijing"
}`)
```

- **预期值只允许三个来源**：手写的字面量、需求/文档写明的值、独立第三方实现（标准库、竞品行为、另一条不共享代码的路径）的输出
- **禁止在断言里调用被测函数自身**（`expect(f(x)).toBe(f(x))` 的任何变体）或复用实现内的同一表达式/同一工具函数计算预期
- 弱断言黑名单（除非注释说明理由）：`toBeTruthy()` / `toBeDefined()` / 裸 `not.toThrow()`（异常用例必须有状态或错误内容的显式断言，见第 2 节）
- 新测试必须先见过一次红灯（在实现缺失/故意改错时失败）才算数——红灯证据是防自证的最直接手段

## 3. core 层（纯逻辑）

- 不依赖 DOM，node 环境直接测；AsyncGenerator 用 `async *function` 构造 mock 流，`for await` 断言每个 chunk
- 中断测试：传入已 abort 的 `AbortSignal`，断言流停止且状态回到 idle，无错误消息残留
- ID 生成类工具断言前缀与唯一性；localStorage 持久化逻辑注入 mock storage 测序列化/反序列化/损坏数据回退

## 4. Vue 组件测试

- `mount` 为主（真实渲染链路），确需隔离子组件用 `shallowMount` 或 `global.stubs`，并注明隔离原因
- Props 断言渲染结果（文本、CSS 类名、`data-*`），不 snapshot 整棵树；行为用 `trigger('click')` / `setValue` 后断言 `emitted()`
- 流式组件（StreamText 等）用 `vi.useFakeTimers()` 或真实 `await nextTick()` 控制时序，不用固定 sleep
- jsdom 缺的 API（matchMedia、ResizeObserver）在 setup 文件统一 polyfill，不在单个测试里打补丁
- slot 测试传具名 slot 内容断言透传位置

## 5. Mock 与 Stub 纪律

- Mock 边界在 adapter / fetch / storage / timer，**不 mock 被测模块内部实现**；mock 数量越少测试越可信
- `vi.mock` 模块级提升注意：路径必须与被测文件 import 路径一致
- 每条测试后恢复现场：`afterEach(() => vi.restoreAllMocks())`，不让状态跨用例泄漏

## 6. 运行与提交

- 全量 `pnpm test`、类型 `pnpm type-check`、lint 三绿才算完成（worktree 内注意先 build core 出 dist 再 type-check）
- 测试失败先修测试对应的真实问题，禁止删除断言、放宽期望值来"变绿"；确属 flaky 用例修时序而非重试
- 新公共 API（类型、组件 props/events）合入时同步补测试；修 bug 先写复现测试再修（回归测试固化）
- 测试文件不留 `console.log`、`it.only`、`it.skip`（确需 skip 附 TODO 注释与 issue 号）

## 7. 提交前自查

- [ ] 新逻辑有 正常/边界/异常 三类用例？
- [ ] 异步用例都 `await` 了断言（无悬浮 promise）？
- [ ] mock 范围只在外部边界？
- [ ] `pnpm test` 在 worktree 内完整跑过一遍？
