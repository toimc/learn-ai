<script setup lang="ts">
import {
  ref,
  computed,
  watch,
  nextTick,
  reactive,
  onMounted,
  onUnmounted,
} from 'vue'
import {
  tokensMeta,
  presets,
  type TokenMeta,
  type PresetKey,
  Conversation,
  ConversationContent,
  Message,
  MessageContent,
  MessageActions,
  MessageAction,
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
  PromptInputFooter,
} from '@ai-chat/vue'
import {
  buildThemeCss,
  buildOverridesFromCss,
  type Overrides,
} from './theme-css'

const STORAGE_KEY = 'ai-chat-theme-builder'

function load(): Overrides {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Overrides) : {}
  } catch {
    return {}
  }
}

const overrides = ref<Overrides>(load())
const editMode = ref<'light' | 'dark'>('light')
const search = ref('')
const includeAll = ref(false)
const collapsed = ref<Record<string, boolean>>({})
const importVisible = ref(false)
const importText = ref('')
const importError = ref('')
const presetSel = ref('')
const helpVisible = ref(false)
const exportResultVisible = ref(false)
const exportResultCss = ref('')

// 预览区 Markdown 示例：覆盖标题/强调/列表/引用/表格/代码块，便于校验主题变化
const previewMarkdown = [
  '### Markdown 渲染示例',
  '',
  '右侧预览会跟随你左侧的调整实时变化，下面是各类语法的呈现效果。',
  '',
  '支持 **加粗**、*斜体*、`行内代码` 与 [主色链接](#)。',
  '',
  '- 无序列表：原始层 / 语义层 / 组件层',
  '- 切换暗色只翻转语义层',
  '  - 嵌套子项也跟随主题',
  '',
  '1. 调整原始色阶',
  '2. 导出 CSS',
  '3. 接入项目',
  '',
  '> 引用块：用于强调内容，左侧带强调边线。',
  '',
  '| 令牌层 | 作用 | 随暗色翻转 |',
  '| --- | --- | --- |',
  '| 原始 | 色阶原材料 | 否 |',
  '| 语义 | 含义映射 | 是 |',
  '| 组件 | 组件内引用 | 否 |',
  '',
  '```ts',
  '// 代码块：语法高亮随主题切换',
  'export function useTheme() {',
  "  const theme = ref<'light' | 'dark'>('light')",
  '  return { theme }',
  '}',
  '```',
].join('\n')

// ===== 左栏可拖拽调宽 =====
const EDITOR_WIDTH_KEY = 'ai-chat-editor-width'
const editorWidth = ref(
  typeof localStorage === 'undefined'
    ? 440
    : Number(localStorage.getItem(EDITOR_WIDTH_KEY)) || 440,
)
const bodyRef = ref<HTMLElement | null>(null)
const isDesktop = ref(true)
const editorStyle = computed(() =>
  isDesktop.value ? { width: editorWidth.value + 'px' } : {},
)
const dragging = ref(false)
function onSplitterDown(e: MouseEvent): void {
  if (!isDesktop.value || !bodyRef.value) return
  e.preventDefault()
  dragging.value = true
  const left = bodyRef.value.getBoundingClientRect().left
  const onMove = (ev: MouseEvent) => {
    editorWidth.value = Math.min(720, Math.max(300, ev.clientX - left))
  }
  const onUp = () => {
    dragging.value = false
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    if (typeof localStorage !== 'undefined')
      localStorage.setItem(EDITOR_WIDTH_KEY, String(editorWidth.value))
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}
let desktopMq: MediaQueryList | null = null
function onDesktopChange(e: MediaQueryListEvent): void {
  isDesktop.value = e.matches
}
onMounted(() => {
  if (typeof window === 'undefined' || !window.matchMedia) return
  desktopMq = window.matchMedia('(min-width: 960px)')
  isDesktop.value = desktopMq.matches
  desktopMq.addEventListener('change', onDesktopChange)
})
onUnmounted(() => {
  desktopMq?.removeEventListener('change', onDesktopChange)
})

const rootRef = ref<HTMLElement | null>(null)
const resolvedColors = reactive<Record<string, string>>({})

function save(): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides.value))
  } catch {
    /* quota exceeded — ignore */
  }
}

function reset(): void {
  if (!confirm('确定清空所有自定义覆盖?')) return
  overrides.value = {}
  save()
}

function curLight(t: TokenMeta): string {
  return overrides.value[t.key]?.light ?? t.light
}
function curDark(t: TokenMeta): string {
  return overrides.value[t.key]?.dark ?? t.dark ?? t.light
}
function curValue(t: TokenMeta, mode: 'light' | 'dark'): string {
  return mode === 'light' ? curLight(t) : curDark(t)
}

function setLight(t: TokenMeta, v: string): void {
  overrides.value[t.key] = { ...(overrides.value[t.key] ?? {}), light: v }
}
function setDark(t: TokenMeta, v: string): void {
  overrides.value[t.key] = { ...(overrides.value[t.key] ?? {}), dark: v }
}
function setValue(t: TokenMeta, v: string, mode: 'light' | 'dark'): void {
  if (mode === 'light') setLight(t, v)
  else setDark(t, v)
}
function setNum(t: TokenMeta, v: string, mode: 'light' | 'dark'): void {
  const num = parseFloat(v)
  if (Number.isNaN(num)) return
  setValue(t, `${num}${t.unit ?? ''}`, mode)
}

function applyPreset(key: PresetKey): void {
  const p = presets[key]
  if (!p) return
  for (const [k, v] of Object.entries(p.vars)) {
    const meta = tokensMeta.find((m) => m.key === k)
    if (meta) setLight(meta, v)
  }
}
function onPresetChange(e: Event): void {
  const v = (e.target as HTMLSelectElement).value
  if (v) applyPreset(v as PresetKey)
  presetSel.value = ''
}

const layerOrder: Record<string, number> = {
  primitive: 0,
  semantic: 1,
  component: 2,
}
const filteredTokens = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return tokensMeta
  return tokensMeta.filter(
    (t) =>
      t.key.toLowerCase().includes(q) ||
      t.label.toLowerCase().includes(q) ||
      t.group.toLowerCase().includes(q),
  )
})
const groups = computed<[string, TokenMeta[]][]>(() => {
  const map = new Map<string, TokenMeta[]>()
  for (const t of filteredTokens.value) {
    if (!map.has(t.group)) map.set(t.group, [])
    map.get(t.group)!.push(t)
  }
  return Array.from(map.entries()).sort((a, b) => {
    const la = layerOrder[a[1][0].layer] ?? 99
    const lb = layerOrder[b[1][0].layer] ?? 99
    return la - lb
  })
})

// 断点可视化：Bootstrap 式三档矩形（sm/md/lg），数值跟随滑块实时变化
const bpVal = (key: string, fallback: number): number => {
  const m = tokensMeta.find((t) => t.key === key)
  const n = m ? parseFloat(curLight(m)) : NaN
  return Number.isNaN(n) ? fallback : n
}
const breakpointPreview = computed(() => {
  const sm = bpVal('--ai-chat-breakpoint-sm', 480)
  const md = Math.max(bpVal('--ai-chat-breakpoint-md', 640), sm)
  const lg = Math.max(bpVal('--ai-chat-breakpoint-lg', 1024), md)
  const xl = Math.max(bpVal('--ai-chat-breakpoint-xl', 1280), lg)
  return {
    sm,
    md,
    lg,
    xl,
    segSm: Math.max(sm, 1),
    segMd: Math.max(md - sm, 1),
    segLg: Math.max(lg - md, 1),
    segXl: Math.max(xl - lg, 1),
  }
})

function toggleGroup(g: string): void {
  collapsed.value[g] = !(collapsed.value[g] ?? true)
}
function isCollapsed(g: string): boolean {
  // 默认折叠：未显式展开的分组一律视为折叠，首屏只展示分组标题
  return collapsed.value[g] ?? true
}

// 全量变量(当前 editMode)→ inline style 对象,套到根容器吃狗粮 + 解析 derived
function buildInlineVars(mode: 'light' | 'dark'): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const t of tokensMeta) {
    vars[t.key] = mode === 'light' ? curLight(t) : curDark(t)
  }
  return vars
}
const rootStyle = computed(() => buildInlineVars(editMode.value))

async function refreshResolved(): Promise<void> {
  if (typeof window === 'undefined') return
  await nextTick()
  const el = rootRef.value
  if (!el) return
  const cs = getComputedStyle(el)
  for (const t of tokensMeta) {
    if (t.type === 'color') {
      const v = cs.getPropertyValue(t.key).trim()
      if (v) resolvedColors[t.key] = v
    }
  }
}

watch([overrides, editMode], refreshResolved, { deep: true })
onMounted(refreshResolved)

function exportCss(): void {
  const css = buildThemeCss(tokensMeta, overrides.value, {
    includeAll: includeAll.value,
  })
  const blob = new Blob([css], { type: 'text/css' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'ai-chat-theme.css'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  // 导出后展示接入说明，告诉用户如何使用这份 CSS
  exportResultCss.value = css
  exportResultVisible.value = true
}

function copyExport(): void {
  if (typeof navigator === 'undefined' || !navigator.clipboard) return
  navigator.clipboard.writeText(exportResultCss.value).catch(() => {})
}

function openImport(): void {
  importText.value = ''
  importError.value = ''
  importVisible.value = true
}
function doImport(): void {
  if (!importText.value.trim()) {
    importError.value = '请粘贴 CSS 文本'
    return
  }
  try {
    const ov = buildOverridesFromCss(importText.value, tokensMeta)
    if (Object.keys(ov).length === 0) {
      importError.value = '未识别到有效变量定义'
      return
    }
    overrides.value = ov
    save()
    importVisible.value = false
  } catch (e) {
    importError.value = (e as Error).message || '解析失败'
  }
}
function onFileChange(e: Event): void {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    importText.value = String(reader.result || '')
  }
  reader.readAsText(file)
  input.value = ''
}

function toHex(v: string): string {
  const s = v.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    return (
      '#' +
      s
        .slice(1)
        .split('')
        .map((c) => c + c)
        .join('')
    )
  }
  return '#000000'
}
function numOf(v: string): number {
  const n = parseFloat(v)
  return Number.isNaN(n) ? 0 : n
}
// 取色器显示值：合法 hex 直接用；var()/rgba 等非 hex 值改用 getComputedStyle
// 解析后的颜色（resolvedColors 已展开 var() 链），避免 <input type="color">
// 被喂非法值而回退成黑色。文本框仍显示原始值（如 var(...)），可被覆盖。
function colorInputValue(t: TokenMeta, mode: 'light' | 'dark'): string {
  const raw = curValue(t, mode).trim()
  if (/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(raw)) return toHex(raw)
  const resolved = resolvedColors[t.key]
  if (resolved) return toHex(resolved.trim())
  return '#000000'
}
</script>

<template>
  <div
    ref="rootRef"
    class="tb-app ai-chat-scrollbar"
    :style="rootStyle"
    :data-theme="editMode"
  >
    <!-- 顶部工具栏 -->
    <header class="tb-toolbar">
      <div class="tb-toolbar-group">
        <select
          v-model="presetSel"
          class="tb-select"
          title="应用主题预设"
          @change="onPresetChange"
        >
          <option value="">预设…</option>
          <option v-for="(p, k) in presets" :key="k" :value="k">
            {{ p.name }}
          </option>
        </select>
        <div class="tb-mode-switch" role="group" aria-label="编辑模式">
          <button
            class="tb-mode-btn"
            :class="{ active: editMode === 'light' }"
            title="编辑亮色"
            @click="editMode = 'light'"
          >
            ☀ 亮色
          </button>
          <button
            class="tb-mode-btn"
            :class="{ active: editMode === 'dark' }"
            title="编辑暗色"
            @click="editMode = 'dark'"
          >
            🌙 暗色
          </button>
        </div>
      </div>
      <div class="tb-toolbar-group">
        <input
          v-model="search"
          class="tb-search"
          type="search"
          placeholder="搜索令牌…"
        />
      </div>
      <div class="tb-toolbar-group">
        <label class="tb-checkbox" title="导出全部令牌(否则仅导出改动)">
          <input v-model="includeAll" type="checkbox" />
          <span>全量导出</span>
        </label>
        <button class="tb-btn" title="使用说明" @click="helpVisible = true">
          说明
        </button>
        <button class="tb-btn" @click="reset">重置</button>
        <button class="tb-btn" @click="openImport">导入</button>
        <button class="tb-btn tb-btn-primary" @click="save">保存</button>
        <button class="tb-btn tb-btn-primary" @click="exportCss">
          导出 CSS
        </button>
      </div>
    </header>

    <!-- 主体:左编辑 / 右预览 -->
    <div ref="bodyRef" class="tb-body">
      <aside class="tb-editor ai-chat-scrollbar" :style="editorStyle">
        <div v-for="[group, tokens] in groups" :key="group" class="tb-group">
          <button class="tb-group-header" @click="toggleGroup(group)">
            <span class="tb-tw">{{ isCollapsed(group) ? '▶' : '▼' }}</span>
            <span class="tb-group-name">{{ group }}</span>
            <span class="tb-group-count">{{ tokens.length }}</span>
          </button>
          <div v-show="!isCollapsed(group)" class="tb-group-body">
            <!-- 断点组：Bootstrap 式三档矩形可视化，数值跟随下方滑块实时变化 -->
            <div v-if="group === '原始·断点'" class="tb-bp-preview">
              <div class="tb-bp-bar">
                <div
                  class="tb-bp-seg tb-bp-sm"
                  :style="{ flexGrow: breakpointPreview.segSm }"
                >
                  <span class="tb-bp-name">sm 小屏</span>
                  <span class="tb-bp-range"
                    >&lt; {{ breakpointPreview.sm }}</span
                  >
                </div>
                <div
                  class="tb-bp-seg tb-bp-md"
                  :style="{ flexGrow: breakpointPreview.segMd }"
                >
                  <span class="tb-bp-name">md 中屏</span>
                  <span class="tb-bp-range">
                    {{ breakpointPreview.sm }} – {{ breakpointPreview.md }}
                  </span>
                </div>
                <div
                  class="tb-bp-seg tb-bp-lg"
                  :style="{ flexGrow: breakpointPreview.segLg }"
                >
                  <span class="tb-bp-name">lg 大屏</span>
                  <span class="tb-bp-range">
                    {{ breakpointPreview.md }} – {{ breakpointPreview.lg }}
                  </span>
                </div>
                <div
                  class="tb-bp-seg tb-bp-xl"
                  :style="{ flexGrow: breakpointPreview.segXl }"
                >
                  <span class="tb-bp-name">xl 超大屏</span>
                  <span class="tb-bp-range">
                    ≥ {{ breakpointPreview.lg }} · 放宽
                    {{ breakpointPreview.xl }}
                  </span>
                </div>
              </div>
            </div>
            <div v-for="t in tokens" :key="t.key" class="tb-token">
              <div class="tb-token-meta">
                <span class="tb-token-label">{{ t.label }}</span>
                <code class="tb-token-key">{{ t.key }}</code>
              </div>
              <div class="tb-token-control">
                <!-- color 非 derived -->
                <template v-if="t.type === 'color' && !t.derived">
                  <!-- 亮色模式:编辑 light -->
                  <template v-if="editMode === 'light'">
                    <input
                      type="color"
                      class="tb-color"
                      :value="colorInputValue(t, 'light')"
                      @input="
                        setLight(t, ($event.target as HTMLInputElement).value)
                      "
                    />
                    <input
                      type="text"
                      class="tb-hex"
                      :value="curLight(t)"
                      @change="
                        setLight(t, ($event.target as HTMLInputElement).value)
                      "
                    />
                  </template>
                  <!-- 暗色模式:仅对有 dark 默认的 token 出现 dark 控件 -->
                  <template v-else-if="t.dark !== undefined">
                    <input
                      type="color"
                      class="tb-color"
                      :value="colorInputValue(t, 'dark')"
                      @input="
                        setDark(t, ($event.target as HTMLInputElement).value)
                      "
                    />
                    <input
                      type="text"
                      class="tb-hex"
                      :value="curDark(t)"
                      @change="
                        setDark(t, ($event.target as HTMLInputElement).value)
                      "
                    />
                  </template>
                  <span v-else class="tb-readonly">暗色同亮色(只读)</span>
                </template>
                <!-- color derived:只读解析色 + ref -->
                <template v-else-if="t.type === 'color' && t.derived">
                  <span
                    class="tb-swatch"
                    :style="{
                      background:
                        resolvedColors[t.key] || curValue(t, editMode),
                    }"
                  />
                  <span class="tb-readonly">派生自 {{ t.ref }}</span>
                </template>
                <!-- size:数字 + 滑块 -->
                <template v-else-if="t.type === 'size'">
                  <input
                    type="number"
                    class="tb-num"
                    :min="t.min"
                    :max="t.max"
                    :value="numOf(curValue(t, editMode))"
                    @change="
                      setNum(
                        t,
                        ($event.target as HTMLInputElement).value,
                        editMode,
                      )
                    "
                  />
                  <input
                    type="range"
                    class="tb-range"
                    :min="t.min"
                    :max="t.max"
                    :value="numOf(curValue(t, editMode))"
                    @input="
                      setNum(
                        t,
                        ($event.target as HTMLInputElement).value,
                        editMode,
                      )
                    "
                  />
                  <span class="tb-unit">{{ t.unit }}</span>
                </template>
                <!-- duration:数字 -->
                <template v-else-if="t.type === 'duration'">
                  <input
                    type="number"
                    class="tb-num"
                    :min="t.min"
                    :max="t.max"
                    step="0.01"
                    :value="numOf(curValue(t, editMode))"
                    @change="
                      setNum(
                        t,
                        ($event.target as HTMLInputElement).value,
                        editMode,
                      )
                    "
                  />
                  <span class="tb-unit">{{ t.unit }}</span>
                </template>
                <!-- font / text:文本框 -->
                <template v-else>
                  <input
                    type="text"
                    class="tb-text"
                    :value="curValue(t, editMode)"
                    @change="
                      setValue(
                        t,
                        ($event.target as HTMLInputElement).value,
                        editMode,
                      )
                    "
                  />
                </template>
              </div>
            </div>
          </div>
        </div>
        <div v-if="!groups.length" class="tb-empty">未找到匹配的令牌</div>
      </aside>

      <div
        v-show="isDesktop"
        class="tb-splitter"
        :class="{ dragging }"
        title="拖拽调整宽度"
        @mousedown="onSplitterDown"
      ></div>

      <!-- 右侧实时预览 -->
      <section class="tb-preview ai-chat-scrollbar">
        <Conversation class="tb-preview-conv">
          <ConversationContent class="tb-preview-content">
            <Message from="user">
              <MessageContent>
                这是一条用户消息,预览用户气泡背景、圆角与文本颜色。
              </MessageContent>
            </Message>
            <Message from="assistant">
              <MessageContent :content="previewMarkdown" />
              <MessageActions>
                <MessageAction title="复制">复制</MessageAction>
                <MessageAction title="重新生成">重新生成</MessageAction>
              </MessageActions>
            </Message>
          </ConversationContent>
          <div class="tb-preview-input">
            <PromptInput>
              <PromptInputTextarea placeholder="预览输入框…" />
              <PromptInputSubmit />
              <template #footer>
                <PromptInputFooter>
                  <template #hint>
                    <span>Enter 发送,Shift+Enter 换行</span>
                  </template>
                </PromptInputFooter>
              </template>
            </PromptInput>
          </div>
        </Conversation>

        <!-- 令牌样张条 -->
        <div class="tb-swatch-row">
          <span
            class="tb-swatch-chip"
            style="background: var(--ai-chat-color-status-error)"
            >错误</span
          >
          <span
            class="tb-swatch-chip"
            style="background: var(--ai-chat-color-status-warning)"
            >警告</span
          >
          <span
            class="tb-swatch-chip"
            style="background: var(--ai-chat-color-status-success)"
            >成功</span
          >
          <span
            class="tb-swatch-chip"
            style="background: var(--ai-chat-color-accent); color: #fff"
            >主色</span
          >
        </div>
        <div class="tb-radius-row">
          <div
            class="tb-radius-chip"
            style="border-radius: var(--ai-chat-radius-sm)"
          >
            sm
          </div>
          <div
            class="tb-radius-chip"
            style="border-radius: var(--ai-chat-radius-md)"
          >
            md
          </div>
          <div
            class="tb-radius-chip"
            style="border-radius: var(--ai-chat-radius-lg)"
          >
            lg
          </div>
          <div
            class="tb-radius-chip"
            style="border-radius: var(--ai-chat-radius-xl)"
          >
            xl
          </div>
        </div>
      </section>
    </div>

    <!-- 导入弹窗 -->
    <div
      v-if="importVisible"
      class="tb-modal-mask"
      @click.self="importVisible = false"
    >
      <div class="tb-modal">
        <h3 class="tb-modal-title">导入主题 CSS</h3>
        <p class="tb-modal-hint">粘贴此前导出的 CSS,或选择文件上传</p>
        <textarea
          v-model="importText"
          class="tb-modal-textarea ai-chat-scrollbar"
          placeholder=":root { --ai-chat-color-accent-500: #8b5cf6; }"
        />
        <input
          type="file"
          accept=".css,text/css"
          class="tb-modal-file"
          @change="onFileChange"
        />
        <p v-if="importError" class="tb-modal-error">{{ importError }}</p>
        <div class="tb-modal-actions">
          <button class="tb-btn" @click="importVisible = false">取消</button>
          <button class="tb-btn tb-btn-primary" @click="doImport">导入</button>
        </div>
      </div>
    </div>

    <!-- 使用说明弹窗 -->
    <div
      v-if="helpVisible"
      class="tb-modal-mask"
      @click.self="helpVisible = false"
    >
      <div class="tb-modal">
        <h3 class="tb-modal-title">使用说明</h3>
        <p class="tb-modal-hint">
          在左侧按「原始 → 语义 → 组件」三层调整令牌，右侧实时预览。
        </p>
        <ol class="tb-steps">
          <li><b>原始层</b>：改 accent 色阶，全局品牌色自动联动。</li>
          <li><b>语义层</b>：顶部 ☀/🌙 切换，分别编辑亮色与暗色。</li>
          <li>
            <b>预设</b
            >一键换色；<b>保存</b>写入浏览器(localStorage)；<b>导入</b>还原之前导出的
            CSS。
          </li>
        </ol>
        <h4 class="tb-modal-sub">如何使用导出的 CSS</h4>
        <p class="tb-modal-hint">
          把下载的
          <code>ai-chat-theme.css</code>
          放进项目，在应用入口中<b>排在组件库样式之后</b>引入：
        </p>
        <pre class="tb-modal-code">
import '@ai-chat/vue/style.css'
import './ai-chat-theme.css'   // 你的自定义覆盖</pre>
        <p class="tb-modal-hint">
          暗色覆盖写在 <code>[data-theme='dark']</code> 块里；用
          <code>&lt;Conversation dark-mode&gt;</code> 或
          <code>useTheme()</code> 控制 <code>data-theme</code> 即可生效。
        </p>
        <div class="tb-modal-actions">
          <button class="tb-btn tb-btn-primary" @click="helpVisible = false">
            知道了
          </button>
        </div>
      </div>
    </div>

    <!-- 导出结果弹窗 -->
    <div
      v-if="exportResultVisible"
      class="tb-modal-mask"
      @click.self="exportResultVisible = false"
    >
      <div class="tb-modal">
        <h3 class="tb-modal-title">✓ 已导出 ai-chat-theme.css</h3>
        <p class="tb-modal-hint">
          在你的项目入口中，<b>排在组件库样式之后</b>引入它即可覆盖默认主题：
        </p>
        <pre class="tb-modal-code">
import '@ai-chat/vue/style.css'
import './ai-chat-theme.css'   // 你的自定义覆盖</pre>
        <details class="tb-modal-details">
          <summary>查看生成的 CSS</summary>
          <pre class="tb-modal-code tb-modal-code-scroll ai-chat-scrollbar">{{
            exportResultCss
          }}</pre>
        </details>
        <div class="tb-modal-actions">
          <button class="tb-btn" @click="copyExport">复制 CSS</button>
          <button
            class="tb-btn tb-btn-primary"
            @click="exportResultVisible = false"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
.tb-app {
  display: flex;
  flex-direction: column;
  width: 100%;
  flex: 1;
  min-height: 0;
  font-family: var(--ai-chat-font-sans);
  background: var(--ai-chat-color-bg-primary);
  color: var(--ai-chat-color-text-primary);
  position: relative;
}

/* ===== 顶部工具栏 ===== */
.tb-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--ai-chat-color-border);
  background: var(--ai-chat-color-bg-secondary);
  flex-wrap: wrap;
}
.tb-toolbar-group {
  display: flex;
  align-items: center;
  gap: 8px;
}
.tb-toolbar-group:last-child {
  margin-left: auto;
}
.tb-select,
.tb-search {
  height: 32px;
  padding: 0 10px;
  border: 1px solid var(--ai-chat-color-input-border);
  border-radius: var(--ai-chat-radius-sm);
  background: var(--ai-chat-color-input-bg);
  color: var(--ai-chat-color-text-primary);
  font-size: 13px;
  font-family: inherit;
  outline: none;
}
.tb-search {
  width: 180px;
}
.tb-select:focus,
.tb-search:focus {
  border-color: var(--ai-chat-color-input-focus-border);
}
.tb-mode-switch {
  display: inline-flex;
  border: 1px solid var(--ai-chat-color-border);
  border-radius: var(--ai-chat-radius-sm);
  overflow: hidden;
}
.tb-mode-btn {
  height: 32px;
  padding: 0 10px;
  border: none;
  background: transparent;
  color: var(--ai-chat-color-text-secondary);
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
  transition: background var(--ai-chat-duration-fast) var(--ai-chat-easing);
}
.tb-mode-btn:hover {
  background: var(--ai-chat-hover-neutral);
}
.tb-mode-btn.active {
  background: var(--ai-chat-color-accent-dim);
  color: var(--ai-chat-color-accent);
}
.tb-checkbox {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--ai-chat-color-text-secondary);
  cursor: pointer;
  user-select: none;
}
.tb-btn {
  height: 32px;
  padding: 0 12px;
  border: 1px solid var(--ai-chat-color-border);
  border-radius: var(--ai-chat-radius-sm);
  background: transparent;
  color: var(--ai-chat-color-text-primary);
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
  transition: background var(--ai-chat-duration-fast) var(--ai-chat-easing);
}
.tb-btn:hover {
  background: var(--ai-chat-hover-neutral);
}
.tb-btn-primary {
  background: var(--ai-chat-color-accent);
  border-color: var(--ai-chat-color-accent);
  color: #fff;
}
.tb-btn-primary:hover {
  background: var(--ai-chat-color-accent-hover);
}

/* ===== 主体布局 ===== */
.tb-body {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}
.tb-editor {
  width: 440px;
  flex-shrink: 0;
  overflow-y: auto;
  padding: 8px 0;
}
.tb-splitter {
  width: 6px;
  flex-shrink: 0;
  cursor: col-resize;
  background: var(--ai-chat-color-border);
  transition: background var(--ai-chat-duration-fast) var(--ai-chat-easing);
}
.tb-splitter:hover,
.tb-splitter.dragging {
  background: var(--ai-chat-color-accent);
}
.tb-preview {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ===== 令牌分组 ===== */
.tb-group {
  border-bottom: 1px solid var(--ai-chat-color-border);
}
.tb-group:last-child {
  border-bottom: none;
}
.tb-group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 16px;
  border: none;
  background: transparent;
  color: var(--ai-chat-color-text-primary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
}
.tb-group-header:hover {
  background: var(--ai-chat-hover-neutral);
}
.tb-tw {
  font-size: 10px;
  color: var(--ai-chat-color-text-muted);
  width: 12px;
}
.tb-group-name {
  flex: 1;
}
.tb-group-count {
  font-size: 11px;
  font-weight: 400;
  color: var(--ai-chat-color-text-muted);
}
.tb-group-body {
  padding: 0 16px 8px;
}
/* 断点三档矩形可视化（Bootstrap 式 sm/md/lg） */
.tb-bp-preview {
  margin-bottom: 10px;
}

.tb-bp-bar {
  display: flex;
  gap: 4px;
  border-radius: 8px;
  overflow: hidden;
  font-size: 11px;
}

.tb-bp-seg {
  min-width: 0;
  min-height: 48px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  padding: 6px 8px;
  color: #fff;
  overflow: hidden;
  white-space: nowrap;
}

.tb-bp-name {
  font-weight: 600;
}

.tb-bp-range {
  opacity: 0.85;
}

.tb-bp-sm {
  background: var(--ai-chat-color-accent-400);
}

.tb-bp-md {
  background: var(--ai-chat-color-accent-500);
}

.tb-bp-lg {
  background: var(--ai-chat-color-accent-600);
}

.tb-bp-xl {
  background: var(--ai-chat-color-accent-600);
  filter: brightness(0.82);
}

.tb-token {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 0;
  border-top: 1px solid var(--ai-chat-color-border);
}
.tb-token:first-child {
  border-top: none;
}
.tb-token-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1 1 0;
  min-width: 0;
}
.tb-token-label {
  font-size: 13px;
  color: var(--ai-chat-color-text-primary);
}
.tb-token-key {
  font-size: 10.5px;
  color: var(--ai-chat-color-text-muted);
  font-family: var(--ai-chat-font-mono);
  word-break: break-all;
}
.tb-token-control {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
}
.tb-color {
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--ai-chat-color-border);
  border-radius: var(--ai-chat-radius-sm);
  background: none;
  cursor: pointer;
  flex-shrink: 0;
}
.tb-color::-webkit-color-swatch-wrapper {
  padding: 2px;
}
.tb-color::-webkit-color-swatch {
  border: none;
  border-radius: 3px;
}
.tb-hex,
.tb-num,
.tb-text {
  height: 30px;
  padding: 0 8px;
  border: 1px solid var(--ai-chat-color-input-border);
  border-radius: var(--ai-chat-radius-sm);
  background: var(--ai-chat-color-input-bg);
  color: var(--ai-chat-color-text-primary);
  font-size: 12px;
  font-family: var(--ai-chat-font-mono);
  outline: none;
}
.tb-hex:focus,
.tb-num:focus,
.tb-text:focus {
  border-color: var(--ai-chat-color-input-focus-border);
}
/* 字号/色号等简单值：固定宽度，不随面板伸缩 */
.tb-num {
  flex: none;
  width: 78px;
}
.tb-hex {
  flex: none;
  width: 96px;
}
.tb-range {
  flex: 1;
  min-width: 60px;
  accent-color: var(--ai-chat-color-accent);
}
.tb-unit {
  font-size: 11px;
  color: var(--ai-chat-color-text-muted);
  flex-shrink: 0;
}
.tb-text {
  flex: 1 1 auto;
  min-width: 0;
  font-family: var(--ai-chat-font-sans);
}
.tb-swatch {
  display: inline-block;
  width: 32px;
  height: 20px;
  border-radius: 4px;
  border: 1px solid var(--ai-chat-color-border);
  flex-shrink: 0;
}
.tb-readonly {
  font-size: 11px;
  color: var(--ai-chat-color-text-muted);
}
.tb-empty {
  padding: 32px 16px;
  text-align: center;
  color: var(--ai-chat-color-text-muted);
  font-size: 13px;
}

/* ===== 预览区 ===== */
.tb-preview-conv {
  flex: 1;
  min-height: 320px;
  border: 1px solid var(--ai-chat-color-border);
  border-radius: var(--ai-chat-radius-md);
  overflow: hidden;
  background: var(--ai-chat-color-bg-chat);
}
.tb-preview-content {
  flex: 1;
  overflow-y: auto;
}
.tb-preview-input {
  max-width: 100%;
  padding: 0 12px 12px;
}
.tb-swatch-row,
.tb-radius-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.tb-swatch-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 12px;
  border-radius: var(--ai-chat-radius-sm);
  font-size: 12px;
  color: #fff;
}
.tb-radius-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 40px;
  background: var(--ai-chat-color-accent-dim);
  color: var(--ai-chat-color-text-primary);
  font-size: 12px;
  border: 1px solid var(--ai-chat-color-border);
}

/* ===== 导入弹窗 ===== */
.tb-modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
}
.tb-modal {
  width: min(560px, 92vw);
  background: var(--ai-chat-color-bg-primary);
  border: 1px solid var(--ai-chat-color-border);
  border-radius: var(--ai-chat-radius-md);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.tb-modal-title {
  margin: 0;
  font-size: 16px;
  color: var(--ai-chat-color-text-primary);
}
.tb-modal-hint {
  margin: 0;
  font-size: 12px;
  color: var(--ai-chat-color-text-muted);
}
.tb-modal-textarea {
  width: 100%;
  height: 200px;
  padding: 10px;
  border: 1px solid var(--ai-chat-color-input-border);
  border-radius: var(--ai-chat-radius-sm);
  background: var(--ai-chat-color-input-bg);
  color: var(--ai-chat-color-text-primary);
  font-size: 12px;
  font-family: var(--ai-chat-font-mono);
  outline: none;
  resize: vertical;
}
.tb-modal-file {
  font-size: 12px;
  color: var(--ai-chat-color-text-secondary);
}
.tb-modal-error {
  margin: 0;
  font-size: 12px;
  color: var(--ai-chat-color-status-error);
}
.tb-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.tb-steps {
  margin: 0;
  padding-left: 20px;
  font-size: 13px;
  line-height: 1.8;
  color: var(--ai-chat-color-text-secondary);
}
.tb-steps b {
  color: var(--ai-chat-color-text-primary);
}
.tb-modal-sub {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--ai-chat-color-text-primary);
}
.tb-modal-code {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid var(--ai-chat-color-border);
  border-radius: var(--ai-chat-radius-sm);
  background: var(--ai-chat-color-code-bg);
  color: var(--ai-chat-color-text-primary);
  font-size: 12px;
  font-family: var(--ai-chat-font-mono);
  white-space: pre;
  overflow-x: auto;
}
.tb-modal-code-scroll {
  max-height: 200px;
  overflow-y: auto;
}
.tb-modal-details summary {
  cursor: pointer;
  font-size: 12px;
  color: var(--ai-chat-color-text-secondary);
}
.tb-modal-details[open] summary {
  margin-bottom: 8px;
}
.tb-modal code {
  font-family: var(--ai-chat-font-mono);
  font-size: 12px;
  background: var(--ai-chat-color-code-inline-bg);
  padding: 1px 4px;
  border-radius: 3px;
}

/* ===== 响应式:窄屏堆叠 ===== */
@media (max-width: 960px) {
  .tb-body {
    flex-direction: column;
  }
  .tb-editor {
    width: 100%;
    max-height: 50vh;
    border-right: none;
    border-bottom: 1px solid var(--ai-chat-color-border);
  }
  .tb-preview {
    min-height: 400px;
  }
  .tb-toolbar-group:last-child {
    margin-left: 0;
  }
}
</style>
