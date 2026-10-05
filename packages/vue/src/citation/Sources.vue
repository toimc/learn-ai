<script setup lang="ts">
import { computed, ref } from 'vue'
import type { MessageSource } from '@toimc/core'
import { aiChatI18n } from '../locales'
import { isSafeHttpUrl } from './url'

interface Props {
  sources: MessageSource[]
  /** 分组标题，默认 i18n citation.sources（含计数） */
  title?: string
  /** 横排徽标模式（Popover 展示详情）；默认 false = 折叠列表 */
  inline?: boolean
  /** inline 模式最多直接显示数，超出折叠进 Popover，默认 3 */
  maxInline?: number
  /** 初始展开态（非 inline 模式），默认 false 折叠 */
  defaultOpen?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: undefined,
  inline: false,
  maxInline: 3,
  defaultOpen: false,
})

const emit = defineEmits<{
  select: [source: MessageSource, index: number]
}>()

const { t } = aiChatI18n.global

const open = ref(props.defaultOpen)
const popoverOpen = ref(false)

const resolvedTitle = computed(
  () => props.title ?? t('citation.sources', { count: props.sources.length }),
)

const inlineCount = computed(() =>
  Math.min(props.maxInline, props.sources.length),
)
const inlineItems = computed(() => props.sources.slice(0, inlineCount.value))
const overflowItems = computed(() =>
  props.sources
    .slice(inlineCount.value)
    .map((source, offset) => ({ source, index: inlineCount.value + offset })),
)

function safeUrl(source: MessageSource): string | undefined {
  return source.url !== undefined && isSafeHttpUrl(source.url)
    ? source.url
    : undefined
}

function onSelect(source: MessageSource, index: number) {
  emit('select', source, index)
}
</script>

<template>
  <div class="ai-chat-sources" :class="{ 'ai-chat-sources--inline': inline }">
    <template v-if="inline">
      <span v-if="title !== undefined" class="ai-chat-sources__inline-title">
        {{ title }}
      </span>
      <button
        v-for="(source, index) in inlineItems"
        :key="source.id"
        type="button"
        class="ai-chat-sources__badge ai-chat-sources__badge--seq"
        @click="onSelect(source, index)"
      >
        {{ index + 1 }}
      </button>
      <span v-if="overflowItems.length > 0" class="ai-chat-sources__overflow">
        <button
          type="button"
          class="ai-chat-sources__badge ai-chat-sources__badge--more"
          :aria-expanded="popoverOpen"
          @click="popoverOpen = !popoverOpen"
        >
          +{{ overflowItems.length }}
        </button>
        <span v-if="popoverOpen" class="ai-chat-sources__popover">
          <template v-for="item in overflowItems" :key="item.source.id">
            <a
              v-if="safeUrl(item.source)"
              class="ai-chat-sources__popover-item"
              :href="safeUrl(item.source)"
              target="_blank"
              rel="noopener noreferrer"
              @click="onSelect(item.source, item.index)"
            >
              {{ item.source.title ?? item.source.url }}
            </a>
            <button
              v-else
              type="button"
              class="ai-chat-sources__popover-item"
              @click="onSelect(item.source, item.index)"
            >
              {{ item.source.title ?? item.source.id }}
            </button>
          </template>
        </span>
      </span>
    </template>

    <template v-else>
      <button
        type="button"
        class="ai-chat-sources__header"
        :aria-expanded="open"
        @click="open = !open"
      >
        <span class="ai-chat-sources__arrow">▶</span>
        <span class="ai-chat-sources__title">{{ resolvedTitle }}</span>
      </button>
      <ul v-if="open" class="ai-chat-sources__list">
        <li
          v-for="(source, index) in sources"
          :key="source.id"
          class="ai-chat-sources__item"
        >
          <slot name="source" :source="source" :index="index">
            <a
              v-if="safeUrl(source)"
              class="ai-chat-sources__link"
              :href="safeUrl(source)"
              target="_blank"
              rel="noopener noreferrer"
              @click="onSelect(source, index)"
            >
              <span class="ai-chat-sources__link-index">{{ index + 1 }}</span>
              <span class="ai-chat-sources__link-title">
                {{ source.title ?? source.url }}
              </span>
            </a>
            <button
              v-else
              type="button"
              class="ai-chat-sources__doc"
              @click="onSelect(source, index)"
            >
              <span class="ai-chat-sources__doc-index">{{ index + 1 }}</span>
              <span class="ai-chat-sources__doc-body">
                <span class="ai-chat-sources__doc-title">
                  {{ source.title ?? source.id }}
                </span>
                <span
                  v-if="source.snippet"
                  class="ai-chat-sources__doc-snippet"
                >
                  {{ source.snippet }}
                </span>
              </span>
            </button>
          </slot>
        </li>
      </ul>
    </template>
  </div>
</template>

<style>
@layer ai-chat-components {
  .ai-chat-sources {
    font-size: 13px;
    color: var(--ai-chat-color-text-primary);
  }

  .ai-chat-sources__header {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 2px 0;
    border: none;
    background: none;
    color: var(--ai-chat-color-text-secondary);
    font-size: 13px;
    cursor: pointer;
    user-select: none;
  }

  .ai-chat-sources__header:hover {
    color: var(--ai-chat-color-accent);
  }

  .ai-chat-sources__header:focus-visible,
  .ai-chat-sources__badge:focus-visible,
  .ai-chat-sources__doc:focus-visible,
  .ai-chat-sources__popover-item:focus-visible {
    outline: 2px solid var(--ai-chat-color-accent);
    outline-offset: 1px;
  }

  .ai-chat-sources__arrow {
    font-size: 10px;
    transition: transform var(--ai-chat-duration-fast) var(--ai-chat-easing);
  }

  .ai-chat-sources__header[aria-expanded='true'] .ai-chat-sources__arrow {
    transform: rotate(90deg);
  }

  .ai-chat-sources__title {
    font-weight: 500;
  }

  .ai-chat-sources__list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 8px 0 0;
    padding: 0;
    list-style: none;
  }

  .ai-chat-sources__link,
  .ai-chat-sources__doc {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    width: 100%;
    padding: 8px 10px;
    border: 1px solid var(--ai-chat-color-border);
    border-radius: var(--ai-chat-radius-md);
    background: var(--ai-chat-color-bg-secondary);
    color: var(--ai-chat-color-text-primary);
    font-size: 13px;
    line-height: 1.5;
    text-align: left;
    cursor: pointer;
    text-decoration: none;
    transition: border-color var(--ai-chat-duration-fast) var(--ai-chat-easing);
  }

  .ai-chat-sources__link:hover,
  .ai-chat-sources__doc:hover {
    border-color: var(--ai-chat-color-accent);
  }

  .ai-chat-sources__link-index,
  .ai-chat-sources__doc-index {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 18px;
    height: 18px;
    border-radius: 9999px;
    background: var(--ai-chat-color-accent-dim);
    color: var(--ai-chat-color-accent);
    font-size: 11px;
    font-weight: 500;
    line-height: 1;
  }

  .ai-chat-sources__link-title {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .ai-chat-sources__doc {
    flex-direction: row;
  }

  .ai-chat-sources__doc-body {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .ai-chat-sources__doc-title {
    font-weight: 500;
    overflow-wrap: anywhere;
  }

  .ai-chat-sources__doc-snippet {
    color: var(--ai-chat-color-text-muted);
    font-size: 12px;
    overflow-wrap: anywhere;
  }

  .ai-chat-sources--inline {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
  }

  .ai-chat-sources__inline-title {
    color: var(--ai-chat-color-text-secondary);
    font-size: 12px;
    margin-right: 4px;
  }

  .ai-chat-sources__badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 4px;
    border: none;
    border-radius: 9999px;
    background: var(--ai-chat-color-accent-dim);
    color: var(--ai-chat-color-accent);
    font-size: 11px;
    font-weight: 500;
    line-height: 1;
    cursor: pointer;
    transition: background var(--ai-chat-duration-fast) var(--ai-chat-easing);
  }

  .ai-chat-sources__badge:hover {
    background: var(--ai-chat-color-accent);
    color: var(--ai-chat-color-text-on-accent);
  }

  .ai-chat-sources__overflow {
    position: relative;
    display: inline-flex;
  }

  .ai-chat-sources__popover {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    z-index: var(--ai-chat-z-popup);
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 200px;
    max-width: 320px;
    padding: 6px;
    border: 1px solid var(--ai-chat-color-border);
    border-radius: var(--ai-chat-radius-md);
    background: var(--ai-chat-color-bg-primary);
    box-shadow: var(--ai-chat-shadow-popup);
  }

  .ai-chat-sources__popover-item {
    display: block;
    padding: 4px 8px;
    border: none;
    border-radius: var(--ai-chat-radius-sm);
    background: none;
    color: var(--ai-chat-color-text-primary);
    font-size: 12px;
    line-height: 1.4;
    text-align: left;
    cursor: pointer;
    text-decoration: none;
    overflow-wrap: anywhere;
  }

  .ai-chat-sources__popover-item:hover {
    background: var(--ai-chat-color-bg-secondary);
    color: var(--ai-chat-color-accent);
  }
}
</style>
