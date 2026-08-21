import { watch, onMounted, type Ref } from 'vue'
import { presets, type PresetKey } from '../theme/presets'

export function useThemePreset(
  containerRef: Ref<HTMLElement | undefined>,
  preset: Ref<PresetKey | undefined>,
  customVars: Ref<Record<string, string> | undefined>,
) {
  function apply() {
    const el = containerRef.value
    if (!el) return
    // 仅清预设/自定义相关的原始层变量，避免清空宿主 inline style
    const keys = new Set<string>()
    if (preset.value)
      Object.keys(presets[preset.value].vars).forEach((k) => keys.add(k))
    if (customVars.value)
      Object.keys(customVars.value).forEach((k) => keys.add(k))
    keys.forEach((k) => el.style.removeProperty(k))
    const p = presets[preset.value || 'default']
    if (p)
      for (const [k, v] of Object.entries(p.vars)) el.style.setProperty(k, v)
    if (customVars.value)
      for (const [k, v] of Object.entries(customVars.value))
        el.style.setProperty(k, v)
  }
  onMounted(apply)
  watch([preset, customVars], apply, { deep: true })
}
