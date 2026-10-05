import { isSafeHttpUrl } from '../citation/url'

/** 消毒后的 GenUI prop 值域：递归的 JSON 安全形态 */
export type GenuiPropValue =
  | string
  | number
  | boolean
  | null
  | GenuiPropValue[]
  | { [key: string]: GenuiPropValue }

/** 协议形态（scheme:...）；命中即进入 URL 白名单判定 */
const URL_LIKE_RE = /^[a-z][a-z0-9+.-]*:/i
/** 纯数字字符串（收窄为 number 的唯一形态） */
const NUMERIC_STRING_RE = /^-?\d+(\.\d+)?$/
/** blob: 预览地址（isSafeHttpUrl 只覆盖 http(s)，这里按 GenUI 红线补充放行） */
const BLOB_PROTOCOL_RE = /^blob:/i

type SanitizeResult = { ok: true; value: GenuiPropValue } | { ok: false }

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

function sanitizeValue(value: unknown): SanitizeResult {
  // 函数/符号/未定义：不可序列化的注入面，直接丢弃
  if (
    typeof value === 'function' ||
    typeof value === 'symbol' ||
    value === undefined
  ) {
    return { ok: false }
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? { ok: true, value } : { ok: false }
  }
  if (typeof value === 'boolean' || value === null) {
    return { ok: true, value }
  }
  if (typeof value === 'string') {
    // URL 形态字符串只放行 http(s) 与 blob:（javascript:/data:/vbscript: 等一律丢弃）
    if (URL_LIKE_RE.test(value)) {
      return isSafeHttpUrl(value) || BLOB_PROTOCOL_RE.test(value)
        ? { ok: true, value }
        : { ok: false }
    }
    // 纯数字字符串收窄为 number（工具侧数值经 JSON 往返可能以字符串到达）
    if (NUMERIC_STRING_RE.test(value)) {
      return { ok: true, value: Number(value) }
    }
    return { ok: true, value }
  }
  if (Array.isArray(value)) {
    const items: GenuiPropValue[] = []
    for (const item of value) {
      const result = sanitizeValue(item)
      if (result.ok) items.push(result.value)
    }
    return { ok: true, value: items }
  }
  if (isPlainObject(value)) {
    return { ok: true, value: sanitizeGenuiProps(value) }
  }
  // Date/Map/Set/RegExp 等非 plain object：消毒域外，丢弃
  return { ok: false }
}

/**
 * GenUI props 消毒（纯函数，不修改入参）。
 *
 * 规则（逐值递归）：
 * - function / symbol / undefined / 非 finite number（NaN、±Infinity）→ 丢弃该键
 * - boolean / null → 原样保留
 * - URL 形态字符串（`scheme:...`）→ 仅放行 http(s) 与 blob:，其余协议（javascript: 等）丢弃
 * - 纯数字字符串（`-?\d+(\.\d+)?`）→ Number() 收窄为 number
 * - 数组 → 逐元素消毒，被丢弃的元素剔除；plain object → 逐键消毒
 * - Date/Map/Set 等非 plain object → 丢弃
 *
 * 注：URL 白名单不含 `data:image`（附件校验允许），GenUI 渲染面更窄，从严。
 */
export function sanitizeGenuiProps(
  props: Record<string, unknown>,
): Record<string, GenuiPropValue> {
  const result: Record<string, GenuiPropValue> = {}
  for (const key of Object.keys(props)) {
    const sanitized = sanitizeValue(props[key])
    if (sanitized.ok) result[key] = sanitized.value
  }
  return result
}
