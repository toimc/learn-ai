<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

interface Stat {
  value: number
  suffix?: string
  label: string
  /** 数字位数不足不补零，仅用于 count-up 目标 */
  plain?: boolean
}

const stats: Stat[] = [
  { value: 62, label: '组件导出' },
  { value: 12, label: '能力域' },
  { value: 5, label: 'npm 发布包' },
  { value: 1605, suffix: '+', label: '单元测试用例' },
  { value: 73, label: '主题令牌' },
  { value: 0, plain: true, label: 'CSS 框架依赖' },
]

const root = ref<HTMLElement | null>(null)
const displayed = ref(stats.map(() => 0))
let observer: IntersectionObserver | null = null
let raf: number | null = null

function animate() {
  const duration = 1100
  const start = performance.now()
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / duration)
    // easeOutExpo
    const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
    displayed.value = stats.map((s) => Math.round(s.value * eased))
    if (t < 1) raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
}

onMounted(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduced) {
    displayed.value = stats.map((s) => s.value)
    return
  }
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        observer?.disconnect()
        animate()
      }
    },
    { threshold: 0.4 },
  )
  if (root.value) observer.observe(root.value)
})

onUnmounted(() => {
  observer?.disconnect()
  if (raf) cancelAnimationFrame(raf)
})
</script>

<template>
  <div ref="root" class="home-stats">
    <div v-for="(s, i) in stats" :key="s.label" class="home-stats__item">
      <div class="home-stats__value">
        <span class="home-stats__num">{{
          s.plain ? s.value : displayed[i]
        }}</span>
        <span v-if="s.suffix" class="home-stats__suffix">{{ s.suffix }}</span>
      </div>
      <div class="home-stats__label">{{ s.label }}</div>
    </div>
  </div>
</template>

<style scoped>
.home-stats {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 1px;
  /* 宽度与外边距由全局 .VPHome .home-stats breakout 规则接管（hero 同宽 1152） */
  background: var(--vp-c-divider);
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  overflow: hidden;
}

.home-stats__item {
  background: var(--vp-c-bg);
  padding: 18px 8px 16px;
  text-align: center;
}

.home-stats__value {
  font-family: var(--vp-font-family-mono, ui-monospace, monospace);
  font-size: 30px;
  font-weight: 700;
  line-height: 1.1;
  color: var(--vp-c-brand-1);
  font-variant-numeric: tabular-nums;
}

.home-stats__suffix {
  font-size: 20px;
  margin-left: 1px;
}

.home-stats__label {
  margin-top: 6px;
  font-size: 12.5px;
  color: var(--vp-c-text-2);
  letter-spacing: 0.02em;
}

@media (max-width: 959px) {
  .home-stats {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 519px) {
  .home-stats {
    grid-template-columns: repeat(2, 1fr);
  }
  .home-stats__value {
    font-size: 24px;
  }
}
</style>
