<script setup lang="ts">
import PlaygroundDemo from './PlaygroundDemo.vue'
</script>

<template>
  <div class="playground-page">
    <PlaygroundDemo />
  </div>
</template>

<style scoped>
.playground-page {
  /* VitePress 的 navbar 为 relative 占据文档流（--vp-nav-height: 64px），
     内容区占满 navbar 以下的剩余视口高度，与 VitePress 内部结构解耦 */
  height: calc(100vh - var(--vp-nav-height, 64px));
  height: calc(100dvh - var(--vp-nav-height, 64px));
  overflow: hidden;
}
</style>
