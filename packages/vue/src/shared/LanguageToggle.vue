<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { aiChatI18n, setAiChatLocale, type LocaleOption } from '../locales'

const props = withDefaults(
  defineProps<{
    /** 语言选项，默认中/英 */
    locales?: LocaleOption[]
    /** 可控当前语言；未传时直接驱动库内 i18n 实例 */
    modelValue?: string
  }>(),
  {
    locales: () => [
      { value: 'zh-CN', label: '简体中文' },
      { value: 'en-US', label: 'English' },
    ],
    modelValue: undefined,
  },
)

const emit = defineEmits<{
  'update:modelValue': [locale: string]
  change: [locale: string]
}>()

const open = ref(false)
const triggerRef = ref<HTMLElement | null>(null)
const popupRef = ref<HTMLElement | null>(null)
const popupStyle = ref<Record<string, string>>({})

const current = computed(
  () => props.modelValue ?? aiChatI18n.global.locale.value,
)
const currentLabel = computed(
  () =>
    props.locales.find((l) => l.value === current.value)?.label ??
    current.value,
)

function updatePosition() {
  const el = triggerRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const estimatedHeight = 8 + props.locales.length * 34
  const openUp =
    rect.bottom + estimatedHeight > window.innerHeight &&
    rect.top > estimatedHeight
  popupStyle.value = {
    top: `${openUp ? rect.top - estimatedHeight - 6 : rect.bottom + 6}px`,
    left: `${rect.left}px`,
  }
}

function toggle() {
  if (open.value) {
    open.value = false
  } else {
    updatePosition()
    open.value = true
  }
}

function select(locale: string) {
  if (locale !== current.value) {
    // 可控模式只 emit（宿主自己决定何时 setAiChatLocale）；
    // 非可控模式直接驱动库内实例（含持久化 + html lang 同步）
    if (props.modelValue === undefined) setAiChatLocale(locale)
    emit('update:modelValue', locale)
    emit('change', locale)
  }
  open.value = false
}

function onDocClick(e: MouseEvent) {
  if (!open.value) return
  const target = e.target as HTMLElement | null
  if (triggerRef.value?.contains(target) || popupRef.value?.contains(target))
    return
  open.value = false
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') open.value = false
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="ai-chat-lang-toggle">
    <button
      ref="triggerRef"
      type="button"
      class="ai-chat-lang-toggle__trigger"
      :aria-expanded="open"
      aria-haspopup="listbox"
      @click="toggle"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path
          d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
        />
      </svg>
      <span class="ai-chat-lang-toggle__label">{{ currentLabel }}</span>
      <svg
        class="ai-chat-lang-toggle__caret"
        :class="{ 'is-open': open }"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
    <Teleport to="body">
      <ul
        v-if="open"
        ref="popupRef"
        class="ai-chat-lang-toggle__menu"
        role="listbox"
        :style="popupStyle"
      >
        <li
          v-for="l in locales"
          :key="l.value"
          role="option"
          class="ai-chat-lang-toggle__option"
          :class="{ 'is-selected': l.value === current }"
          :aria-selected="l.value === current"
          @click="select(l.value)"
        >
          <span class="ai-chat-lang-toggle__option-label">{{ l.label }}</span>
          <svg
            v-if="l.value === current"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </li>
      </ul>
    </Teleport>
  </div>
</template>

<style>
@layer ai-chat-components {
  .ai-chat-lang-toggle {
    position: relative;
    display: inline-flex;
  }

  .ai-chat-lang-toggle__trigger {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 32px;
    padding: 0 10px;
    border: 1px solid var(--ai-chat-color-border);
    border-radius: var(--ai-chat-radius-md);
    background: var(--ai-chat-color-input-bg);
    color: var(--ai-chat-color-text-primary);
    font-size: 13px;
    line-height: 1;
    cursor: pointer;
    transition: background var(--ai-chat-duration-fast) var(--ai-chat-easing);
  }

  .ai-chat-lang-toggle__trigger:hover {
    background: var(--ai-chat-hover-neutral);
  }

  .ai-chat-lang-toggle__caret {
    transition: transform var(--ai-chat-duration-fast) var(--ai-chat-easing);
  }

  .ai-chat-lang-toggle__caret.is-open {
    transform: rotate(180deg);
  }

  .ai-chat-lang-toggle__menu {
    position: fixed;
    z-index: var(--ai-chat-z-popup);
    margin: 0;
    padding: 4px;
    list-style: none;
    min-width: 148px;
    background: var(--ai-chat-neutral-0);
    border: 1px solid var(--ai-chat-color-border);
    border-radius: var(--ai-chat-radius-md);
    box-shadow: var(--ai-chat-shadow-popup);
  }

  .ai-chat-lang-toggle__option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 7px 10px;
    border-radius: calc(var(--ai-chat-radius-md) - 2px);
    font-size: 13px;
    color: var(--ai-chat-color-text-primary);
    cursor: pointer;
  }

  .ai-chat-lang-toggle__option:hover {
    background: var(--ai-chat-hover-neutral);
  }

  .ai-chat-lang-toggle__option.is-selected {
    color: var(--ai-chat-color-accent);
    font-weight: 600;
  }
}
</style>
