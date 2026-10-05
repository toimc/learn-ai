# 多模态发送

> 展示端早已就绪：附件能选择、能预览、能在消息气泡里渲染。但**预览用的 `blob:` 地址模型看不见**——`URL.createObjectURL` 产出的是浏览器本地地址，模型服务端读不到。预览归预览，模型从没见过这张图。本指南补齐「图片真正发进多模态模型」的前端链路。

## 断点在哪

现有附件链路：

```
选图 → URL.createObjectURL → blob: 预览地址 → 消息气泡渲染
```

断在最后一步：消息发给模型时，附件只有 `blob:` 地址，模型无法取回内容。补齐方案三步走：

```
File → canvas 压缩 → base64 data URL → Attachment.dataUrl → adapter 映射 parts 数组
```

## 为什么必须压缩再编码

base64 比原始二进制大 **33%**。手机照片普遍 4MB，直接编码成 5.3MB 文本，既慢又浪费 token。用 canvas 压到**长边 1024px、JPEG 质量 0.85**，对"看懂图里画了什么"这个目标足够，产物通常只有 **100-300KB**。

组件库把这一步做成了工具函数：`compressImageToDataUrl`（`@toimc/vue`）+ 一组纯函数（`@toimc/core`）。

## compressImageToDataUrl

```ts
import { compressImageToDataUrl } from '@toimc/vue'

// 发送前把 File 转成模型可读的 data URL
const dataUrl = await compressImageToDataUrl(file)

// 可自定义压缩参数
const dataUrl2 = await compressImageToDataUrl(file, {
  maxSide: 1024, // 长边像素上限，默认 1024；小图不会被放大
  quality: 0.85, // JPEG 质量 0-1，默认 0.85；>1 收敛到 1，非法值回退默认
  signal,        // AbortSignal，中断会以 AbortError 拒绝
})
```

```ts
async function compressImageToDataUrl(
  file: File,
  options?: CompressImageOptions,
): Promise<string>
```

内部流程：校验图片类型 → 解码为位图（`createImageBitmap`）→ 等比缩放到长边上限内（`computeScaledSize`）→ canvas 绘制 → `canvas.toDataURL('image/jpeg', quality)`。解码出的 `ImageBitmap` 用完自动 `close()`，不留泄漏。

### 错误处理

所有失败都以可读的中文 `Error` 拒绝，可直接展示给用户：

| 场景 | 错误信息 |
|------|----------|
| 非图片文件 | `仅支持图片文件，已忽略：xxx.png` |
| 解码失败 | `图片解码失败，请确认文件完整（原始原因）` |
| 尺寸不可读 | `无法读取图片尺寸，文件可能已损坏` |
| 环境无 canvas | `当前环境不支持 canvas 2d 绘制` |
| 中断 | `AbortError`（`error.name === 'AbortError'`，调用方按取消处理，不算失败） |

### 依赖注入（测试与非浏览器环境）

`deps` 选项暴露两个注入点，jsdom 等无 canvas 环境下测试时可整体替换：

```ts
interface CompressImageDeps {
  /** 文件解码为可绘制位图，缺省 createImageBitmap */
  decodeImage?: (file: File) => Promise<DrawableImageSource & CanvasImageSource>
  /** 创建画布，缺省 document.createElement('canvas') */
  createCanvas?: () => HTMLCanvasElement
}
```

## core 纯函数

压缩的纯逻辑部分抽在 `@toimc/core`（零依赖，可直接单测复用）：

| 导出 | 说明 |
|------|------|
| `computeScaledSize(width, height, maxSide)` | 长边缩放计算，返回 `{ width, height, scale }`；`scale = min(1, maxSide / 长边)`，小图不放大，宽高 `Math.round`；入参非正/非有限抛错 |
| `clampImageQuality(quality, fallback?)` | 质量归一：`undefined`/`NaN`/`<=0` → fallback（默认 0.85），`>1` → 1 |
| `buildJpegDataUrl(base64)` | 拼装 `data:image/jpeg;base64,` 前缀；你已持有裸 base64 时使用 |
| `isImageFile({ type })` | `type` 以 `image/` 开头即图片 |
| `DEFAULT_IMAGE_MAX_SIDE` | `1024` |
| `DEFAULT_IMAGE_JPEG_QUALITY` | `0.85` |
| `JPEG_DATA_URL_PREFIX` | `data:image/jpeg;base64,` |

## Attachment.dataUrl 与发送

`Attachment`（`@toimc/core`）扩展了可选的 `dataUrl` 字段——渐进增强，老代码不受影响：

```ts
import type { Attachment } from '@toimc/core'

const attachment: Attachment = {
  id: 'att-1',
  name: file.name,
  mediaType: file.type,
  size: file.size,
  url: previewUrl, // blob: 预览地址，气泡渲染用
  dataUrl,         // 压缩后的 data URL，发给模型用
}
```

adapter 侧把带 `dataUrl` 的附件映射成 OpenAI 兼容的 parts 数组（GLM-4V、OpenAI vision 均适用）：

```ts
const content = [
  { type: 'text', text: message.content },
  ...(message.attachments ?? [])
    .filter((a) => a.dataUrl)
    .map((a) => ({ type: 'image_url', image_url: { url: a.dataUrl } })),
]
```

验证方式：发一张报错截图问"这个错误怎么解决"，看模型回复是否引用了图里的具体内容——引用了，链路就通了。

## blob 预览地址的清理纪律

`URL.createObjectURL` 产出的地址必须成对 `revokeObjectURL`，否则 blob 引用滞留内存。组件内部（`usePendingFiles` / `PromptInput` 附件区）已自动管理：移除附件、清空列表、组件销毁时统一 revoke。宿主若自管 `objectURL`，请沿用同一纪律。

## 已知局限

- **EXIF 方向未处理**：部分手机照片带旋转元数据，解码后可能方向不符；模型理解内容通常不受影响，追求严格方向时宿主可在解码阶段自行处理。
- **输出恒为 JPEG**：PNG 透明通道会丢失（压在白底上）。对"给模型看"的场景这是预期行为；需要保真的原图展示请走 `url` 预览。
