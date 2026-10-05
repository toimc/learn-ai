<script setup lang="ts">
import FeedbackDemo from './demos/FeedbackDemo.vue'
</script>

<template>
  <div class="feedback-demo-page">
    <ClientOnly>
      <FeedbackDemo />
    </ClientOnly>
  </div>
</template>

<style scoped>
.feedback-demo-page {
  min-height: calc(100vh - var(--vp-nav-height, 64px));
  min-height: calc(100dvh - var(--vp-nav-height, 64px));
}
</style>
