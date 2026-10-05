<script setup lang="ts">
import VoiceDemo from './demos/VoiceDemo.vue'
</script>

<template>
  <div class="voice-demo-page">
    <ClientOnly>
      <VoiceDemo />
    </ClientOnly>
  </div>
</template>

<style scoped>
.voice-demo-page {
  min-height: calc(100vh - var(--vp-nav-height, 64px));
  min-height: calc(100dvh - var(--vp-nav-height, 64px));
}
</style>
