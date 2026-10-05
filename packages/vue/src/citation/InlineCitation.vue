<script setup lang="ts">
import { computed, ref } from 'vue'
import type { MessageSource } from '@toimc/core'
import { aiChatI18n } from '../locales'
import { isSafeHttpUrl } from './url'

interface Props {
  /** 显示编号，从 1 起 */
  index: number
  /** 该角标关联的来源；多来源时卡片内轮播 */
  sources: MessageSource[]
  /** 悬浮卡宽度 px，默认 300 */
  cardWidth?: number
}

const props = withDefaults(defineProps<Props>(), { cardWidth: 300 })

const emit = defineEmits<{
  select: [source: MessageSource]
}>()

const { t } = aiChatI18n.global

const rootEl = ref<HTMLElement | null>(null)
const open = ref(false)
const current = ref(0)

const total = computed(() => props.sources.length)
const source = computed(() => props.sources[current.value])
const safeUrl = computed(() => {
  const url = source.value?.url
  return url !== undefined && isSafeHttpUrl(url) ? url : undefined
})

function show() {
  if (total.value > 0) open.value = true
}

function hide() {
  open.value = false
  current.value = 0
}

/** 鼠标离开且焦点不在组件内才收起：键盘用户聚焦卡片时不能被鼠标事件误关 */
function onMouseLeave() {
  if (!rootEl.value?.contains(document.activeElement)) hide()
}

/** 焦点移出整个组件（含悬浮卡）才收起：focusout 派发时 activeElement 已指向新焦点，
 * trigger → 轮播按钮的内部转移不会误关 */
function onFocusOut() {
  if (!rootEl.value?.contains(document.activeElement)) hide()
}

function prev() {
  if (total.value > 0)
    current.value = (current.value - 1 + total.value) % total.value
}

function next() {
  if (total.value > 0) current.value = (current.value + 1) % total.value
}

function onSelect() {
  if (source.value !== undefined) emit('select', source.value)
}
</script>

<template>
  <span
    ref="rootEl"
    class="ai-chat-inline-citation"
    @mouseenter="show"
    @mouseleave="onMouseLeave"
    @focusin="show"
    @focusout="onFocusOut"
    @keydown.esc.prevent="hide"
  >
    <button
      type="button"
      class="ai-chat-inline-citation__trigger"
      :aria-label="t('citation.source')"
    >
      {{ index }}
    </button>

    <span
      v-if="open && source"
      class="ai-chat-inline-citation__card"
      :style="{ width: `${cardWidth}px` }"
    >
      <span v-if="total > 1" class="ai-chat-inline-citation__nav">
        <button
          type="button"
          class="ai-chat-inline-citation__nav-btn ai-chat-inline-citation__nav-prev"
          :aria-label="t('citation.prevSource')"
          @click="prev"
        >
          ‹
        </button>
        <span class="ai-chat-inline-citation__count"
          >{{ current + 1 }}/{{ total }}</span
        >
        <button
          type="button"
          class="ai-chat-inline-citation__nav-btn ai-chat-inline-citation__nav-next"
          :aria-label="t('citation.nextSource')"
          @click="next"
        >
          ›
        </button>
      </span>

      <a
        v-if="safeUrl"
        class="ai-chat-inline-citation__title"
        :href="safeUrl"
        target="_blank"
        rel="noopener noreferrer"
        @click="onSelect"
      >
        {{ source.title ?? source.id }}
      </a>
      <button
        v-else
        type="button"
        class="ai-chat-inline-citation__title"
        @click="onSelect"
      >
        {{ source.title ?? source.id }}
      </button>

      <span v-if="source.snippet" class="ai-chat-inline-citation__snippet">
        {{ source.snippet }}
      </span>

      <a
        v-if="safeUrl"
        class="ai-chat-inline-citation__link"
        :href="safeUrl"
        target="_blank"
        rel="noopener noreferrer"
        :aria-label="t('citation.openLink')"
      >
        {{ t('citation.viewSource') }}
      </a>
    </span>
  </span>
</template>

<style>
@layer ai-chat-components {
  .ai-chat-inline-citation {
    position: relative;
    display: inline-block;
  }

  .ai-chat-inline-citation__trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    padding: 0;
    border: none;
    border-radius: 9999px;
    font-size: 11px;
    line-height: 1;
    vertical-align: super;
    cursor: pointer;
    background: var(--ai-chat-color-accent-dim);
    color: var(--ai-chat-color-accent);
    transition: background var(--ai-chat-duration-fast) var(--ai-chat-easing);
  }

  .ai-chat-inline-citation__trigger:hover {
    background: var(--ai-chat-color-accent);
    color: var(--ai-chat-color-text-on-accent);
  }

  .ai-chat-inline-citation__trigger:focus-visible,
  .ai-chat-inline-citation__nav-btn:focus-visible,
  .ai-chat-inline-citation__title:focus-visible {
    outline: 2px solid var(--ai-chat-color-accent);
    outline-offset: 1px;
  }

  .ai-chat-inline-citation__card {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    z-index: var(--ai-chat-z-popup);
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px 12px;
    border: 1px solid var(--ai-chat-color-border);
    border-radius: var(--ai-chat-radius-lg);
    background: var(--ai-chat-color-bg-primary);
    box-shadow: var(--ai-chat-shadow-popup);
    font-size: 13px;
    text-align: left;
  }

  .ai-chat-inline-citation__nav {
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--ai-chat-color-text-muted);
    font-size: 12px;
  }

  .ai-chat-inline-citation__nav-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    padding: 0;
    border: none;
    border-radius: var(--ai-chat-radius-sm);
    background: transparent;
    color: var(--ai-chat-color-text-secondary);
    font-size: 14px;
    line-height: 1;
    cursor: pointer;
  }

  .ai-chat-inline-citation__nav-btn:hover {
    background: var(--ai-chat-color-bg-secondary);
    color: var(--ai-chat-color-accent);
  }

  .ai-chat-inline-citation__count {
    min-width: 28px;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }

  .ai-chat-inline-citation__title {
    display: block;
    padding: 0;
    border: none;
    background: none;
    color: var(--ai-chat-color-text-primary);
    font-size: 13px;
    font-weight: 600;
    line-height: 1.4;
    text-align: left;
    cursor: pointer;
    overflow-wrap: anywhere;
  }

  a.ai-chat-inline-citation__title {
    text-decoration: none;
  }

  a.ai-chat-inline-citation__title:hover {
    color: var(--ai-chat-color-accent);
  }

  .ai-chat-inline-citation__snippet {
    display: block;
    border-left: 2px solid var(--ai-chat-color-border);
    padding-left: 8px;
    color: var(--ai-chat-color-text-secondary);
    font-size: 12px;
    font-style: italic;
    line-height: 1.6;
  }

  .ai-chat-inline-citation__link {
    color: var(--ai-chat-color-accent);
    font-size: 12px;
    text-decoration: none;
  }

  .ai-chat-inline-citation__link:hover {
    text-decoration: underline;
  }
}
</style>
