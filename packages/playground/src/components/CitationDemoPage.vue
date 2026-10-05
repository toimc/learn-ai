<script setup lang="ts">
import CitationDemo from './demos/CitationDemo.vue'
</script>

<template>
  <div class="citation-demo-page">
    <ClientOnly>
      <CitationDemo />
    </ClientOnly>
  </div>
</template>

<style scoped>
.citation-demo-page {
  min-height: calc(100vh - var(--vp-nav-height, 64px));
  min-height: calc(100dvh - var(--vp-nav-height, 64px));
}
</style>
