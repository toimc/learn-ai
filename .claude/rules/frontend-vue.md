# Vue 3 组件开发规范

> 适用范围：`packages/vue`、`packages/markdown`、`packages/playground` 的组件与 composables。技术基线：Vue 3.5+ / `<script setup>` + TS / provide-inject 状态管理 / CSS Variables 样式。样式隔离细则见 [style-isolation.md](style-isolation.md)，不在此重复。

## 1. 范式

- 一律 Composition API + `<script setup lang="ts">`，不写 Options API，不用独立 `setup()` 函数
- 组件职责单一：布局容器（ChatWindow）、展示（MessageBubble）、无状态输入（InputArea）分层清晰，**组合优于配置**——新需求先考虑 slot / 组合，再考虑加 prop
- 状态管理只用 `provide/inject` + composable（如 i18n 的 `createI18n`/`useI18n`），**不引入 Pinia**；跨组件事件走 `defineEmits` 上抛宿主，不用事件总线
- 第三方能力通过 `provide/inject` 注入（如 markdown 的渲染配置），组件不直接耦合具体实现

## 2. Props / Emits / Slots

```vue
<script setup lang="ts">
// Props 用类型声明 + withDefaults，不用运行时对象声明
interface Props {
  messages: Message[]
  streaming?: boolean
}
const props = withDefaults(defineProps<Props>(), { streaming: false })

// Emits 声明完整参数类型
const emit = defineEmits<{
  retry: [messageId: string]
  'update:modelValue': [value: string]
}>()
</script>
```

- **禁止直接修改 props**；子组件要改值就 emit 上抛（`update:modelValue`）
- 双向绑定用 `defineModel`（Vue 3.5+）或规范命名的事件对，不自造约定
- 数据展示与数据来源分离：优先作用域 slot（如 MessageList）把渲染权交给宿主，组件只管结构与行为
- 新增公共 prop 前自问：这是长期能力还是临时需求？对照业界主流组件库（对标而非极简，见全局规范）

## 3. 响应式

- 基础值用 `ref`，聚合状态用 `reactive`；解构会丢失响应式的场景用 `toRefs`，不手动展开
- 大对象/纯渲染数据（markdown 产物、高亮结果）用 `shallowRef` / `markRaw`，避免深层响应式开销
- `watch` 显式声明依赖与 `{ immediate, deep }` 选项；副作用能收敛为派生值就用 `computed`，不用 watch 改状态
- 组件卸载清理副作用：手动 `addEventListener` / `ResizeObserver` / `setInterval` / `URL.createObjectURL` 必须在 `onUnmounted` 对应移除/清零/revoke
- composable 命名 `use*`，纯逻辑（不依赖组件实例）放 `core`，依赖 Vue 的放 `vue` 包 `composables/`

## 4. 模板

- `v-for` 必须绑定稳定唯一的 `:key`（用 `message.id` 这类业务 id，禁止用 index）
- `v-if` 与 `v-show` 按语义选：条件渲染用 `v-if`，频繁切换可见性用 `v-show`（CSS hover 显隐用 `visibility`，见 CLAUDE.md 样式经验）
- 不在模板写复杂表达式，收敛到 `computed`
- 禁止直接操作 DOM（`document.querySelector`）；确需引用元素用 `ref` 模板引用。SSR 兼容：`document`/`window` 访问必须包在 `onMounted` 或环境判断内（docs VitePress 是 SSR 构建）

## 5. 性能

- 流式渲染高频更新场景：内容分块 + 只更新增量目标，不整树重挂载；必要时 debounce
- 事件驱动的高频交互（输入、滚动）先 debounce/throttle 再触发状态更新
- 重组件（Shiki/KaTeX/Mermaid）一律动态 `import()` 懒加载，不进主 chunk；验证 tree-shaking（agadoo）不回退
- `v-for` 长列表渲染保持 key 稳定；出现性能问题先测（PerformanceMetrics）再优化，不预先过度设计

## 6. 反模式清单

| 反模式 | 正确做法 |
|---|---|
| 改 props / 复制 props 到本地 ref 再双向同步 | `defineModel` 或 emit 上抛 |
| 深层 `reactive` 包大对象 | `shallowRef` + 整体替换 |
| `provide` 值不带类型/不导出 injection key | 导出 `InjectionKey<T>` 常量 |
| 在 `<script setup>` 顶层访问 `document` | 移入 `onMounted` 或 SSR 判断 |
| 万能 prop 开关 (`useXxx?: boolean`) | 拆子组件或用 slot 组合 |
| 组件内硬编码文案 | 走 i18n `t()` |
