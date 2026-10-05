<script setup lang="ts">
import ModelMetaDemo from './demos/ModelMetaDemo.vue'
</script>

<template>
  <div class="model-meta-demo-page">
    <ClientOnly>
      <ModelMetaDemo />
    </ClientOnly>
  </div>
</template>

<style scoped>
.model-meta-demo-page {
  min-height: calc(100vh - var(--vp-nav-height, 64px));
  min-height: calc(100dvh - var(--vp-nav-height, 64px));
}
</style>
