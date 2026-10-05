<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { aiChatI18n } from '../locales/index'
import {
  filterSuggestions,
  parseSuggestion,
  type SuggestionItem,
  type SuggestionTrigger,
} from './suggestions'

interface Props {
  /** 输入框完整文本（受控，宿主维护） */
  text: string
  /** 光标位置（宿主监听 textarea selectionchange/keyup 后传入） */
  caret: number
  /** 触发器配置：触发字符 + 候选列表 */
  triggers: SuggestionTrigger[]
  /** 菜单挂载点（须为 position:relative 容器）；缺省直挂 body、固定于视口左下角 */
  anchor?: HTMLElement | null
}

const props = withDefaults(defineProps<Props>(), { anchor: null })

const emit = defineEmits<{
  /** 选中建议项；nextText 为替换触发词后的完整文本，光标复位由宿主处理 */
  select: [item: SuggestionItem, nextText: string]
  close: []
}>()

const { t } = aiChatI18n.global

const parsed = computed(() =>
  parseSuggestion(props.text, props.caret, props.triggers),
)

const filtered = computed(() => {
  const p = parsed.value
  return p ? filterSuggestions(p.trigger.items, p.query) : []
})

/** Esc / 外点关闭后同一触发会话内保持隐藏；会话结束（解析置空）自动复位 */
const dismissed = ref(false)
watch(
  () => parsed.value === null,
  (isNull, wasNull) => {
    if (isNull && !wasNull) dismissed.value = false
  },
)

const open = computed(() => parsed.value !== null && !dismissed.value)

const activeIndex = ref(0)
watch(
  () => [parsed.value?.trigger.char, parsed.value?.query],
  () => {
    activeIndex.value = 0
  },
)

const itemEls = ref<HTMLElement[]>([])
watch(filtered, (list) => {
  if (activeIndex.value >= list.length) activeIndex.value = 0
  itemEls.value.length = list.length
})
watch(activeIndex, (i) => {
  itemEls.value[i]?.scrollIntoView?.({ block: 'nearest' })
})

const teleportTarget = computed(() => props.anchor ?? 'body')

function selectItem(item: SuggestionItem) {
  const p = parsed.value
  if (!p) return
  const [start, end] = p.replaceRange
  const nextText =
    props.text.slice(0, start) + item.label + props.text.slice(end)
  dismissed.value = true
  emit('select', item, nextText)
}

function closeMenu() {
  if (!open.value) return
  dismissed.value = true
  emit('close')
}

/**
 * 键盘接管：document 捕获阶段拦截，stopPropagation 阻断事件下沉到
 * textarea（防其捕获处理），preventDefault 阻止光标移动/换行等默认行为。
 * IME 组合中的按键一律放行（中文拼音候选期不误选）。
 */
function onKeydown(e: KeyboardEvent) {
  if (!open.value) return
  if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    closeMenu()
    return
  }
  if (filtered.value.length === 0 || e.isComposing) return
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    e.stopPropagation()
    activeIndex.value =
      (activeIndex.value - 1 + filtered.value.length) % filtered.value.length
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    e.stopPropagation()
    activeIndex.value = (activeIndex.value + 1) % filtered.value.length
  } else if (e.key === 'Enter' || e.key === 'NumpadEnter') {
    const item = filtered.value[activeIndex.value]
    if (!item) return
    e.preventDefault()
    e.stopPropagation()
    selectItem(item)
  }
}

/** pointerdown 在捕获阶段监听（target 类型按父类 MouseEvent 收窄） */
function onPointerdown(e: MouseEvent) {
  const target = e.target as HTMLElement | null
  if (target && rootEl.value?.contains(target)) return
  closeMenu()
}

const rootEl = ref<HTMLElement | null>(null)

function setItemRef(el: unknown, i: number) {
  if (el instanceof HTMLElement) itemEls.value[i] = el
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown, true)
  document.addEventListener('pointerdown', onPointerdown, true)
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown, true)
  document.removeEventListener('pointerdown', onPointerdown, true)
})
</script>

<template>
  <Teleport :to="teleportTarget">
    <div
      v-if="open"
      ref="rootEl"
      class="ai-chat-prompt-input-suggestion"
      :class="{ 'ai-chat-prompt-input-suggestion--fixed': !anchor }"
      role="listbox"
    >
      <div
        v-for="(item, i) in filtered"
        :key="item.key"
        :ref="(el) => setItemRef(el, i)"
        class="ai-chat-prompt-input-suggestion__item"
        :class="{
          'ai-chat-prompt-input-suggestion__item--active': i === activeIndex,
        }"
        role="option"
        :aria-selected="i === activeIndex"
        @mousedown.prevent="selectItem(item)"
      >
        <span class="ai-chat-prompt-input-suggestion__label">{{
          item.label
        }}</span>
        <span
          v-if="item.description"
          class="ai-chat-prompt-input-suggestion__desc"
        >
          {{ item.description }}
        </span>
      </div>
      <div
        v-if="filtered.length === 0"
        class="ai-chat-prompt-input-suggestion__empty"
      >
        {{ t('suggestion.empty') }}
      </div>
    </div>
  </Teleport>
</template>

<style>
@layer ai-chat-components {
  .ai-chat-prompt-input-suggestion {
    position: absolute;
    /* 悬浮于挂载容器上方（anchor 通常包住 textarea） */
    bottom: calc(100% + 6px);
    left: 0;
    z-index: var(--ai-chat-z-popup, 1000);
    min-width: 220px;
    max-width: 320px;
    max-height: 264px;
    overflow-y: auto;
    padding: 4px;
    background: var(--ai-chat-color-bg-primary);
    border: 1px solid var(--ai-chat-color-border);
    border-radius: var(--ai-chat-radius-md);
    box-shadow: var(--ai-chat-shadow-popup);
    font-family: var(--ai-chat-font-sans);
    font-size: 13px;
    color: var(--ai-chat-color-text-primary);
  }

  /* 缺省直挂 body：无定位参照，固定视口左下角兜底；要贴输入框请传 anchor */
  .ai-chat-prompt-input-suggestion--fixed {
    position: fixed;
    top: auto;
    bottom: 16px;
    left: 16px;
  }

  .ai-chat-prompt-input-suggestion__item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: var(--ai-chat-radius-sm);
    cursor: pointer;
    white-space: nowrap;
  }

  .ai-chat-prompt-input-suggestion__item--active,
  .ai-chat-prompt-input-suggestion__item:hover {
    background: var(--ai-chat-hover-neutral);
  }

  .ai-chat-prompt-input-suggestion__label {
    flex-shrink: 0;
  }

  .ai-chat-prompt-input-suggestion__desc {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--ai-chat-color-text-muted);
    font-size: 12px;
  }

  .ai-chat-prompt-input-suggestion__empty {
    padding: 10px 8px;
    text-align: center;
    color: var(--ai-chat-color-text-muted);
  }
}
</style>
