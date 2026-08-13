<script setup lang="ts">
import { provide, ref, computed } from 'vue'
import {
  useScrollAnchor,
  type ScrollAnchorContext,
} from '../composables/useScrollAnchor'
import { useThemePreset } from '../composables/useThemePreset'
import type { PresetKey } from '../theme/presets'

const props = withDefaults(
  defineProps<{
    autoScroll?: boolean
    theme?: PresetKey
    customTheme?: Record<string, string>
    darkMode?: boolean | 'auto'
  }>(),
  { autoScroll: true },
)

const rootRef = ref<HTMLElement>()

const anchor = useScrollAnchor()

provide<ScrollAnchorContext>('scrollAnchor', anchor)
provide('autoScroll', props.autoScroll)

// 预设 + 自定义变量 → 根元素 inline style
useThemePreset(
  computed(() => rootRef.value),
  computed(() => props.theme),
  computed(() => props.customTheme),
)

// 容器级暗色（不影响全局 data-theme）
const localTheme = computed(() => {
  if (props.darkMode === undefined) return undefined
  if (props.darkMode === 'auto') return undefined // auto 走全局
  return props.darkMode ? 'dark' : 'light'
})
</script>

<template>
  <div ref="rootRef" class="ai-chat-conversation" :data-theme="localTheme">
    <slot />
  </div>
</template>

<style>
.ai-chat-conversation {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  position: relative;
  background: var(--ai-chat-color-bg-chat);
}
</style>
