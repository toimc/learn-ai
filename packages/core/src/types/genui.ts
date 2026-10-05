/**
 * 生成式 UI（GenUI）schema 协议。
 *
 * 工具在 tool_result 上附带 `ui` 字段（渐进增强，老工具无此字段不受影响），
 * 前端经 isUISchema 校验后交组件注册表映射渲染。schema 由工具代码确定性
 * 生成（模型只决策调用与否），但仍按不可信输入对待——渲染前的消毒在
 * `@toimc/vue` 的 sanitizeGenuiProps 完成。
 */
export interface UISchema {
  /** 组件类型标识；只有宿主注册过的 type 才可能被渲染（封闭白名单） */
  type: string
  /** 传给目标组件的 props；值为 unknown，v-bind 前必须消毒 */
  props: Record<string, unknown>
}
