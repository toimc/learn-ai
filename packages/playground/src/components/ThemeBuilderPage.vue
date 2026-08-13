<script setup lang="ts">
import ThemeBuilder from './ThemeBuilder.vue'
</script>

<template>
  <div class="theme-builder-layout">
    <ThemeBuilder />
  </div>
</template>

<style>
.theme-builder-layout {
  width: 100%;
  min-height: calc(100vh - var(--vp-nav-height, 64px));
  min-height: calc(100dvh - var(--vp-nav-height, 64px));
}
</style>
