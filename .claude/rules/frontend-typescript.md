# TypeScript 编码规范

> 适用范围：`packages/*/src` 全部 `.ts` / `.vue` 源码。本项目所有包均为 TypeScript，`core` 是纯 TS 零依赖包，类型即公共 API。

## 1. 严格性

- 全程保持 TS 严格模式（各包 `tsconfig.json` 已启用 `strict`），不因图省事降级
- **禁止 `any`**：拿不准类型时用 `unknown` + 收窄；与宿主交互的宽松数据（如 `Message.metadata`）显式声明为索引类型而非 `any`
- 类型断言 `as` 只用于类型收窄有依据的场景（如 `e instanceof Error` 之后）；禁止用 `as` 绕过类型错误
- 非空断言 `!` 慎用；宁可写空值兜底逻辑

## 2. 类型设计

- **导出类型 = 公共 API**：跨包使用的类型（`Message`/`StreamChunk`/`ChatAdapter` 等）从 `@toimc/core` 统一导出，其他包 re-export，不各自复制定义
- 优先 `interface` 描述对象结构，`type` 描述联合/工具类型；可扩展的公共 Props 用 `interface` 并保留 `extends` 空间
- 泛型用于真正的复用场景（工具函数、`ApiResponse<T>` 式包装），不为泛型而泛型
- 可选字段表达渐进增强（如 `attachments?`/`toolCalls?`），不用联合类型堆叠形态

## 3. 不可变更新

```ts
// 错误：直接修改响应式对象或入参
function updateUser(user: User, name: string) {
  user.name = name
  return user
}

// 正确：展开运算符生成新对象（Vue reactive 场景除外，见 frontend-vue.md）
function updateUser(user: User, name: string): User {
  return { ...user, name }
}
```

## 4. 错误处理

- 异步操作一律 `try-catch` 包裹，catch 中 `throw new Error('面向用户可读的信息')`，不吞错、不静默返回
- 网络类操作必须支持 `AbortSignal`（对齐 `SendMessageOptions.signal`），中断不算错误，不进入错误分支
- 边界输入（空数组、null、超长流）显式处理，不依赖默认行为

## 5. 异步与流式范式

- 流式输出统一用 `AsyncGenerator<StreamChunk>`（`async *function` + `yield`），对齐 `ChatAdapter` 接口；不用回调、不用事件总线
- 消费端用 `for await...of`，循环内逐块处理并响应 `signal.aborted`
- 并发无依赖任务用 `Promise.allSettled`（部分失败不拖垮整体）；有依赖必须串行

## 6. 代码风格

- 生产包代码禁止 `console.log`；调试输出用完即删，不留给构建产物
- 不引入未使用的变量/导入（ESLint recommended 已拦截）；不用 `// @ts-ignore`，确需跳过用 `@ts-expect-error` 并附原因
- 命名沿用全局约定：文件 kebab-case、组件 PascalCase、函数/变量 camelCase、类型 PascalCase、常量 UPPER_SNAKE_CASE
- 不加多余注释，代码自解释；只有"为什么这么写"值得留注释

## 7. 依赖纪律

- 新增运行时依赖前先确认现有代码无法覆盖；`core` 保持零依赖红线
- 包间引用只用 `workspace:*`，禁止绕过 workspace 直接引源码路径
- 对齐官方脚手架默认版本，不主动追最新（见全局记忆 create-vue 版本锚点）
