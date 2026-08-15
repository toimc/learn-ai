# LanguageToggle

语言切换组件，下拉选择当前语言。默认提供「简体中文 / English」两项；非可控模式下选择即切换 `aiChatI18n` 单例的全局语言（含 `<html lang>` 同步与 localStorage 持久化），传 `modelValue` 则转为可控模式，由宿主决定何时调用 `setAiChatLocale`。

## 基础用法

默认中英双语，选择即生效并持久化（key `ai-chat-locale`），刷新后保留：

<script setup lang="ts">
import { ref } from 'vue'
import { LanguageToggle } from '@ai-chat/vue'

const localeLog = ref('尚未切换')

function onLocaleChange(l: string) {
  localeLog.value = `已切换到 ${l}`
}
</script>

<DemoContainer>
  <div style="display: flex; gap: 12px; align-items: center">
    <LanguageToggle @change="onLocaleChange" />
    <span style="font-size: 13px; color: var(--ai-chat-color-text-secondary)">{{ localeLog }}</span>
  </div>
</DemoContainer>

在宿主应用中完整使用：

```vue
<script setup lang="ts">
import { LanguageToggle } from '@ai-chat/vue'
</script>

<template>
  <LanguageToggle />
</template>
```

## 自定义语言列表

`locales` prop 传入 `{ value, label }` 数组即可替换默认选项（第三方语言需先注入字典，见[国际化指南](/guide/i18n#宿主自定义语言-覆盖文案)）：

```vue
<LanguageToggle
  :locales="[
    { value: 'zh-CN', label: '简体中文' },
    { value: 'en-US', label: 'English' },
    { value: 'ja-JP', label: '日本語' },
  ]"
/>
```

## 可控用法

`v-model` 绑定后组件进入可控模式：选择只发出 `update:modelValue` / `change` 事件，**不**直接改全局语言，由宿主自行决定何时调用 `setAiChatLocale`：

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { LanguageToggle, setAiChatLocale } from '@ai-chat/vue'

const locale = ref('zh-CN')

function onChange(l: string) {
  setAiChatLocale(l) // 可控模式下切换时机由宿主掌控
}
</script>

<template>
  <LanguageToggle v-model="locale" @change="onChange" />
</template>
```

## API

### Props

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| locales | `{ value: string; label: string }[]` | `[{ value: 'zh-CN', label: '简体中文' }, { value: 'en-US', label: 'English' }]` | 语言选项列表 |
| modelValue | `string` | — | 可控当前语言。未传时选择即切换全局语言并持久化；传了则只发事件，不直接改全局 |

### Events

| 事件名 | 参数 | 说明 |
|--------|------|------|
| change | `(locale: string)` | 选择语言时触发（与 `update:modelValue` 同时发出） |
| update:modelValue | `(locale: string)` | `v-model` 更新事件；配合 `modelValue` 构成可控模式 |

::: tip 相关 API
全局语言编程式切换（`setAiChatLocale`）、字典组织与宿主自定义语言，见[国际化指南](/guide/i18n)。
:::
