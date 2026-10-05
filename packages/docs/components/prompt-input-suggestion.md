# PromptInputSuggestion 输入内联建议

输入框内联建议浮层：输入 `/`、`@` 等触发字符唤起菜单，键入内容即过滤候选，键盘 ↑↓ 导航、Enter 选中、Esc 关闭。适合斜杠命令面板与 @提及选人两类场景。

**受控设计**：组件零内部输入状态——`text` / `caret` / `triggers` 全部由宿主传入，菜单开关由光标处的触发词解析结果派生。不依赖 PromptInput 上下文，可与任何 `<textarea>`（或 `PromptInputTextarea`）搭配：

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { PromptInputSuggestion } from '@toimc/vue'
import type { SuggestionTrigger } from '@toimc/vue'

const text = ref('')
const caret = ref(0)
const anchor = ref<HTMLElement | null>(null)

const triggers: SuggestionTrigger[] = [
  {
    char: '/',
    items: [
      { key: 'h1', label: '标题 1', description: '大标题' },
      { key: 'h2', label: '标题 2', description: '中标题' },
      { key: 'table', label: '表格', description: '3×3 带表头' },
    ],
  },
  { char: '@', items: [{ key: 'jo', label: 'John' }] },
]

// 宿主负责把光标位置喂给组件（textarea 原生 selectionchange 事件）
function syncCaret(e: Event) {
  caret.value = (e.target as HTMLTextAreaElement).selectionStart
}

function onSelect(_item: unknown, nextText: string) {
  text.value = nextText
}
</script>

<template>
  <div ref="anchor" style="position: relative">
    <textarea
      v-model="text"
      @selectionchange="syncCaret"
      @keyup="syncCaret"
      @click="syncCaret"
    />
    <PromptInputSuggestion
      :text="text"
      :caret="caret"
      :triggers="triggers"
      :anchor="anchor"
      @select="onSelect"
    />
  </div>
</template>
```

## 触发与过滤规则

- **激活条件**：光标向前扫描，触发字符必须位于词首（文本首 / 行首 / 空白之后），`a/b` 里的 `/` 不激活；触发词内出现空白即失效
- **query**：触发符之后到光标的串。光标停在触发词中间时只取到光标为止，替换后光标后的字符保留
- **过滤**：label 前缀 + 包含双策略，大小写不敏感；前缀命中排前、包含命中排后，组内保持原序；空 query 展示全部；无匹配展示空态文案（i18n `suggestion.empty`）
- **选中替换**：`replaceRange` 覆盖整个触发词（触发符 + query），替换为 `item.label`；`select` 事件回传 `(item, nextText)`，`nextText` 即替换后的完整文本，宿主直接回写 `text` 并按需复位光标

## 键盘交互

菜单打开时组件在 document 捕获阶段接管按键，`stopPropagation` 阻断事件下沉到 textarea、`preventDefault` 阻止默认行为（光标移动 / 换行）：

| 按键       | 行为                                                                   |
| ---------- | ---------------------------------------------------------------------- |
| `↑` / `↓`  | 导航候选，到边界回卷；长列表自动 `scrollIntoView`                      |
| `Enter`    | 选中当前项并 `emit('select')`；无匹配项时放行（不拦截宿主的发送/换行） |
| `Esc`      | 关闭菜单并 `emit('close')`，抑制冒泡（外层弹层不误关）                 |
| IME 组合中 | 一律放行，拼音候选期不误触                                             |

指针交互：菜单项 `mousedown` 选中（`preventDefault` 不抢 textarea 焦点）；菜单外 `pointerdown` 触发 `close`。

**关闭语义**：Esc / 外点关闭后，光标仍停留在同一触发词内不会自动复活；触发会话结束（光标离开触发词）后，再次输入触发字符可重新唤起。

## API

### PromptInputSuggestion

| 属性名   | 类型                  | 默认值 | 说明                                                                                                                            |
| -------- | --------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------- |
| text     | `string`              | —      | 输入框完整文本（受控，宿主维护）                                                                                                |
| caret    | `number`              | —      | 光标位置（宿主监听 `selectionchange` 等事件传入）                                                                               |
| triggers | `SuggestionTrigger[]` | —      | 触发器配置：触发字符 + 候选列表                                                                                                 |
| anchor   | `HTMLElement \| null` | `null` | 菜单挂载点，须为 `position: relative` 容器（通常包住 textarea 的包裹层）；缺省直挂 `body`，固定于视口左下角（`--fixed` 修饰类） |

| 事件名 | 参数                                       | 说明                                                                |
| ------ | ------------------------------------------ | ------------------------------------------------------------------- |
| select | `(item: SuggestionItem, nextText: string)` | 选中建议项；`nextText` 为替换触发词后的完整文本，光标复位由宿主处理 |
| close  | `()`                                       | Esc / 菜单外点击关闭                                                |

菜单浮层 `z-index` 使用 `--ai-chat-z-popup` 令牌；宽高、配色均可经 `.ai-chat-prompt-input-suggestion` 类覆盖。

### suggestions.ts 纯函数

`parseSuggestion` 与 `filterSuggestions` 独立导出，宿主可脱离浮层单独使用（如自定义渲染）：

```ts
import { parseSuggestion, filterSuggestions } from '@toimc/vue'

interface SuggestionItem {
  key: string
  label: string
  description?: string
  children?: SuggestionItem[] // 二级建议（暂只渲染一级，字段透传保留扩展位）
}

interface SuggestionTrigger {
  char: string // 触发字符，如 '/' 或 '@'
  items: SuggestionItem[]
}

/** 解析光标处激活的触发词与已输入过滤串；未激活返回 null */
function parseSuggestion(
  text: string,
  caret: number,
  triggers: SuggestionTrigger[],
): {
  trigger: SuggestionTrigger
  query: string
  replaceRange: [number, number]
} | null

/** label 前缀 + 包含双策略过滤（大小写不敏感，前缀命中在前） */
function filterSuggestions(
  items: SuggestionItem[],
  query: string,
): SuggestionItem[]
```

`caret` 越界按文本长度收敛，`NaN` 按 0 处理；`triggers` 为空数组恒返回 `null`。
