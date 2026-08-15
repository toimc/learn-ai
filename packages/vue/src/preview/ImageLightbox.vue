<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Attachment } from '@ai-chat/core'

const props = withDefaults(
  defineProps<{
    attachments: Attachment[]
    index?: number
  }>(),
  { index: 0 },
)

const emit = defineEmits<{ close: [] }>()

const current = ref(props.index)
watch(
  () => props.index,
  (i) => {
    current.value = i
  },
)

const image = computed(() => props.attachments[current.value])

function next() {
  current.value = (current.value + 1) % props.attachments.length
}

function prev() {
  current.value =
    (current.value - 1 + props.attachments.length) % props.attachments.length
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
  else if (e.key === 'ArrowRight') next()
  else if (e.key === 'ArrowLeft') prev()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <div
      class="ai-chat-lightbox__overlay"
      role="dialog"
      aria-modal="true"
      aria-label="图片预览"
      @click.self="emit('close')"
    >
      <button
        class="ai-chat-lightbox__nav ai-chat-lightbox__prev"
        type="button"
        aria-label="上一张"
        @click="prev"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M15.75 19.5L8.25 12l7.5-7.5"
          />
        </svg>
      </button>

      <img
        class="ai-chat-lightbox__image"
        :src="image?.url"
        :alt="image?.name"
      />

      <button
        class="ai-chat-lightbox__nav ai-chat-lightbox__next"
        type="button"
        aria-label="下一张"
        @click="next"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M8.25 4.5l7.5 7.5-7.5 7.5"
          />
        </svg>
      </button>

      <button
        class="ai-chat-lightbox__close"
        type="button"
        aria-label="关闭"
        @click="emit('close')"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>

      <span class="ai-chat-lightbox__count"
        >{{ current + 1 }} / {{ attachments.length }}</span
      >
    </div>
  </Teleport>
</template>

<style>
@layer ai-chat-components {
  .ai-chat-lightbox__overlay {
    position: fixed;
    inset: 0;
    z-index: var(--ai-chat-z-popup, 1000);
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--ai-chat-lightbox-mask, rgba(0, 0, 0, 0.75));
    animation: ai-chat-lightbox-fade var(--ai-chat-duration-normal)
      var(--ai-chat-easing) both;
  }

  .ai-chat-lightbox__image {
    max-width: calc(100vw - 160px);
    max-height: calc(100vh - 120px);
    object-fit: contain;
    border-radius: var(--ai-chat-radius-lg);
  }

  .ai-chat-lightbox__nav,
  .ai-chat-lightbox__close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--ai-chat-neutral-0);
    cursor: pointer;
    transition: background var(--ai-chat-duration-fast) var(--ai-chat-easing);
  }

  .ai-chat-lightbox__nav:hover,
  .ai-chat-lightbox__close:hover {
    background: var(--ai-chat-hover-neutral);
  }

  .ai-chat-lightbox__nav svg,
  .ai-chat-lightbox__close svg {
    width: 20px;
    height: 20px;
  }

  .ai-chat-lightbox__prev {
    position: absolute;
    left: 24px;
    top: 50%;
    transform: translateY(-50%);
  }

  .ai-chat-lightbox__next {
    position: absolute;
    right: 24px;
    top: 50%;
    transform: translateY(-50%);
  }

  .ai-chat-lightbox__close {
    position: absolute;
    top: 16px;
    right: 16px;
  }

  .ai-chat-lightbox__count {
    position: absolute;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    color: var(--ai-chat-neutral-0);
    font-family: var(--ai-chat-font-sans);
    font-size: 14px;
  }

  @media (prefers-reduced-motion: reduce) {
    .ai-chat-lightbox__overlay {
      animation: none;
    }
  }
}

@layer ai-chat-animations {
  @keyframes ai-chat-lightbox-fade {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
}
</style>
