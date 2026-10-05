# ModelIcon

模型品牌图标：输入模型 id，内部经 `detectModelVendor`（`@toimc/core`）识别厂商，渲染对应品牌的内联 SVG（path 数据取自 [@lobehub/icons](https://github.com/lobehub/lobe-icons) Mono 变体）；识别不出时降级为首字母圆形。适用于模型选择器、会话标题、用量列表等任何需要品牌标识的位置。

## 代码演示

<script setup lang="ts">
import { ModelIcon } from '@toimc/vue'

const models = [
  'gpt-4o',
  'claude-sonnet-4',
  'gemini-2.0-flash',
  'deepseek-chat',
  'qwen-max',
  'glm-4.6',
  'llama-3.1',
  'kimi-k2',
  'unknown-model',
]
</script>

按模型 id 自动识别厂商；未识别的 id 走兜底图标：

<DemoContainer>
  <div style="display: flex; flex-wrap: wrap; gap: 14px; align-items: center">
    <div
      v-for="m in models"
      :key="m"
      style="display: flex; align-items: center; gap: 8px"
    >
      <ModelIcon :model="m" :size="22" />
      <span style="font-size: 12px; font-family: monospace">{{ m }}</span>
    </div>
    <div style="display: flex; align-items: center; gap: 8px">
      <ModelIcon model="gpt-4o" :size="16" />
      <ModelIcon model="gpt-4o" :size="24" />
      <ModelIcon model="gpt-4o" :size="32" />
      <span style="font-size: 12px; color: var(--ai-chat-color-text-muted)"
        >16 / 24 / 32 px</span
      >
    </div>
  </div>
</DemoContainer>

## 基础用法

```vue
<script setup lang="ts">
import { ModelIcon } from '@toimc/vue'
</script>

<template>
  <span class="model-row">
    <ModelIcon model="gpt-4o" />
    <ModelIcon model="claude-sonnet-4" />
    <ModelIcon model="gemini-2.5-pro" />
    <ModelIcon model="deepseek-chat" />
    <ModelIcon model="qwen3-max" />
  </span>
</template>
```

- 带 `/` 前缀的路由型 id（如 `openrouter/anthropic/claude-3.5-sonnet`）自动取末段识别
- 已知厂商输出 `role="img"` + `aria-label`（品牌名，如 `OpenAI`）

## 自定义尺寸

`size` 控制边长（px），默认 18；首字母圆形的字号自动取 `size / 2`：

```vue
<ModelIcon model="glm-4-plus" :size="24" />
<ModelIcon model="unknown-model-x" :size="32" />
```

## 指定厂商

`vendor` 覆盖自动识别（类型为 `ModelVendor`，`@toimc/core` 导出），适用于 id 不含品牌特征但宿主已知厂商的场景：

```vue
<ModelIcon model="my-proxy-model" vendor="zhipu" />
```

## 兜底与自定义图标

- 未知厂商：渲染首字母圆形（主题色背景），`aria-label` 走 i18n `modelIcon.unknown`（中文「未知模型」）
- 默认插槽：自定义图标逃生口，传入后整体覆盖内置 SVG 与首字母兜底，容器保留 `role="img"` + `aria-label`

```vue
<ModelIcon model="internal-llm">
  <img src="/icons/internal.svg" alt="" />
</ModelIcon>
```

## 厂商对照

| vendor | 品牌色 | 命中示例 |
|--------|--------|----------|
| openai | `#000000` | `gpt-4o` / `o3-mini` / `whisper-1` |
| anthropic | `#D97706` | `claude-sonnet-4` |
| google | `#4285F4` | `gemini-2.5-pro` |
| zhipu | `#3859FF` | `glm-4-plus` / `chatglm3` |
| qwen | `#615EFF` | `qwen3-max` |
| deepseek | `#4D6BFE` | `deepseek-chat` / `deepseek-r1` |
| mistral | `#F7D046` | `mistral-large` / `mixtral-8x7b` |
| meta | `#0668E1` | `llama-3.3-70b` |
| cohere | `#39594D` | `command-r-plus` |
| yi | `#003425` | `yi-large` |
| xai | `#000000` | `grok-3` |
| moonshot | `#16191E` | `kimi-k2` / `moonshot-v1` |
| doubao | `#1C64F2` | `doubao-pro-32k` |
| minimax | `#F23F5D` | `minimax-text-01` / `abab6.5s` |
| wenxin | `#167ADF` | `ernie-4.5` / `wenxin` |

品牌色为品牌资产（官方标识固定色，不随明暗主题翻转），豁免主题令牌约束；unknown 兜底圆形走主题令牌。

## API

### Props

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| model | `string` | 必填 | 模型 id，内部调 `detectModelVendor` 识别 |
| vendor | `ModelVendor` | — | 显式指定厂商，覆盖自动识别 |
| size | `number` | `18` | 边长 px |

### Slots

| 插槽名 | 说明 |
|--------|------|
| default | 自定义图标，覆盖内置 SVG 与首字母兜底 |

### 无障碍

- 已知厂商：SVG 带 `role="img"` + `aria-label`（品牌名）
- 未知厂商：首字母圆形带 `role="img"` + `aria-label`（i18n `modelIcon.unknown`）
