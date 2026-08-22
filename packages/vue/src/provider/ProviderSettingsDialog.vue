<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive } from 'vue'
import { aiChatI18n } from '../locales'
import Button from '../shared/Button.vue'
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

type ProviderType = 'openai-compat' | 'anthropic'

const form = reactive({
  name: '',
  provider: 'openai-compat' as ProviderType,
  baseURL: '',
  apiKey: '',
  model: '',
})

// 字段 touched 后才显示行内错误，避免打开弹层即满屏红字
const touched = reactive({
  name: false,
  baseURL: false,
  apiKey: false,
  model: false,
})

const BASE_URL_PRESETS: ReadonlyArray<{
  id: string
  labelKey: string
  url: string
}> = [
  {
    id: 'openai',
    labelKey: 'provider.presetOpenai',
    url: 'https://api.openai.com/v1',
  },
  {
    id: 'deepseek',
    labelKey: 'provider.presetDeepseek',
    url: 'https://api.deepseek.com/v1',
  },
  {
    id: 'glm',
    labelKey: 'provider.presetGlm',
    url: 'https://open.bigmodel.cn/api/paas/v4',
  },
  {
    id: 'kimi',
    labelKey: 'provider.presetKimi',
    url: 'https://api.moonshot.cn/v1',
  },
]

const isCompat = computed(() => form.provider === 'openai-compat')

const errors = computed(() => ({
  name: touched.name && !form.name.trim() ? t('provider.errorRequired') : '',
  baseURL:
    touched.baseURL && isCompat.value && !form.baseURL.trim()
      ? t('provider.errorRequired')
      : '',
  apiKey:
    touched.apiKey && !form.apiKey.trim() ? t('provider.errorRequired') : '',
  model: touched.model && !form.model.trim() ? t('provider.errorRequired') : '',
}))

const isValid = computed(
  () =>
    form.name.trim() !== '' &&
    form.apiKey.trim() !== '' &&
    form.model.trim() !== '' &&
    (!isCompat.value || form.baseURL.trim() !== ''),
)

function onProviderTypeChange() {
  // 跨类型端点互不通用：切换即清空，避免把 OpenAI 端点带给 anthropic
  form.baseURL = ''
  touched.baseURL = false
}

function onSubmit() {
  // 按钮已禁用，此处兜底拦截程序化触发（jsdom 会绕过 disabled 派发事件）
  Object.assign(touched, {
    name: true,
    baseURL: true,
    apiKey: true,
    model: true,
  })
  if (!isValid.value) return
  const baseURL = form.baseURL.trim()
  emit('create', {
    name: form.name.trim(),
    provider: form.provider,
    ...(baseURL ? { baseURL } : {}),
    apiKey: form.apiKey.trim(),
    model: form.model.trim(),
  })
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

        <form
          class="ai-chat-provider-dialog__form"
          novalidate
          @submit.prevent="onSubmit"
        >
          <fieldset
            class="ai-chat-provider-dialog__field ai-chat-provider-dialog__field--type"
          >
            <legend class="ai-chat-provider-dialog__label">
              {{ t('provider.typeLabel') }}
            </legend>
            <div class="ai-chat-provider-dialog__radios">
              <label class="ai-chat-provider-dialog__radio">
                <input
                  v-model="form.provider"
                  type="radio"
                  value="openai-compat"
                  name="ai-chat-provider-type"
                  @change="onProviderTypeChange"
                />
                <span>{{ t('provider.typeOpenaiCompat') }}</span>
              </label>
              <label class="ai-chat-provider-dialog__radio">
                <input
                  v-model="form.provider"
                  type="radio"
                  value="anthropic"
                  name="ai-chat-provider-type"
                  @change="onProviderTypeChange"
                />
                <span>{{ t('provider.typeAnthropic') }}</span>
              </label>
            </div>
          </fieldset>

          <div
            class="ai-chat-provider-dialog__field ai-chat-provider-dialog__field--name"
          >
            <span class="ai-chat-provider-dialog__label">
              {{ t('provider.nameLabel') }}
            </span>
            <input
              v-model="form.name"
              class="ai-chat-provider-dialog__input"
              type="text"
              :placeholder="t('provider.namePlaceholder')"
              :aria-label="t('provider.nameLabel')"
              @blur="touched.name = true"
            />
            <p
              v-if="errors.name"
              class="ai-chat-provider-dialog__error"
              role="alert"
            >
              {{ errors.name }}
            </p>
          </div>

          <div
            class="ai-chat-provider-dialog__field ai-chat-provider-dialog__field--baseURL"
          >
            <span class="ai-chat-provider-dialog__label">
              {{ t('provider.baseURLLabel') }}
            </span>
            <input
              v-model="form.baseURL"
              class="ai-chat-provider-dialog__input"
              type="text"
              :placeholder="t('provider.baseURLPlaceholder')"
              :aria-label="t('provider.baseURLLabel')"
              @blur="touched.baseURL = true"
            />
            <div v-if="isCompat" class="ai-chat-provider-dialog__presets">
              <span class="ai-chat-provider-dialog__presets-label">
                {{ t('provider.baseURLPresetsLabel') }}
              </span>
              <button
                v-for="preset in BASE_URL_PRESETS"
                :key="preset.url"
                type="button"
                class="ai-chat-provider-dialog__preset"
                :class="`ai-chat-provider-dialog__preset--${preset.id}`"
                :aria-pressed="form.baseURL === preset.url"
                @click="form.baseURL = preset.url"
              >
                {{ t(preset.labelKey) }}
              </button>
            </div>
            <p
              v-if="errors.baseURL"
              class="ai-chat-provider-dialog__error"
              role="alert"
            >
              {{ errors.baseURL }}
            </p>
          </div>

          <div
            class="ai-chat-provider-dialog__field ai-chat-provider-dialog__field--apiKey"
          >
            <span class="ai-chat-provider-dialog__label">
              {{ t('provider.apiKeyLabel') }}
            </span>
            <input
              v-model="form.apiKey"
              class="ai-chat-provider-dialog__input"
              type="password"
              autocomplete="new-password"
              :placeholder="t('provider.apiKeyPlaceholder')"
              :aria-label="t('provider.apiKeyLabel')"
              @blur="touched.apiKey = true"
            />
            <p
              v-if="errors.apiKey"
              class="ai-chat-provider-dialog__error"
              role="alert"
            >
              {{ errors.apiKey }}
            </p>
          </div>

          <div
            class="ai-chat-provider-dialog__field ai-chat-provider-dialog__field--model"
          >
            <span class="ai-chat-provider-dialog__label">
              {{ t('provider.modelLabel') }}
            </span>
            <input
              v-model="form.model"
              class="ai-chat-provider-dialog__input"
              type="text"
              :placeholder="t('provider.modelPlaceholder')"
              :aria-label="t('provider.modelLabel')"
              @blur="touched.model = true"
            />
            <p
              v-if="errors.model"
              class="ai-chat-provider-dialog__error"
              role="alert"
            >
              {{ errors.model }}
            </p>
          </div>

          <div class="ai-chat-provider-dialog__actions">
            <Button
              class="ai-chat-provider-dialog__submit"
              :disabled="!isValid"
              @click="onSubmit"
            >
              {{ t('provider.submit') }}
            </Button>
          </div>
        </form>

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

  .ai-chat-provider-dialog__radio {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    cursor: pointer;
  }

  .ai-chat-provider-dialog__radio input {
    margin: 0;
    accent-color: var(--ai-chat-color-accent);
  }

  .ai-chat-provider-dialog__input {
    height: 32px;
    padding: 0 10px;
    border: 1px solid var(--ai-chat-color-input-border);
    border-radius: var(--ai-chat-radius-sm);
    background: var(--ai-chat-color-input-bg);
    color: var(--ai-chat-color-text-primary);
    font: inherit;
    font-size: 13px;
  }

  .ai-chat-provider-dialog__input:focus {
    outline: none;
    border-color: var(--ai-chat-color-input-focus-border);
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

  .ai-chat-provider-dialog__preset {
    height: 24px;
    padding: 0 10px;
    border: 1px solid var(--ai-chat-color-border);
    border-radius: var(--ai-chat-radius-sm);
    background: var(--ai-chat-color-bg-primary);
    color: var(--ai-chat-color-text-secondary);
    font-size: 12px;
    cursor: pointer;
    transition:
      border-color var(--ai-chat-duration-fast) var(--ai-chat-easing),
      background var(--ai-chat-duration-fast) var(--ai-chat-easing),
      color var(--ai-chat-duration-fast) var(--ai-chat-easing);
  }

  .ai-chat-provider-dialog__preset:hover {
    border-color: var(--ai-chat-color-accent);
    color: var(--ai-chat-color-accent);
  }

  .ai-chat-provider-dialog__preset[aria-pressed='true'] {
    border-color: var(--ai-chat-color-accent);
    background: var(--ai-chat-color-accent-dim);
    color: var(--ai-chat-color-accent);
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
