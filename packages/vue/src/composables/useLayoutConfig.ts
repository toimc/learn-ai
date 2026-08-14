import { computed, toValue, type ComputedRef, type MaybeRefOrGetter } from 'vue'
import type { MessageLayout, MessageAlign } from './layout-types'

export interface LayoutConfig {
  contentMaxWidth?: number
  contentMaxWidthWide?: number
  messageMaxWidth?: number
  inputMaxHeight?: number
  inputMaxHeightMobile?: number
  mobileBreakpoint?: number
  layout?: MessageLayout
  messageAlign?: MessageAlign
}

export interface LayoutConfigResult {
  /** 尺寸类配置 → CSS 变量字典，喂给 Conversation.customTheme */
  vars: ComputedRef<Record<string, string>>
  /** 结构类配置，透传给 Conversation.layout / messageAlign */
  layoutProps: ComputedRef<{
    layout?: MessageLayout
    messageAlign?: MessageAlign
  }>
  /** 当前生效配置 */
  state: ComputedRef<LayoutConfig>
}

const SIZE_KEYS: Array<[keyof LayoutConfig, string]> = [
  ['contentMaxWidth', '--ai-chat-content-max-width'],
  ['contentMaxWidthWide', '--ai-chat-content-max-width-wide'],
  ['messageMaxWidth', '--ai-chat-message-max-width'],
  ['inputMaxHeight', '--ai-chat-input-max-height'],
  ['inputMaxHeightMobile', '--ai-chat-input-max-height-mobile'],
  ['mobileBreakpoint', '--ai-chat-mobile-breakpoint'],
]

/**
 * 结构化布局配置 → CSS 变量字典 + layoutProps。
 * hook 本身不写 DOM：vars 由宿主传入 Conversation.customTheme，
 * 经 useThemePreset 单点写入容器（全组件唯一 inline-style 写入点）。
 */
export function useLayoutConfig(
  config: MaybeRefOrGetter<LayoutConfig>,
): LayoutConfigResult {
  const state = computed<LayoutConfig>(() => toValue(config))

  const vars = computed<Record<string, string>>(() => {
    const cfg = state.value
    const out: Record<string, string> = {}
    for (const [field, varName] of SIZE_KEYS) {
      const v = cfg[field]
      if (typeof v === 'number') out[varName] = `${v}px`
    }
    return out
  })

  const layoutProps = computed(() => ({
    layout: state.value.layout,
    messageAlign: state.value.messageAlign,
  }))

  return { vars, layoutProps, state }
}
