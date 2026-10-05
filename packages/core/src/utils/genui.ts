import type { UISchema } from '../types/genui'

/**
 * 校验未知值是否为合法 UISchema。
 *
 * 边界收紧点（相对笔记示例）：数组不算合法载体——`typeof [] === 'object'`
 * 会让 `props: []`、schema 本身为数组时漏过校验，这里用 Array.isArray 显式排除。
 */
export function isUISchema(value: unknown): value is UISchema {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  const { type, props } = value as Record<string, unknown>
  return (
    typeof type === 'string' &&
    type.length > 0 &&
    typeof props === 'object' &&
    props !== null &&
    !Array.isArray(props)
  )
}
