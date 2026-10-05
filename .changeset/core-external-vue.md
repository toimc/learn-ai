---
'@toimc/core': patch
---

修复发布产物内联完整 Vue 运行时的问题：声明 `vue` 为 peerDependency 并在构建中 external。此前宿主安装后与自身 Vue 形成**双 Vue 实例**，`useChat` 的 reactive 状态无法被宿主追踪，流式更新静默失效；同时产物体积从 60KB 降至 9KB。
