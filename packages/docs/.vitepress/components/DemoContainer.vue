<template>
  <div class="demo-container">
    <slot />
  </div>
</template>

<style scoped>
.demo-container {
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  padding: 24px;
  margin: 16px 0;
  background: var(--vp-c-bg-soft);
}
</style>
