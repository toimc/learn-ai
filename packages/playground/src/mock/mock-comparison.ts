export interface ComparisonMock {
  question: string
  leftLabel: string
  rightLabel: string
  left: string
  right: string
}

// 与 mock-messages.ts 同风格：数组按行 join，避免模板字符串与 Markdown 反引号冲突
const leftContent = [
  '**一律用 `ref`，心智模型最简单。**',
  '',
  '```ts',
  "import { ref, computed } from 'vue'",
  '',
  'const count = ref(0)',
  'const double = computed(() => count.value * 2)',
  '```',
  '',
  '要点：',
  '',
  '- `ref` 可包装任意类型，访问统一走 `.value`',
  '- 整体替换不丢响应性，解构安全',
  '- `computed` 派生值自动追踪依赖并缓存',
].join('\n')

const rightContent = [
  '**按场景分工，工程上更好维护。**',
  '',
  '```ts',
  "import { reactive, ref } from 'vue'",
  '',
  '// 组合式函数返回值 → ref（调用方可安全解构）',
  'function useCounter() {',
  '  const count = ref(0)',
  '  return { count }',
  '}',
  '',
  '// 组件内表单聚合 → reactive（免 .value 样板）',
  "const form = reactive({ name: '', age: 0 })",
  '```',
  '',
  '- 对外暴露的 composable 一律返回 `ref`',
  '- 组件内部聚合对象可用 `reactive` 减少样板',
  '- 团队约定优先，风格统一胜于局部最优',
].join('\n')

export const comparisonMock: ComparisonMock = {
  question: 'Vue 3 里响应式状态选 ref 还是 reactive？给我两个不同角度的回答',
  leftLabel: '回复 A · 基础视角',
  rightLabel: '回复 B · 工程视角',
  left: leftContent,
  right: rightContent,
}
