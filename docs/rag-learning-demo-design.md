# RAG Learning Demo - 可视化学习平台设计

> 日期：2026-03-16
> 定位：RAG 技术学习与演示项目，重点在**可视化每一步**，让 RAG 管道"透明化"
> 参考：[All-in-RAG 教程](https://github.com/datawhalechina/all-in-rag)、[Unravel RAG 可视化工具](https://dev.to/jvorndran/building-unravel-learning-rag-through-visualization-26o)

---

## 一、项目定位

这不是一个生产系统，而是一个 **"玻璃盒" RAG**：

- 每个环节都可视化，看到中间结果
- 支持切换不同策略（分块方式、检索模式等），对比效果
- 提供流程追踪面板，理解数据如何从文档变成答案
- 文档来源：飞书文档（通过链接导入）

---

## 二、技术栈

```
框架：        Next.js 14+ (App Router, TypeScript)
部署：        Vercel
数据库：      Supabase (Postgres + pgvector)
嵌入模型：    火山引擎 Ark Embedding-3 API
对话模型：    Kimi K2.5 / Ark Agent Plan（通过 Vercel AI SDK）
文档来源：    飞书开放平台 SDK (@larksuiteoapi/node-sdk)
RAG 编排：    LangChain.js
流式输出：    Vercel AI SDK (@ai-sdk/moonshotai + -sdk/openai-compatible)
可视化：      React Flow (流程图) + Recharts (图表) + Three.js/UMAP (3D 向量空间)
样式：        Tailwind CSS + shadcn/ui
```

---

## 三、核心页面设计

### 页面 1：文档摄入工坊 `/ingest`

**功能**：输入飞书文档链接 → 可视化整个摄入过程

```
┌─────────────────────────────────────────────────────────────┐
│  📥 文档摄入工坊                                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────┐            │
│  │ 飞书文档链接: [________________________] [导入] │            │
│  └─────────────────────────────────────────────┘            │
│                                                             │
│  ═══ 摄入流水线可视化 ═══                                     │
│                                                             │
│  ① 原始文档    ② 解析结果     ③ 分块策略     ④ 向量嵌入      │
│  ┌────────┐   ┌────────┐    ┌────────┐    ┌────────┐      │
│  │ 飞书    │──▶│ 结构化  │──▶│ 分块   │──▶│ 嵌入   │      │
│  │ 原文    │   │ 文本    │   │ 对比   │   │ 可视化  │      │
│  └────────┘   └────────┘    └────────┘    └────────┘      │
│                                                             │
│  ┌─ 当前步骤详情 ──────────────────────────────────────┐     │
│  │                                                      │     │
│  │  (根据点击的步骤显示不同内容)                           │     │
│  │                                                      │     │
│  └──────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

**每个步骤的可视化内容**：

#### ① 原始文档获取

```
展示内容：
- 飞书 API 调用过程（请求/响应）
- 原始文档内容（Markdown 渲染）
- 文档元数据（标题、创建时间、作者、字数）
- 文档结构树（标题层级）
```

#### ② 文档解析

```
展示内容：
- 文档格式清洗过程（去除无关标记、格式化）
- 结构化提取结果（标题、段落、列表、代码块、表格）
- 元素类型标注（用不同颜色高亮不同类型的内容块）
- Token 统计（总 token 数、各段落 token 数柱状图）
```

#### ③ 分块策略对比（核心教学功能）

```
展示内容：
- 策略选择器（可切换 4 种策略并实时对比）：
  a. 固定大小分块 (Fixed Size)     - 按固定 token 数切
  b. 递归字符分块 (Recursive)      - 按段落→句子→字符递归
  c. 语义分块 (Semantic)           - 按嵌入相似度判断边界
  d. 文档结构分块 (Document-aware) - 按标题层级保持结构

- 分块结果对比面板：
  ┌──────────────┬──────────────┐
  │ 策略 A 结果    │ 策略 B 结果   │
  │ Chunk 1 [320t]│ Chunk 1 [580t]│
  │ Chunk 2 [320t]│ Chunk 2 [420t]│
  │ Chunk 3 [320t]│ Chunk 3 [610t]│
  │ ...           │ ...           │
  └──────────────┴──────────────┘

- 每个 chunk 卡片显示：
  · token 数量
  · 与前/后 chunk 的重叠区域（高亮）
  · 来源段落标记
  · 内容预览

- 参数调节面板：
  · chunk_size 滑块 (200 - 2000 tokens)
  · chunk_overlap 滑块 (0 - 500 tokens)
  · 分隔符选择
```

#### ④ 向量嵌入可视化

```
展示内容：
- 嵌入过程：每个 chunk → API 调用 → 向量（显示前几个维度的数值）
- 向量维度信息（火山引擎 Ark Embedding-3: 1024/2048 维）
- 2D/3D 向量空间投影（UMAP 降维）：
  · 每个点 = 一个 chunk
  · 颜色 = 来源文档
  · 鼠标悬停 = 预览 chunk 内容
  · 相近的点 = 语义相似的内容
- 相似度矩阵热力图（chunk 间两两相似度）
- API 调用统计（耗时、token 消耗、费用估算）
```

---

### 页面 2：知识库管理 `/knowledge`

```
┌──────────────────────────────────────────────────────┐
│  📚 知识库                                            │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────────────────────────────────────────┐    │
│  │ 知识库统计                                     │    │
│  │ 文档数: 12  │  Chunks: 348  │  向量维度: 1024  │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  ┌──────────────────────────────────────────────┐    │
│  │ 向量空间全局视图 (3D UMAP)                      │    │
│  │                                                │    │
│  │       ·  ·                                     │    │
│  │    ·    ·  ·    · ·                            │    │
│  │  ·  ·      ·  ·                                │    │
│  │       ·  ·   ·                                 │    │
│  │                                                │    │
│  │  🔴 文档A  🔵 文档B  🟢 文档C                    │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  文档列表                                             │
│  ┌────────────────────────────────────────────────┐  │
│  │ 📄 产品设计规范  │ 45 chunks │ 2026-03-16  [详情] │  │
│  │ 📄 API 接口文档  │ 32 chunks │ 2026-03-15  [详情] │  │
│  │ 📄 会议纪要合集  │ 28 chunks │ 2026-03-14  [详情] │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

---

### 页面 3：查询问答 + 流程追踪 `/query`（最核心页面）

**功能**：输入问题 → 可视化完整 RAG 链路 → 生成答案

```
┌──────────────────────────────────────────────────────────────┐
│  🔍 RAG 问答 & 流程追踪                                       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────┐         │
│  │ 提问: [_________________________________] [发送]  │         │
│  │                                                   │         │
│  │ 检索模式: (●)语义  ( )关键词  ( )混合              │         │
│  │ 查询增强: [✓]查询改写 [✓]HyDE [ ]Multi-Query      │         │
│  └─────────────────────────────────────────────────┘         │
│                                                              │
│  ┌─ 左: 流程追踪面板 ──────┬─ 右: 答案面板 ──────────┐        │
│  │                          │                          │        │
│  │  Pipeline Trace          │  💬 回答                  │        │
│  │                          │                          │        │
│  │  ┌──────────────┐       │  基于检索到的文档，...     │        │
│  │  │ 1.查询理解    │ 12ms  │                          │        │
│  │  │  原始: "..."  │       │  > 引用来源 1: 产品文档   │        │
│  │  │  改写: "..."  │       │  > 引用来源 2: API 文档   │        │
│  │  └──────┬───────┘       │                          │        │
│  │         ▼               │  ─────────────────────   │        │
│  │  ┌──────────────┐       │                          │        │
│  │  │ 2.向量化      │ 85ms  │  📊 答案质量指标          │        │
│  │  │  维度: 1024   │       │  相关性: ████████░░ 82%  │        │
│  │  │  [查看向量]    │       │  忠实度: █████████░ 91%  │        │
│  │  └──────┬───────┘       │  完整性: ███████░░░ 73%  │        │
│  │         ▼               │                          │        │
│  │  ┌──────────────┐       │                          │        │
│  │  │ 3.检索        │ 45ms  │                          │        │
│  │  │  命中: 8/348  │       │                          │        │
│  │  │  [查看结果]    │       │                          │        │
│  │  └──────┬───────┘       │                          │        │
│  │         ▼               │                          │        │
│  │  ┌──────────────┐       │                          │        │
│  │  │ 4.重排序      │ 120ms │                          │        │
│  │  │  Top-3 筛选   │       │                          │        │
│  │  │  [查看排序]    │       │                          │        │
│  │  └──────┬───────┘       │                          │        │
│  │         ▼               │                          │        │
│  │  ┌──────────────┐       │                          │        │
│  │  │ 5.Prompt构造  │ 2ms   │                          │        │
│  │  │  tokens: 2.4k │       │                          │        │
│  │  │  [查看Prompt]  │       │                          │        │
│  │  └──────┬───────┘       │                          │        │
│  │         ▼               │                          │        │
│  │  ┌──────────────┐       │                          │        │
│  │  │ 6.LLM生成     │ 1.2s  │                          │        │
│  │  │  Kimi K2.5    │       │                          │        │
│  │  │  [查看完整]    │       │                          │        │
│  │  └──────────────┘       │                          │        │
│  │                          │                          │        │
│  │  总耗时: 1.46s           │                          │        │
│  └──────────────────────────┴──────────────────────────┘        │
└──────────────────────────────────────────────────────────────┘
```

#### 每个追踪步骤的展开详情

**Step 1 - 查询理解**
```
- 原始问题
- 查询改写结果（LLM 改写后的问题，高亮差异）
- HyDE 假设文档（LLM 生成的"理想答案"，用于检索）
- Multi-Query 扩展（生成的多个子查询列表）
- 各策略的解释说明（为什么这样做、原理是什么）
```

**Step 2 - 向量化**
```
- 查询文本 → 向量的过程
- 向量数值预览（前 10 维）
- 向量空间中查询点的位置（在 3D 投影中高亮）
- API 调用详情（模型、耗时、token 数）
```

**Step 3 - 检索**
```
- 检索策略说明
- 候选结果列表（带相似度分数）
- 每个候选的来源文档、chunk 内容预览
- 向量空间中查询点与候选点的连线图
- 相似度分数分布图（柱状图）
- 如果是混合检索：分别展示向量分数和 BM25 分数，以及融合权重
```

**Step 4 - 重排序**
```
- 重排前 vs 重排后的排序对比（Sankey 图或排名变化动画）
- 重排序模型的打分详情
- 被过滤掉的候选（灰色显示）
- 最终 Top-K 结果
```

**Step 5 - Prompt 构造**
```
- 完整 Prompt 文本（语法高亮，区分 System/Context/Query 部分）
- Token 统计：System 占比 / Context 占比 / Query 占比（饼图）
- Context 中各 chunk 的来源标注
- Prompt 模板说明
```

**Step 6 - LLM 生成**
```
- 模型信息（Kimi K2.5 / Ark Agent Plan）
- 流式输出过程（逐字显示）
- 答案中引用来源的高亮标注
- Token 用量和费用估算
- 生成参数（temperature, top_p 等）
```

---

### 页面 4：策略实验室 `/lab`

**功能**：对比不同 RAG 策略的效果，辅助理解各技巧的作用

```
┌──────────────────────────────────────────────────────────┐
│  🧪 策略实验室                                            │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  选择实验类型:                                            │
│  [分块策略对比] [检索模式对比] [查询增强对比] [模型对比]     │
│                                                          │
│  ─── 示例：检索模式对比 ───                                │
│                                                          │
│  问题: [同一个问题_________________________]               │
│                                                          │
│  ┌──────────────┬──────────────┬──────────────┐          │
│  │  语义检索      │  关键词检索    │  混合检索     │          │
│  │              │              │              │          │
│  │ 1. doc3 0.92 │ 1. doc1 8.5  │ 1. doc3 0.89 │          │
│  │ 2. doc7 0.87 │ 2. doc3 7.2  │ 2. doc1 0.85 │          │
│  │ 3. doc1 0.84 │ 3. doc5 6.8  │ 3. doc7 0.82 │          │
│  │              │              │              │          │
│  │ 答案: ...    │ 答案: ...    │ 答案: ...    │          │
│  │              │              │              │          │
│  │ 相关性: 85%  │ 相关性: 72%  │ 相关性: 91%  │          │
│  └──────────────┴──────────────┴──────────────┘          │
│                                                          │
│  📊 综合对比图表                                          │
│  ┌──────────────────────────────────────────────┐        │
│  │  (雷达图: 相关性/忠实度/完整性/延迟/成本)       │        │
│  └──────────────────────────────────────────────┘        │
└──────────────────────────────────────────────────────────┘
```

---

## 四、RAG 技巧清单（教学展示点）

按 All-in-RAG 教程章节对应，标注在 Demo 中的展示位置：

### 数据准备阶段（第2章）

| 技巧 | 说明 | 展示位置 |
|------|------|----------|
| 多格式解析 | 飞书文档 → Markdown → 结构化文本 | 摄入工坊 ① |
| 元素类型识别 | 区分标题、段落、代码、表格、列表 | 摄入工坊 ② |
| 固定大小分块 | 按 token 数等分 | 摄入工坊 ③ / 实验室 |
| 递归字符分块 | 按分隔符层级递归切分 | 摄入工坊 ③ / 实验室 |
| 语义分块 | 用嵌入相似度检测语义边界 | 摄入工坊 ③ / 实验室 |
| 文档结构分块 | 按标题层级保持文档结构 | 摄入工坊 ③ / 实验室 |
| Chunk Overlap | 块间重叠，防止跨块信息丢失 | 摄入工坊 ③（高亮重叠区） |
| 元数据附加 | 每个 chunk 携带来源、标题、页码 | 摄入工坊 ③ chunk 卡片 |

### 索引构建阶段（第3章）

| 技巧 | 说明 | 展示位置 |
|------|------|----------|
| 向量嵌入 | 文本 → 高维向量 | 摄入工坊 ④ |
| 嵌入空间可视化 | UMAP 降维投影到 2D/3D | 摄入工坊 ④ / 知识库页 |
| 相似度矩阵 | chunk 间语义相似度热力图 | 摄入工坊 ④ |
| 维度选择对比 | 256 vs 512 vs 1024 vs 2048 维 | 实验室 |
| pgvector 索引 | IVFFlat vs HNSW 索引类型 | 知识库页统计面板 |

### 检索优化阶段（第4章）

| 技巧 | 说明 | 展示位置 |
|------|------|----------|
| 语义检索 | 向量余弦相似度搜索 | 查询页 Step 3 / 实验室 |
| 关键词检索 | Postgres 全文搜索 (BM25) | 查询页 Step 3 / 实验室 |
| 混合检索 | 向量 + 关键词加权融合 | 查询页 Step 3 / 实验室 |
| 查询改写 | LLM 优化用户问题表述 | 查询页 Step 1 |
| HyDE | 生成假设答案用于检索 | 查询页 Step 1 |
| Multi-Query | 生成多个子查询合并结果 | 查询页 Step 1 |
| Reranking | 交叉编码器重排序候选结果 | 查询页 Step 4 |
| 相似度阈值过滤 | 过滤低分候选 | 查询页 Step 3 |

### 生成阶段（第5章）

| 技巧 | 说明 | 展示位置 |
|------|------|----------|
| Context 注入 | 将检索结果拼入 Prompt | 查询页 Step 5 |
| Prompt 模板 | System + Context + Query 结构 | 查询页 Step 5 |
| 流式输出 | 逐 token 生成并实时渲染 | 查询页答案面板 |
| 来源引用 | 答案中标注引用来源 | 查询页答案面板 |
| 模型切换 | Kimi vs Ark 对比 | 实验室 |

### 评估阶段（第6章）

| 技巧 | 说明 | 展示位置 |
|------|------|----------|
| 检索相关性 | 检索结果与问题的相关度 | 查询页质量指标 |
| 答案忠实度 | 答案是否基于检索内容（非幻觉）| 查询页质量指标 |
| 答案完整性 | 答案是否覆盖了问题的各方面 | 查询页质量指标 |
| 延迟统计 | 各步骤耗时分析 | 查询页追踪面板 |
| 成本估算 | API 调用费用统计 | 查询页追踪面板 |

---

## 五、飞书文档集成

### 使用飞书开放平台 SDK

```typescript
// @larksuiteoapi/node-sdk
import * as lark from '@larksuiteoapi/node-sdk';

const client = new lark.Client({
  appId: process.env.FEISHU_APP_ID,
  appSecret: process.env.FEISHU_APP_SECRET,
});
```

### 文档导入流程

```
用户粘贴飞书文档链接
  ↓
解析链接提取 document_id
  (https://xxx.feishu.cn/docx/XXXXXX → XXXXXX)
  ↓
调用飞书 API 获取文档内容
  GET /open-apis/docx/v1/documents/:document_id/raw_content
  ↓
获取文档元数据
  GET /open-apis/docx/v1/documents/:document_id
  ↓
转换为 Markdown 格式
  ↓
进入摄入流水线（分块 → 嵌入 → 存储）
```

### 支持的文档类型

| 类型 | 飞书 API | 说明 |
|------|----------|------|
| 文档 (docx) | `/docx/v1/documents` | 新版飞书文档，富文本 |
| 旧版文档 (doc) | `/doc/v2` | 旧版文档格式 |
| 知识库 wiki | `/wiki/v2/spaces` | 飞书知识库，可批量导入 |

### 前端交互

```
┌─────────────────────────────────────────┐
│  导入飞书文档                             │
│                                         │
│  方式 1：单文档链接                       │
│  [飞书文档链接_________________] [导入]   │
│                                         │
│  方式 2：知识库批量导入                    │
│  [飞书知识库链接_______________] [扫描]   │
│  发现 15 篇文档：                        │
│  ☑ 产品需求文档        2026-03-15       │
│  ☑ API 设计规范        2026-03-14       │
│  ☐ 会议纪要 (已导入)    2026-03-10       │
│                        [批量导入选中]     │
└─────────────────────────────────────────┘
```

---

## 六、项目结构

```
rag-learning-demo/
├── app/                              # Next.js App Router
│   ├── layout.tsx                    # 全局布局（侧边导航）
│   ├── page.tsx                      # 首页 Dashboard
│   ├── ingest/
│   │   └── page.tsx                  # 📥 文档摄入工坊
│   ├── knowledge/
│   │   └── page.tsx                  # 📚 知识库管理
│   ├── query/
│   │   └── page.tsx                  # 🔍 查询问答 + 流程追踪
│   ├── lab/
│   │   └── page.tsx                  # 🧪 策略实验室
│   └── api/
│       └── rag/
│           ├── ingest/
│           │   └── route.ts          # 文档摄入 API
│           ├── query/
│           │   └── route.ts          # RAG 查询 API（含 trace 数据）
│           ├── search/
│           │   └── route.ts          # 向量搜索 API
│           ├── feishu/
│           │   └── route.ts          # 飞书文档获取 API
│           ├── embed/
│           │   └── route.ts          # 嵌入生成 API
│           ├── chunk/
│           │   └── route.ts          # 分块预览 API（支持多策略）
│           └── collections/
│               └── route.ts          # 知识库管理 API
│
├── lib/                              # 核心逻辑
│   ├── rag/
│   │   ├── chunkers/                 # 分块策略
│   │   │   ├── fixed-size.ts         # 固定大小分块
│   │   │   ├── recursive.ts          # 递归字符分块
│   │   │   ├── semantic.ts           # 语义分块
│   │   │   └── document-aware.ts     # 文档结构分块
│   │   ├── retrievers/               # 检索策略
│   │   │   ├── semantic.ts           # 语义检索
│   │   │   ├── keyword.ts            # 关键词检索
│   │   │   └── hybrid.ts             # 混合检索
│   │   ├── query-enhancers/          # 查询增强
│   │   │   ├── rewriter.ts           # 查询改写
│   │   │   ├── hyde.ts               # HyDE
│   │   │   └── multi-query.ts        # Multi-Query
│   │   ├── reranker.ts               # 重排序
│   │   ├── generator.ts              # LLM 答案生成
│   │   ├── evaluator.ts              # 质量评估
│   │   └── tracer.ts                 # 流程追踪（收集各步骤的中间数据）
│   ├── feishu/
│   │   ├── client.ts                 # 飞书 API 客户端
│   │   ├── parser.ts                 # 文档解析器
│   │   └── link-resolver.ts          # 链接解析
│   ├── embedding/
│   │   └── ark.ts                  # 火山引擎 Ark Embedding-3 封装
│   ├── llm/
│   │   ├── kimi.ts                   # Kimi 模型配置
│   │   └── ark.ts                    # Ark 模型配置
│   └── supabase/
│       ├── client.ts                 # Supabase 客户端
│       ├── vectors.ts                # pgvector 操作封装
│       └── migrations/               # 数据库迁移
│           └── 001_create_tables.sql
│
├── components/                       # 可视化组件
│   ├── pipeline/
│   │   ├── PipelineFlow.tsx          # 流水线流程图（React Flow）
│   │   ├── StepCard.tsx              # 步骤卡片
│   │   └── StepDetail.tsx            # 步骤详情展开面板
│   ├── chunks/
│   │   ├── ChunkCard.tsx             # 分块卡片（显示内容/token/重叠）
│   │   ├── ChunkComparison.tsx       # 分块策略对比面板
│   │   └── ChunkOverlapHighlight.tsx # 重叠区域高亮
│   ├── vectors/
│   │   ├── EmbeddingSpace3D.tsx      # 3D 向量空间可视化（Three.js + UMAP）
│   │   ├── SimilarityHeatmap.tsx     # 相似度矩阵热力图
│   │   └── VectorPreview.tsx         # 向量数值预览
│   ├── retrieval/
│   │   ├── RetrievalResults.tsx      # 检索结果列表
│   │   ├── ScoreDistribution.tsx     # 相似度分数分布图
│   │   └── RerankComparison.tsx      # 重排序前后对比
│   ├── generation/
│   │   ├── PromptViewer.tsx          # Prompt 结构查看器
│   │   ├── StreamingAnswer.tsx       # 流式答案显示
│   │   └── SourceAttribution.tsx     # 来源引用标注
│   ├── trace/
│   │   ├── TraceTimeline.tsx         # 执行时间线
│   │   ├── TracePanel.tsx            # 追踪面板（左侧）
│   │   └── CostEstimator.tsx         # 费用估算
│   └── lab/
│       ├── StrategyCompare.tsx       # 策略对比面板
│       └── RadarChart.tsx            # 多维度雷达图
│
├── supabase/
│   └── migrations/
│       └── 20260316_init.sql         # 初始化 SQL（表 + pgvector + 函数）
│
└── package.json
```

---

## 七、数据库设计 (Supabase)

```sql
-- 启用 pgvector 扩展
create extension if not exists vector;

-- 知识库集合
create table collections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  chunk_strategy text default 'recursive',  -- 使用的分块策略
  chunk_size int default 500,
  chunk_overlap int default 50,
  embedding_model text default 'doubao-embedding-vision-251215',
  embedding_dimensions int default 1024,
  created_at timestamptz default now()
);

-- 文档
create table documents (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid references collections(id) on delete cascade,
  title text not null,
  source_url text,                -- 飞书文档链接
  source_type text default 'feishu',
  raw_content text,               -- 原始内容
  metadata jsonb default '{}',    -- 飞书元数据（作者、时间等）
  token_count int,
  created_at timestamptz default now()
);

-- 文档块
create table chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) on delete cascade,
  collection_id uuid references collections(id) on delete cascade,
  content text not null,
  embedding vector(1024),         -- 火山引擎 Ark Embedding-3 向量
  chunk_index int,                -- 在文档中的序号
  token_count int,
  metadata jsonb default '{}',    -- 来源段落、标题层级等
  created_at timestamptz default now()
);

-- 向量相似度搜索函数
create or replace function match_chunks(
  query_embedding vector(1024),
  match_count int default 5,
  filter_collection_id uuid default null
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql as $$
begin
  return query
  select
    chunks.id,
    chunks.document_id,
    chunks.content,
    chunks.metadata,
    1 - (chunks.embedding <=> query_embedding) as similarity
  from chunks
  where (filter_collection_id is null or chunks.collection_id = filter_collection_id)
  order by chunks.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- 全文搜索索引
alter table chunks add column fts tsvector
  generated always as (to_tsvector('chinese', content)) stored;
create index chunks_fts_idx on chunks using gin(fts);

-- 向量索引 (HNSW, pgvector 推荐)
create index chunks_embedding_idx on chunks
  using hnsw (embedding vector_cosine_ops);

-- 查询追踪记录（保存每次查询的完整 trace）
create table query_traces (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  config jsonb,                   -- 查询配置（模式、增强策略等）
  trace jsonb,                    -- 完整追踪数据（各步骤中间结果）
  answer text,
  sources jsonb,
  total_duration_ms int,
  total_tokens int,
  estimated_cost float,
  created_at timestamptz default now()
);
```

---

## 八、Tracer 设计（流程追踪核心）

每次 RAG 查询都生成一个完整的 trace 对象，返回给前端用于可视化：

```typescript
interface RAGTrace {
  id: string;
  question: string;
  timestamp: string;
  totalDurationMs: number;

  steps: {
    // Step 1: 查询理解
    queryUnderstanding: {
      durationMs: number;
      original: string;
      rewritten?: string;          // 查询改写结果
      hydeDocument?: string;       // HyDE 生成的假设文档
      subQueries?: string[];       // Multi-Query 子查询
      activeStrategies: string[];  // 启用了哪些增强策略
    };

    // Step 2: 向量化
    embedding: {
      durationMs: number;
      model: string;
      dimensions: number;
      vector: number[];            // 查询向量（完整）
      vectorPreview: number[];     // 前 10 维（前端展示）
      tokensUsed: number;
    };

    // Step 3: 检索
    retrieval: {
      durationMs: number;
      mode: 'semantic' | 'keyword' | 'hybrid';
      totalCandidates: number;     // 数据库中总 chunk 数
      retrieved: number;           // 检索到的数量
      results: Array<{
        chunkId: string;
        content: string;
        score: number;
        scoreType: 'cosine' | 'bm25' | 'hybrid';
        documentTitle: string;
        metadata: object;
        // 混合检索时：
        vectorScore?: number;
        keywordScore?: number;
      }>;
      hybridWeights?: { vector: number; keyword: number };
    };

    // Step 4: 重排序
    reranking?: {
      durationMs: number;
      model: string;
      before: Array<{ chunkId: string; score: number; rank: number }>;
      after: Array<{ chunkId: string; score: number; rank: number }>;
      filtered: string[];          // 被过滤掉的 chunk IDs
    };

    // Step 5: Prompt 构造
    promptConstruction: {
      durationMs: number;
      template: string;            // 使用的模板名
      systemPrompt: string;
      contextChunks: Array<{ chunkId: string; content: string; source: string }>;
      fullPrompt: string;          // 完整 prompt
      tokenBreakdown: {
        system: number;
        context: number;
        query: number;
        total: number;
      };
    };

    // Step 6: LLM 生成
    generation: {
      durationMs: number;
      model: string;
      answer: string;
      tokensUsed: { prompt: number; completion: number; total: number };
      sources: Array<{ chunkId: string; documentTitle: string; relevance: string }>;
      estimatedCost: number;
    };
  };

  // 质量评估（可选，需要额外 LLM 调用）
  evaluation?: {
    relevance: number;    // 0-100
    faithfulness: number; // 0-100
    completeness: number; // 0-100
  };
}
```

---

## 九、实施路线（调整后）

```
Phase 1 - 骨架搭建
├── Next.js 项目初始化 + Tailwind + shadcn/ui
├── Supabase 项目创建 + pgvector 启用 + 表结构迁移
├── 飞书应用创建 + SDK 集成
├── 火山引擎 Ark Embedding-3 + Kimi/Ark 模型接入
└── 基础页面路由 + 布局

Phase 2 - 摄入流水线 + 可视化
├── 飞书文档链接解析 + 内容获取
├── 4 种分块策略实现
├── 分块对比可视化组件
├── 嵌入生成 + pgvector 存储
├── 嵌入空间 2D/3D 可视化（UMAP）
└── 摄入工坊页面完成

Phase 3 - 查询链路 + 流程追踪
├── 3 种检索模式实现（语义/关键词/混合）
├── 查询增强实现（改写/HyDE/Multi-Query）
├── Tracer 中间数据收集
├── 流程追踪面板组件
├── 流式答案生成
└── 查询页面完成

Phase 4 - 实验室 + 评估
├── 策略对比面板
├── 质量评估指标计算
├── 知识库管理页面
└── 全局 Dashboard
```

---

## 参考资料

- [Unravel: RAG 可视化学习工具](https://dev.to/jvorndran/building-unravel-learning-rag-through-visualization-26o)
- [Visualizing RAG: Chunking, Embeddings, and Generation](https://medium.com/@lvjanakiram/visualizing-rag-building-a-hands-on-tool-to-understand-chunking-embeddings-and-generation-51621e4b78df)
- [RAGxplorer: Visualising Chunks in Embedding Space](https://community.openai.com/t/ragxplorer-visualising-document-chunks-in-the-embedding-space/594837)
- [All-in-RAG 教程](https://github.com/datawhalechina/all-in-rag)
- [飞书开放平台 Server SDK](https://open.feishu.cn/document/server-docs/server-side-sdk)
- [Supabase pgvector 文档](https://supabase.com/docs/guides/database/extensions/pgvector)
- [火山引擎 Ark Embedding-3 文档](https://www.volcengine.com/docs/82379/1966993)
- [Vercel AI SDK Moonshot Provider](https://ai-sdk.dev/providers/ai-sdk-providers/moonshotai)
- [AI SDK OpenAI Compatible Provider](https://ai-sdk.dev/providers/openai-compatible-providers)
- [OpenRAG: 教育型 RAG 平台](https://www.opensourceprojects.dev/post/bd7835df-5561-42e1-ba24-b9225e80482f)
