# ProviderSettingsDialog

运行时 Provider 设置弹层，让用户在浏览器里把自己的模型服务（API Key + 端点 + 模型名）注册进应用——即 BYOK（Bring Your Own Key）。组件是**纯 UI 表单**：不做任何 fetch、不读写任何存储，`apiKey` 只在 `create` 事件发出的瞬间交给宿主，由宿主提交给自己的后端（密钥应当只存在服务端，见[服务端网关](/guide/server)）。

## 基础用法

`open` 用 `v-model:open` 双向控制；`providers` 传入已注册列表（渲染为弹层底部的「已注册模型」区，可逐项删除）；`create` / `remove` 两个事件由宿主接自己的 API：

<script setup lang="ts">
import { ref } from 'vue'
import { ProviderSettingsDialog } from '@toimc/vue'
import type { ProviderFormPayload, ProviderOption } from '@toimc/vue'

const demoOpen = ref(false)
const demoProviders = ref<ProviderOption[]>([])

function onDemoCreate(payload: ProviderFormPayload) {
  // 演示只写本地状态；真实接线见下方「接宿主 API」
  demoProviders.value = [
    ...demoProviders.value,
    {
      id: `local-${demoProviders.value.length + 1}`,
      name: payload.name,
      provider: payload.provider,
      model: payload.model,
    },
  ]
}

function onDemoRemove(id: string) {
  demoProviders.value = demoProviders.value.filter((p) => p.id !== id)
}
</script>

<DemoContainer>
  <Button size="small" @click="demoOpen = true">打开设置弹层</Button>
  <ProviderSettingsDialog
    v-model:open="demoOpen"
    :providers="demoProviders"
    @create="onDemoCreate"
    @remove="onDemoRemove"
  />
</DemoContainer>

在宿主应用中接后端 API 的最小接线（本仓库 dev-server 的 `/api/providers` 三端点即为这套契约的实现，见[接口文档](/mock-api)）：

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ProviderSettingsDialog } from '@toimc/vue'
import type { ProviderFormPayload, ProviderOption } from '@toimc/vue'

const open = ref(false)
const providers = ref<ProviderOption[]>([])

async function refresh() {
  const res = await fetch('/api/providers')
  providers.value = (await res.json()).providers
}

async function onCreate(payload: ProviderFormPayload) {
  const res = await fetch('/api/providers', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) return // 注册失败：保持弹层打开，由宿主提示
  await refresh()
}

async function onRemove(id: string) {
  await fetch(`/api/providers/${id}`, { method: 'DELETE' })
  await refresh()
}

onMounted(refresh)
</script>

<template>
  <ProviderSettingsDialog
    v-model:open="open"
    :providers="providers"
    @create="onCreate"
    @remove="onRemove"
  />
</template>
```

## 服务类型与端点预设

`openai-compat`（默认）的 Base URL 提供四家快捷预设，点击填入后仍可自由编辑：

| 预设 | baseURL |
|------|---------|
| OpenAI | `https://api.openai.com/v1` |
| DeepSeek | `https://api.deepseek.com/v1` |
| GLM | `https://open.bigmodel.cn/api/paas/v4` |
| Kimi | `https://api.moonshot.cn/v1` |

- `anthropic` 类型不提供预设，Base URL 缺省留空即走 Anthropic 官方端点，也可填自定义端点
- **切换服务类型会清空已填的 baseURL**：两类端点互不通用，避免把 OpenAI 端点带给 Anthropic 协议

## 校验规则

字段失焦（touched）后才显示行内错误文案（走 i18n，`provider.*` 命名空间），未触碰时不显示；任一规则不通过时提交按钮禁用：

| 字段 | 规则 |
|------|------|
| name | trim 后非空 |
| apiKey | trim 后非空（password 型输入框，`autocomplete="new-password"`） |
| model | trim 后非空 |
| baseURL | `openai-compat` 时 trim 后非空；`anthropic` 时可选 |

弹层表单控件基于 [Input](/components/input)、[Radio](/components/radio)、[Button](/components/button) 三个基础件实现（apiKey 即 Input 的 `type="password"` + `autocomplete="new-password"`，失焦 touched 依赖 Input 的 `blur` 透传）。

提交按钮禁用之外，程序化触发的提交（绕过 disabled 的事件派发）也会被组件内二次拦截：先把所有字段标记为 touched，校验不通过直接返回。

## 行为注记

- **弹层经 `<Teleport to="body">` 渲染**，脱离宿主 DOM 层级；组件测试需要 `global: { stubs: { teleport: true } }` 让内容落回 wrapper 子树再断言
- **`anthropic` 留空 baseURL 时，`create` 载荷省略 `baseURL` 键**（不是空字符串）——宿主/服务端无需处理空值归一化
- **「记住此配置」勾选框**（默认勾选）：勾选状态以 `persist: boolean` 随 `create` 载荷上抛。组件自身仍不落任何存储——宿主据此决定是否把表单配置持久化（如存 localStorage，服务重启后重注册恢复）；取消勾选即一次性配置
- 关闭方式有三种：Esc 键、点击遮罩空白处、右上角 ×，均通过 `update:open` 写回 `false`
- 已注册列表每项展示 name / provider / model 与「编辑」「删除」两颗操作按钮：编辑进入表单编辑态（预填除 apiKey 外的字段，提交发 `update(id, payload)`，可取消回到新增模式）；删除发 `remove(id)`（无二次确认弹层，按钮文案即确认语义）；组件不维护列表状态，增删改后由宿主刷新 `providers`
- 密钥安全：组件不持久化任何表单值（不写 storage、不发请求），`persist` 仅是勾选状态的透传；`create` 后表单不清空、弹层不自动关闭，关闭时机由宿主决定

## API

### Props

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| providers | `ProviderOption[]` | — | 已注册列表（必填），渲染弹层底部的已注册模型区 |
| open | `boolean` | `false` | 弹层开关，`v-model:open` 双向绑定 |

### Events

| 事件名 | 参数 | 说明 |
|--------|------|------|
| create | `(payload: ProviderFormPayload)` | 新增模式校验通过后提交表单时触发，`apiKey` 在此刻交宿主 |
| update | `(id: string, payload: ProviderFormPayload)` | 编辑模式提交时触发：预填来自列表项「编辑」（apiKey 不回传须重填），宿主 PUT 原位更新 |
| remove | `(id: string)` | 点击已注册项的删除按钮时触发 |
| update:open | `(value: boolean)` | `v-model:open` 更新事件 |

### 类型

```ts
/** 已注册 provider 的公开视图（id 由服务端生成，绝不含 apiKey） */
interface ProviderOption {
  id: string
  name: string
  provider: string
  model?: string
}

/** ProviderSettingsDialog 表单提交载荷（密钥仅在 emit 瞬间交宿主） */
interface ProviderFormPayload {
  name: string
  provider: 'openai-compat' | 'anthropic'
  /** openai-compat 必填；anthropic 可选（官方端点） */
  baseURL?: string
  apiKey: string
  model: string
  /** 「记住配置」勾选状态：宿主据此决定是否持久化（组件自身不落任何存储） */
  persist?: boolean
}
```

::: tip 端到端示例
浏览器表单 → `POST /api/providers` → 注册为带工具的 Agent 模型 → 模型下拉选择 → 真实模型会话，完整链路见 [Playground](/playground)；服务端两条注册路径（环境变量 vs 运行时 API）的对比见[服务端网关](/guide/server#运行时注册-vs-环境变量注册)。
:::
