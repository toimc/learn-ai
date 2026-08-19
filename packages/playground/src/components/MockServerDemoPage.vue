<script setup lang="ts">
import MockServerDemo from './demos/MockServerDemo.vue'
</script>

<template>
  <div class="mock-server-demo-page">
    <ClientOnly>
      <MockServerDemo />
    </ClientOnly>
  </div>
</template>

<style scoped>
.mock-server-demo-page {
  min-height: calc(100vh - var(--vp-nav-height, 64px));
  min-height: calc(100dvh - var(--vp-nav-height, 64px));
}
</style>
