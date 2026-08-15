<script setup lang="ts">
import MultimodalInputDemo from './demos/MultimodalInputDemo.vue'
</script>

<template>
  <div class="multimodal-demo-page">
    <ClientOnly>
      <MultimodalInputDemo />
    </ClientOnly>
  </div>
</template>

<style scoped>
.multimodal-demo-page {
  min-height: calc(100vh - var(--vp-nav-height, 64px));
  min-height: calc(100dvh - var(--vp-nav-height, 64px));
}
</style>
