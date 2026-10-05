<script setup lang="ts">
import { computed } from 'vue'
import { aiChatI18n } from '../locales'

const { t } = aiChatI18n.global

interface Props {
  oldValue: unknown
  newValue: unknown
  oldLabel?: string
  newLabel?: string
  /** 只显示有差异的路径，默认 false */
  onlyChanged?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  oldLabel: undefined,
  newLabel: undefined,
  onlyChanged: false,
})

type RowStatus = 'same' | 'removed' | 'added' | 'modified'

interface HighlightParts {
  prefix: string
  midOld: string
  midNew: string
  suffix: string
}

interface DiffRow {
  key: string
  status: RowStatus
  oldStr: string
  newStr: string
  hl: HighlightParts | null
}

// 技术标记而非 UI 文案：与序列化产物（"null"/"[1,2]"）同类，走数据通道不进 i18n 字典
const CIRCULAR_MARK = '[Circular]'
/** 嵌套对象展开深度上限：超出后该路径整行序列化，防极端深结构拖垮渲染 */
const MAX_DEPTH = 32

function serialize(v: unknown): string {
  if (v === undefined) return 'undefined'
  try {
    return JSON.stringify(v) ?? 'null'
  } catch {
    // BigInt 等无法 JSON 序列化的值降级为 String() 表示
    return String(v)
  }
}

// 嵌套对象递归展开为 "a.b.c" 路径；数组/标量整体序列化为单行。
// seen 是当前递归路径上的对象栈（WeakSet）：命中即循环引用，输出标记不再深入；
// 进栈/出栈对称，兄弟节点重复引用同一对象（菱形结构）不误报
function flatten(
  value: unknown,
  prefix: string,
  out: Map<string, string>,
  seen: WeakSet<object>,
  depth: number,
): void {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    if (seen.has(value)) {
      out.set(prefix, CIRCULAR_MARK)
      return
    }
    if (depth >= MAX_DEPTH) {
      out.set(prefix, serialize(value))
      return
    }
    seen.add(value)
    const obj = value as Record<string, unknown>
    const keys = Object.keys(obj)
    if (keys.length === 0) {
      out.set(prefix, '{}')
    } else {
      for (const k of keys) {
        flatten(obj[k], prefix ? `${prefix}.${k}` : k, out, seen, depth + 1)
      }
    }
    seen.delete(value)
    return
  }
  out.set(prefix, serialize(value))
}

// 公共前后缀切分，中间即字符级变化部分（零 v-html，纯分段 span 渲染，无 XSS 面）
function highlight(a: string, b: string): HighlightParts {
  let start = 0
  const minLen = Math.min(a.length, b.length)
  while (start < minLen && a[start] === b[start]) start++
  let endA = a.length
  let endB = b.length
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--
    endB--
  }
  return {
    prefix: a.slice(0, start),
    midOld: a.slice(start, endA),
    midNew: b.slice(start, endB),
    suffix: a.slice(endA),
  }
}

const rows = computed<DiffRow[]>(() => {
  const oldMap = new Map<string, string>()
  const newMap = new Map<string, string>()
  flatten(props.oldValue, '', oldMap, new WeakSet(), 0)
  flatten(props.newValue, '', newMap, new WeakSet(), 0)

  const keys = [...oldMap.keys()]
  for (const k of newMap.keys()) {
    if (!oldMap.has(k)) keys.push(k)
  }

  return keys.map((k) => {
    const inOld = oldMap.has(k)
    const inNew = newMap.has(k)
    const o = oldMap.get(k) ?? ''
    const n = newMap.get(k) ?? ''
    let status: RowStatus
    if (inOld && inNew) status = o === n ? 'same' : 'modified'
    else if (inOld) status = 'removed'
    else status = 'added'
    return {
      key: k,
      status,
      oldStr: inOld ? o : '',
      newStr: inNew ? n : '',
      hl: status === 'modified' ? highlight(o, n) : null,
    }
  })
})

const visibleRows = computed(() =>
  props.onlyChanged
    ? rows.value.filter((r) => r.status !== 'same')
    : rows.value,
)

const oldLabelText = computed(() => props.oldLabel ?? t('jsonDiff.oldLabel'))
const newLabelText = computed(() => props.newLabel ?? t('jsonDiff.newLabel'))

// 行背景：removed 旧侧红、added 新侧绿、modified 左红右绿，对侧斜纹占位
function cellClass(status: RowStatus, side: 'old' | 'new'): string[] {
  if (status === 'same') return []
  if (status === 'removed') return side === 'old' ? ['is-del'] : ['is-void']
  if (status === 'added') return side === 'new' ? ['is-add'] : ['is-void']
  return side === 'old' ? ['is-del'] : ['is-add']
}

function sign(status: RowStatus, side: 'old' | 'new'): string {
  if (status === 'removed') return side === 'old' ? '−' : ''
  if (status === 'added') return side === 'new' ? '+' : ''
  if (status === 'modified') return side === 'old' ? '−' : '+'
  return ''
}
</script>

<template>
  <div class="ai-chat-jsondiff">
    <div class="ai-chat-jsondiff__header">
      <div class="ai-chat-jsondiff__label">{{ oldLabelText }}</div>
      <div class="ai-chat-jsondiff__label">{{ newLabelText }}</div>
    </div>

    <div v-if="visibleRows.length === 0" class="ai-chat-jsondiff__empty">
      {{ t('jsonDiff.identical') }}
    </div>

    <div v-else class="ai-chat-jsondiff__body">
      <template v-for="row in visibleRows" :key="row.key">
        <div
          class="ai-chat-jsondiff__cell"
          :class="cellClass(row.status, 'old')"
        >
          <span
            class="ai-chat-jsondiff__sign"
            :class="{ 'is-del': sign(row.status, 'old') === '−' }"
            >{{ sign(row.status, 'old') }}</span
          >
          <span class="ai-chat-jsondiff__value">
            <span v-if="row.key" class="ai-chat-jsondiff__key"
              >{{ row.key }}:</span
            >
            <template v-if="row.status === 'modified' && row.hl">
              <span>{{ row.hl.prefix }}</span
              ><span class="ai-chat-jsondiff__char--old">{{
                row.hl.midOld
              }}</span
              ><span>{{ row.hl.suffix }}</span>
            </template>
            <span
              v-else
              class="ai-chat-jsondiff__scalar"
              :class="{ 'is-del-text': row.status === 'removed' }"
              >{{ row.oldStr }}</span
            >
          </span>
        </div>
        <div
          class="ai-chat-jsondiff__cell"
          :class="cellClass(row.status, 'new')"
        >
          <span
            class="ai-chat-jsondiff__sign"
            :class="{ 'is-add': sign(row.status, 'new') === '+' }"
            >{{ sign(row.status, 'new') }}</span
          >
          <span class="ai-chat-jsondiff__value">
            <span v-if="row.key" class="ai-chat-jsondiff__key"
              >{{ row.key }}:</span
            >
            <template v-if="row.status === 'modified' && row.hl">
              <span>{{ row.hl.prefix }}</span
              ><span class="ai-chat-jsondiff__char--new">{{
                row.hl.midNew
              }}</span
              ><span>{{ row.hl.suffix }}</span>
            </template>
            <span
              v-else
              class="ai-chat-jsondiff__scalar"
              :class="{ 'is-add-text': row.status === 'added' }"
              >{{ row.newStr }}</span
            >
          </span>
        </div>
      </template>
    </div>
  </div>
</template>

<style>
@layer ai-chat-components {
  /* 组件级语义令牌：红/绿行背景与字符级高亮衍生色，默认值由状态色 color-mix 派生，
     带 fallback 引用（对齐 Button 的 --ai-chat-btn-* 模式与 tokens-meta 反漂移门禁）；
     宿主在任意祖先层级定义同名变量即可覆盖（依任务契约不进全局 tokens.css） */
  .ai-chat-jsondiff {
    overflow: hidden;
    border: 1px solid var(--ai-chat-color-border);
    border-radius: var(--ai-chat-radius-md);
    background: var(--ai-chat-color-bg-primary);
    font-family: var(--ai-chat-font-sans);
  }

  .ai-chat-jsondiff__header {
    display: grid;
    grid-template-columns: 1fr 1fr;
    border-bottom: 1px solid var(--ai-chat-color-border);
    background: var(--ai-chat-color-bg-secondary);
  }

  .ai-chat-jsondiff__label {
    overflow: hidden;
    padding: 6px 10px;
    border-left: 1px solid var(--ai-chat-color-border);
    color: var(--ai-chat-color-text-secondary);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-overflow: ellipsis;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .ai-chat-jsondiff__label:first-child {
    border-left: none;
  }

  .ai-chat-jsondiff__empty {
    padding: 12px;
    color: var(--ai-chat-color-text-secondary);
    font-size: 13px;
    text-align: center;
  }

  .ai-chat-jsondiff__body {
    display: grid;
    grid-template-columns: 1fr 1fr;
    font-family: var(--ai-chat-font-mono);
    font-size: 12px;
    line-height: 20px;
  }

  .ai-chat-jsondiff__cell {
    display: flex;
    align-items: flex-start;
    gap: 4px;
    min-width: 0;
    padding: 1px 8px;
    border-bottom: 1px solid
      color-mix(in srgb, var(--ai-chat-color-border) 50%, transparent);
    border-left: 1px solid
      color-mix(in srgb, var(--ai-chat-color-border) 50%, transparent);
  }

  .ai-chat-jsondiff__cell:nth-child(odd) {
    border-left: none;
  }

  .ai-chat-jsondiff__sign {
    width: 10px;
    flex-shrink: 0;
    color: transparent;
    text-align: center;
    user-select: none;
  }

  .ai-chat-jsondiff__sign.is-del {
    color: var(--ai-chat-color-status-error);
    font-weight: 700;
  }

  .ai-chat-jsondiff__sign.is-add {
    color: var(--ai-chat-color-status-success);
    font-weight: 700;
  }

  .ai-chat-jsondiff__value {
    flex: 1;
    min-width: 0;
    color: var(--ai-chat-color-text-primary);
    word-break: break-all;
  }

  .ai-chat-jsondiff__key {
    color: var(--ai-chat-color-text-secondary);
    margin-right: 2px;
  }

  .ai-chat-jsondiff__scalar.is-del-text {
    color: var(--ai-chat-color-status-error);
  }

  .ai-chat-jsondiff__scalar.is-add-text {
    color: var(--ai-chat-color-status-success);
  }

  .ai-chat-jsondiff__char--old {
    border-radius: 2px;
    background: var(
      --ai-chat-jsondiff-char-del-bg,
      color-mix(in srgb, var(--ai-chat-color-status-error) 45%, transparent)
    );
    color: var(--ai-chat-color-status-error);
    font-weight: 600;
  }

  .ai-chat-jsondiff__char--new {
    border-radius: 2px;
    background: var(
      --ai-chat-jsondiff-char-add-bg,
      color-mix(in srgb, var(--ai-chat-color-status-success) 45%, transparent)
    );
    color: var(--ai-chat-color-status-success);
    font-weight: 600;
  }

  .ai-chat-jsondiff__cell.is-del {
    background: var(
      --ai-chat-jsondiff-del-bg,
      color-mix(in srgb, var(--ai-chat-color-status-error) 12%, transparent)
    );
  }

  .ai-chat-jsondiff__cell.is-add {
    background: var(
      --ai-chat-jsondiff-add-bg,
      color-mix(in srgb, var(--ai-chat-color-status-success) 14%, transparent)
    );
  }

  /* 对侧斜纹占位：中性灰（明暗主题通用） */
  .ai-chat-jsondiff__cell.is-void {
    background: repeating-linear-gradient(
      45deg,
      transparent 0,
      transparent 4px,
      var(--ai-chat-hover-neutral) 4px,
      var(--ai-chat-hover-neutral) 8px
    );
  }
}
</style>
