export interface PromptItem {
  key: string
  label: string
  description?: string
  /** 任意图标名/组件由宿主 slot 渲染，此处仅透传 */
  icon?: string
  /** 二级提示：组件不渲染，select 事件原样透传由宿主决定展示形态 */
  children?: PromptItem[]
}
