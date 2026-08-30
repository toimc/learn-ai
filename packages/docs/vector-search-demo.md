---
layout: VectorSearchDemoPage
title: 向量检索演示
---

本页连接本地 dev-server 的 `/vector` 端点，把 docs-agent 的语义检索升级**可视化**。页面分两个 tab：

## tab 一：检索对比

顶部统计（模型 / 语义块数 / 维度）来自 `GET /vector/stats`，随 `.env` 的 `EMBEDDING_*` 配置如实变化。**示例查询**置顶（四个口语化查询一键可点），同一查询双路并排：

| | 纯关键词路 | 语义混合路 |
|---|---|---|
| 原理 | 同义词表 + TF-IDF（标题命中 ×5）+ 中英边界切分 | 向量召回 top8（cosine ≥ 0.35）+ 关键词路 RRF 融合 |
| 强项 | 组件英文名精确查询（`MessageBubble`） | 口语化、换说法的查询（「支持英文」「夜间颜色不对」） |
| 失效场景 | 同义词表没覆盖的口语（0 命中） | Ollama 未启动时自动降级为关键词（页面顶部黄条提示原因） |

试试「**怎么让组件库支持英文**」：左路 0 命中，右路命中 `guide/i18n.md`——同义词表没有「英文」这个词，向量按语义找到了国际化文档。

### 调用链路

查询后链路卡片激活，每个节点显示**实测耗时**：

```
🌐 浏览器 → ⚡ dev-server (POST /api/vector/search)
    ├─ 📄 关键词路：本地读盘 TF-IDF           ~4ms
    └─ 🧠 Ollama 查询嵌入 → 🗃️ LibSQLVector top8   ~300ms
⚖️ RRF 融合 → top5
```

嵌入节点随 `EMBEDDING_MODEL_URL` 如实展示：本地端点显 host + 「本地」绿标，云端端点自动切换为「云端」蓝标；向量库节点显示当前引擎与库文件名（换引擎时由 stats 的 `vector.engine/location` 驱动）。**查询耗时的大头就是每次实时调用本地 Ollama 做查询嵌入**——语料向量是入库时一次算好的，查询不重算。

## tab 二：向量库浏览

分页直读 `docs-vector.db` 的全部语义块（`GET /vector/chunks`，每页 20 条）：

- **内容过滤框**：输入关键词（如 `i18n`）即时 LIKE 过滤块文本
- **按文档筛选**：点击块的 `source` 徽标只看该文档的块，再点清除
- **展开全文**：块默认 110 字摘要，点击展开完整切块原文（入库时 MDocument 切出的最小检索单元）

## 前置条件

```bash
# 1. 本地 Ollama + embedding 模型（一次性）
ollama pull bge-m3

# 2. .env 启用（packages/dev-server/.env）
EMBEDDING_MODEL=bge-m3

# 3. 文档入库（一次性，约 30 秒；文档变更后重跑）
cd packages/dev-server && pnpm index:docs
```

`.env` 修改会被 `tsx watch` 监听自动热重启生效。检索原理深读（切块 / 嵌入 / 索引管理 / 混合融合 / 降级链）见[语义检索指南](/guide/rag)，会话记忆的落盘与隔离见[会话记忆指南](/guide/memory)；接口明细见[接口文档](/mock-api)的「向量检索」分组。
