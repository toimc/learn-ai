<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { aiChatI18n } from '../locales'
import Button from '../shared/Button.vue'
import Input from '../shared/Input.vue'
import Radio from '../shared/Radio.vue'
import type { ProviderFormPayload } from './types'

const { t } = aiChatI18n.global

const emit = defineEmits<{
  create: [payload: ProviderFormPayload]
}>()

type ProviderType = 'openai-compat' | 'anthropic'

const form = reactive({
  name: '',
  provider: 'openai-compat' as ProviderType,
  baseURL: '',
  apiKey: '',
  model: '',
  persist: true,
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

// Radio 原语只更新 model 不抛 change，类型切换钩子改由 watch 承接
watch(() => form.provider, onProviderTypeChange)

function onPresetClick(preset: { url: string }, e: Event) {
  // Button 原语未设原生 type=button，阻止默认表单提交（等价旧 type="button"）
  e.preventDefault()
  form.baseURL = preset.url
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
    persist: form.persist,
  })
}
</script>

<template>
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
        <Radio
          v-model="form.provider"
          name="ai-chat-provider-type"
          value="openai-compat"
          :label="t('provider.typeOpenaiCompat')"
        />
        <Radio
          v-model="form.provider"
          name="ai-chat-provider-type"
          value="anthropic"
          :label="t('provider.typeAnthropic')"
        />
      </div>
    </fieldset>

    <div
      class="ai-chat-provider-dialog__field ai-chat-provider-dialog__field--name"
    >
      <span class="ai-chat-provider-dialog__label">
        {{ t('provider.nameLabel') }}
      </span>
      <Input
        v-model="form.name"
        size="sm"
        :placeholder="t('provider.namePlaceholder')"
        :aria-label="t('provider.nameLabel')"
        @blur="touched.name = true"
      />
      <p v-if="errors.name" class="ai-chat-provider-dialog__error" role="alert">
        {{ errors.name }}
      </p>
    </div>

    <div
      class="ai-chat-provider-dialog__field ai-chat-provider-dialog__field--baseURL"
    >
      <span class="ai-chat-provider-dialog__label">
        {{ t('provider.baseURLLabel') }}
      </span>
      <Input
        v-model="form.baseURL"
        size="sm"
        :placeholder="t('provider.baseURLPlaceholder')"
        :aria-label="t('provider.baseURLLabel')"
        @blur="touched.baseURL = true"
      />
      <div v-if="isCompat" class="ai-chat-provider-dialog__presets">
        <span class="ai-chat-provider-dialog__presets-label">
          {{ t('provider.baseURLPresetsLabel') }}
        </span>
        <Button
          v-for="preset in BASE_URL_PRESETS"
          :key="preset.url"
          type="secondary"
          size="small"
          class="ai-chat-provider-dialog__preset"
          :class="`ai-chat-provider-dialog__preset--${preset.id}`"
          :aria-pressed="form.baseURL === preset.url"
          @click="onPresetClick(preset, $event)"
        >
          {{ t(preset.labelKey) }}
        </Button>
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
      <Input
        v-model="form.apiKey"
        type="password"
        autocomplete="new-password"
        size="sm"
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
      <Input
        v-model="form.model"
        size="sm"
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

    <label class="ai-chat-provider-dialog__remember">
      <input
        v-model="form.persist"
        type="checkbox"
        class="ai-chat-provider-dialog__remember-input"
      />
      <span>{{ t('provider.rememberLabel') }}</span>
    </label>

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
</template>
