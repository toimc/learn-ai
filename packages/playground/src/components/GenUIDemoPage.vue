<script setup lang="ts">
import GenUIDemo from './demos/GenUIDemo.vue'
</script>

<template>
  <div class="genui-demo-page">
    <ClientOnly>
      <GenUIDemo />
    </ClientOnly>
  </div>
</template>

<style scoped>
.genui-demo-page {
  min-height: calc(100vh - var(--vp-nav-height, 64px));
  min-height: calc(100dvh - var(--vp-nav-height, 64px));
}
</style>
