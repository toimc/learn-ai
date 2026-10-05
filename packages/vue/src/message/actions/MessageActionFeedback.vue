<script setup lang="ts">
import MessageFeedback from '../MessageFeedback.vue'

interface Props {
  /** 受控反馈值（回显历史），null = 无反馈 */
  value?: 'up' | 'down' | null
}

const props = withDefaults(defineProps<Props>(), { value: null })

const emit = defineEmits<{
  change: [value: 'up' | 'down' | null]
  comment: [text: string]
}>()

function onChange(value: 'up' | 'down' | null) {
  emit('change', value)
}

function onComment(text: string) {
  emit('comment', text)
}
</script>

<template>
  <!-- 单行紧凑包装：操作行自身已做 hover 显隐，data-always-visible
       让反馈按钮不重复隐藏；评论框窄幅适配行内空间 -->
  <div class="ai-chat-message-action-feedback">
    <MessageFeedback
      data-always-visible
      :value="props.value"
      @change="onChange"
      @comment="onComment"
    />
  </div>
</template>

<style scoped>
.ai-chat-message-action-feedback {
  display: inline-flex;
  align-items: center;
}

.ai-chat-message-action-feedback :deep(.ai-chat-message-feedback__comment) {
  max-width: 280px;
}
</style>
