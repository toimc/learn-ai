<script setup lang="ts">
import { computed } from 'vue'
import { isUISchema } from '@toimc/core'
import { resolveGenuiComponent } from './registry'
import { sanitizeGenuiProps } from './sanitize'
import { aiChatI18n } from '../locales'

const { t } = aiChatI18n.global

const props = defineProps<{
  /** 待渲染的 schema（通常取自 message.toolCalls[i].result.ui）；非法值走 fallback */
  schema: unknown
}>()

const parsed = computed(() => (isUISchema(props.schema) ? props.schema : null))
const component = computed(() =>
  parsed.value ? resolveGenuiComponent(parsed.value.type) : undefined,
)
// 安全红线：props 进 v-bind 前必须消毒（函数丢弃 / URL 白名单 / 纯数字字符串收窄）。
// GenUI 组件的自定义事件（如 adopt）经 attrs fallthrough 透传，不受消毒影响。
const safeProps = computed(() =>
  parsed.value ? sanitizeGenuiProps(parsed.value.props) : {},
)
</script>

<template>
  <component :is="component" v-if="component" v-bind="safeProps" />
  <slot v-else name="fallback">
    <div class="ai-chat-genui-fallback" role="note">
      {{
        parsed
          ? t('genui.unsupportedType', { type: parsed.type })
          : t('genui.invalidSchema')
      }}
    </div>
  </slot>
</template>

<style>
@layer ai-chat-components {
  /* 默认降级提示：宿主通常用 #fallback 换成 ToolCall 系列面板 */
  .ai-chat-genui-fallback {
    padding: 8px 12px;
    border-radius: var(--ai-chat-radius-md);
    background: var(--ai-chat-color-bg-secondary);
    color: var(--ai-chat-color-text-muted);
    font-size: 13px;
    max-width: 100%;
  }
}
</style>
