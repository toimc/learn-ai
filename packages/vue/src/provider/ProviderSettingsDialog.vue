<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { aiChatI18n } from '../locales'
import Button from '../shared/Button.vue'
import ProviderSettingsForm from './ProviderSettingsForm.vue'
import type { ProviderFormPayload, ProviderOption } from './types'

const { t } = aiChatI18n.global

defineProps<{
  providers: ProviderOption[]
}>()

const emit = defineEmits<{
  create: [payload: ProviderFormPayload]
  remove: [id: string]
}>()

const open = defineModel<boolean>('open', { default: false })

function onCreate(payload: ProviderFormPayload) {
  emit('create', payload)
}

function onRemove(id: string) {
  emit('remove', id)
}

function close() {
  open.value = false
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && open.value) close()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="ai-chat-provider-dialog__overlay"
      role="dialog"
      aria-modal="true"
      :aria-label="t('provider.title')"
      @click.self="close"
    >
      <div class="ai-chat-provider-dialog">
        <header class="ai-chat-provider-dialog__header">
          <h2 class="ai-chat-provider-dialog__title">
            {{ t('provider.title') }}
          </h2>
          <button
            type="button"
            class="ai-chat-provider-dialog__close"
            :aria-label="t('shared.close')"
            @click="close"
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
        </header>

        <!-- 表单状态收进子组件：外层（含 Teleport）不随输入重渲染，避免整棵子树重建 -->
        <ProviderSettingsForm @create="onCreate" />

        <section class="ai-chat-provider-dialog__list">
          <h3 class="ai-chat-provider-dialog__list-title">
            {{ t('provider.listTitle') }}
          </h3>
          <p
            v-if="providers.length === 0"
            class="ai-chat-provider-dialog__list-empty"
          >
            {{ t('provider.listEmpty') }}
          </p>
          <ul v-else class="ai-chat-provider-dialog__items">
            <li
              v-for="item in providers"
              :key="item.id"
              class="ai-chat-provider-dialog__item"
            >
              <div class="ai-chat-provider-dialog__item-info">
                <span class="ai-chat-provider-dialog__item-name">{{
                  item.name
                }}</span>
                <span class="ai-chat-provider-dialog__item-meta">
                  {{ item.provider
                  }}<template v-if="item.model"> · {{ item.model }}</template>
                </span>
              </div>
              <Button
                class="ai-chat-provider-dialog__remove"
                type="danger"
                size="small"
                @click="onRemove(item.id)"
              >
                {{ t('provider.remove') }}
              </Button>
            </li>
          </ul>
        </section>
      </div>
    </div>
  </Teleport>
</template>

<style>
@layer ai-chat-components {
  .ai-chat-provider-dialog__overlay {
    position: fixed;
    inset: 0;
    z-index: var(--ai-chat-z-popup, 1000);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background: var(--ai-chat-provider-dialog-mask, rgba(0, 0, 0, 0.45));
  }

  .ai-chat-provider-dialog {
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 480px;
    max-height: calc(100vh - 48px);
    overflow-y: auto;
    background: var(--ai-chat-color-bg-primary);
    border: 1px solid var(--ai-chat-color-border);
    border-radius: var(--ai-chat-radius-lg);
    box-shadow: var(--ai-chat-shadow-popup);
    font-family: var(--ai-chat-font-sans);
    color: var(--ai-chat-color-text-primary);
  }

  .ai-chat-provider-dialog__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--ai-chat-color-border);
  }

  .ai-chat-provider-dialog__title {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
  }

  .ai-chat-provider-dialog__close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border: none;
    border-radius: var(--ai-chat-radius-sm);
    background: transparent;
    color: var(--ai-chat-color-text-secondary);
    cursor: pointer;
    transition:
      background var(--ai-chat-duration-fast) var(--ai-chat-easing),
      color var(--ai-chat-duration-fast) var(--ai-chat-easing);
  }

  .ai-chat-provider-dialog__close:hover {
    background: var(--ai-chat-hover-neutral);
    color: var(--ai-chat-color-text-primary);
  }

  .ai-chat-provider-dialog__close svg {
    width: 16px;
    height: 16px;
  }

  .ai-chat-provider-dialog__form {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 14px 16px;
    border-bottom: 1px solid var(--ai-chat-color-border);
  }

  .ai-chat-provider-dialog__field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
    margin: 0;
    padding: 0;
    border: none;
  }

  .ai-chat-provider-dialog__label {
    font-size: 12.5px;
    color: var(--ai-chat-color-text-secondary);
  }

  .ai-chat-provider-dialog__radios {
    display: flex;
    gap: 16px;
  }

  .ai-chat-provider-dialog__presets {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
  }

  .ai-chat-provider-dialog__presets-label {
    font-size: 12px;
    color: var(--ai-chat-color-text-muted);
  }

  /* 控件外观交给 Button 原语，这里只保留选中态（aria-pressed）。
     Button 样式为 scoped（未分层），本规则在 @layer 内无法在层战里赢它，
     改走 CSS 变量钩子通道：变量随级联进入按钮子树，由 Button 自己消费 */
  .ai-chat-provider-dialog__preset[aria-pressed='true'] {
    --ai-chat-btn-secondary-border: var(--ai-chat-color-accent);
    --ai-chat-btn-secondary-bg: var(--ai-chat-color-accent-dim);
    --ai-chat-btn-secondary-hover-bg: var(--ai-chat-color-accent-dim);
    --ai-chat-btn-secondary-color: var(--ai-chat-color-accent);
  }

  .ai-chat-provider-dialog__error {
    margin: 0;
    font-size: 12px;
    color: var(--ai-chat-color-status-error);
  }

  .ai-chat-provider-dialog__actions {
    display: flex;
    justify-content: flex-end;
  }

  .ai-chat-provider-dialog__list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px 16px;
  }

  .ai-chat-provider-dialog__list-title {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    color: var(--ai-chat-color-text-secondary);
  }

  .ai-chat-provider-dialog__list-empty {
    margin: 0;
    font-size: 12.5px;
    color: var(--ai-chat-color-text-muted);
  }

  .ai-chat-provider-dialog__items {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .ai-chat-provider-dialog__item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 10px;
    border: 1px solid var(--ai-chat-color-border);
    border-radius: var(--ai-chat-radius-sm);
    background: var(--ai-chat-color-bg-secondary);
  }

  .ai-chat-provider-dialog__item-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .ai-chat-provider-dialog__item-name {
    font-size: 13px;
    font-weight: 500;
  }

  .ai-chat-provider-dialog__item-meta {
    font-size: 12px;
    color: var(--ai-chat-color-text-muted);
  }
}
</style>
