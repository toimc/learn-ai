<script setup lang="ts">
import { onBeforeUnmount, onMounted, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    message: string
    type?: 'info' | 'success' | 'error' | 'warning'
    /** ms，0 = 不自动关闭 */
    duration?: number
  }>(),
  {
    type: 'info',
    duration: 3000,
  },
)

const emit = defineEmits<{
  close: []
}>()

let timer: ReturnType<typeof setTimeout> | undefined

function clearTimer() {
  if (timer !== undefined) {
    clearTimeout(timer)
    timer = undefined
  }
}

function startTimer() {
  clearTimer()
  if (props.duration > 0) {
    timer = setTimeout(() => {
      timer = undefined
      emit('close')
    }, props.duration)
  }
}

function handleClose() {
  clearTimer()
  emit('close')
}

onMounted(startTimer)
watch(() => props.duration, startTimer)
onBeforeUnmount(clearTimer)
</script>

<template>
  <div
    class="ai-chat-toast"
    :class="`ai-chat-toast--${type}`"
    :role="type === 'error' ? 'alert' : 'status'"
    :aria-live="type === 'error' ? undefined : 'polite'"
  >
    <svg
      class="ai-chat-toast__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      aria-hidden="true"
    >
      <path
        v-if="type === 'info'"
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
      />
      <path
        v-else-if="type === 'success'"
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
      <path
        v-else-if="type === 'error'"
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
      <path
        v-else
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.008v.008H12v-.008z"
      />
    </svg>
    <span class="ai-chat-toast__message">{{ message }}</span>
    <button
      class="ai-chat-toast__close"
      type="button"
      aria-label="关闭"
      @click="handleClose"
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
  </div>
</template>

<style>
@layer ai-chat-components {
  .ai-chat-toast {
    position: fixed;
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    z-index: var(--ai-chat-z-toast, 1000);
    display: flex;
    align-items: center;
    gap: 8px;
    max-width: calc(100vw - 32px);
    padding: 10px 14px;
    border: 1px solid var(--ai-chat-color-border);
    border-radius: var(--ai-chat-radius-lg);
    background: var(--ai-chat-color-bg-primary);
    color: var(--ai-chat-color-text-primary);
    font-family: var(--ai-chat-font-sans);
    font-size: 14px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    animation: ai-chat-toast-in var(--ai-chat-duration-normal) ease-out both;
  }

  .ai-chat-toast__icon {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
  }

  .ai-chat-toast__message {
    flex: 1;
    min-width: 0;
  }

  .ai-chat-toast__close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    flex-shrink: 0;
    padding: 0;
    border: none;
    border-radius: var(--ai-chat-radius-sm);
    background: transparent;
    color: var(--ai-chat-color-text-primary);
    cursor: pointer;
    transition: background var(--ai-chat-duration-fast) var(--ai-chat-easing);
  }

  .ai-chat-toast__close:hover {
    background: var(--ai-chat-hover-neutral);
  }

  .ai-chat-toast__close svg {
    width: 14px;
    height: 14px;
  }

  /* 图标类型色 */
  .ai-chat-toast--info .ai-chat-toast__icon {
    color: var(--ai-chat-color-accent);
  }

  .ai-chat-toast--success .ai-chat-toast__icon {
    color: var(--ai-chat-color-status-success);
  }

  .ai-chat-toast--error .ai-chat-toast__icon {
    color: var(--ai-chat-color-status-error);
  }

  .ai-chat-toast--warning .ai-chat-toast__icon {
    color: var(--ai-chat-color-status-warning);
  }

  @media (prefers-reduced-motion: reduce) {
    .ai-chat-toast {
      animation-name: ai-chat-toast-in-reduced;
    }
  }
}

@layer ai-chat-animations {
  @keyframes ai-chat-toast-in {
    from {
      opacity: 0;
      transform: translate(-50%, -8px);
    }
    to {
      opacity: 1;
      transform: translate(-50%, 0);
    }
  }

  @keyframes ai-chat-toast-in-reduced {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
}
</style>
