# RAG Competition Championship Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Glass Box RAG from a solid educational demo into a competition-winning platform by adding state-of-the-art RAG techniques, quantitative benchmarks, and a polished interactive demo flow.

**Architecture:** Layer advanced RAG strategies (Contextual Retrieval, Self-RAG, CRAG, Adaptive Routing, Graph RAG) on top of the existing pipeline. Each technique is a pluggable module with full trace visualization. A new Benchmark page provides quantitative comparison. A guided Demo Mode walks judges through capabilities.

**Tech Stack:** Next.js 16 + TypeScript, Volcengine Ark Ark Agent Plan + Embedding-3, Supabase pgvector, existing glass-box trace infrastructure.

---

## Current State Assessment

### What We Already Have (Strengths)
1. **Glass Box Visualization** - Full pipeline trace with per-step timing (UNIQUE differentiator)
2. **4 Chunking Strategies** - Fixed-size, Recursive, Semantic, Document-aware
3. **3 Retrieval Modes** - Semantic (cosine), Keyword (BM25), Hybrid (RRF)
4. **3 Query Enhancers** - Rewrite, HyDE, Multi-Query
5. **LLM Reranking** - Ark-based relevance scoring with filtering
6. **3-Metric Evaluation** - Relevance, Faithfulness, Completeness
7. **Lab Page** - A/B strategy comparison with radar charts
8. **One-Click Demo** - Sample documents + preset questions

### Critical Gaps vs Competition-Winning RAG
| Gap | Impact | Priority |
|-----|--------|----------|
| No Contextual Retrieval (Anthropic technique) | High - 35% retrieval improvement | P0 |
| No Adaptive Query Routing | High - routes simple/complex queries differently | P0 |
| No Self-RAG / CRAG | High - self-correcting generation | P0 |
| No citation/grounding in answers | High - judges expect inline citations | P0 |
| Dashboard uses mock data | Medium - looks fake to judges | P0 |
| No benchmark evaluation suite | High - cannot prove quality quantitatively | P1 |
| No Parent-Child chunk retrieval | Medium - improves context completeness | P1 |
| No Sentence Window expansion | Medium - expands matched chunks with context | P1 |
| No Graph RAG | Medium - entity-relationship retrieval | P2 |
| No Multi-Agent orchestration | Medium - impressive but complex | P2 |
| No guided demo mode for judges | High - first impression matters | P0 |

---

## Championship Strategy: 4 Phases

### PHASE 1: Core RAG Quality (Critical - Without This We Lose)
**Goal**: Implement techniques that directly improve retrieval and generation quality.

### PHASE 2: Advanced Self-Correcting RAG (Differentiator)
**Goal**: Add Self-RAG and CRAG for self-reflective, self-correcting generation.

### PHASE 3: Benchmark and Proof (Evidence)
**Goal**: Quantitative proof that our techniques work, with visual comparisons.

### PHASE 4: Demo Polish and Wow Factor (First Impression)
**Goal**: Guided demo mode, live comparison, judge-friendly flow.

---

## Chunk 1: PHASE 1 - Core RAG Quality

### Task 1: Contextual Retrieval (Anthropic Technique)

**Why**: Anthropic research shows adding document context to each chunk improves retrieval by approximately 35%. Instead of storing raw chunks, we prepend a short LLM-generated context that explains where the chunk fits in the document.

**Files:**
- Create: `web/src/lib/rag/chunkers/contextual.ts`
- Create: `web/src/lib/rag/context-generator.ts`
- Modify: `web/src/app/api/rag/chunk/route.ts` - add 'contextual' strategy
- Modify: `web/src/app/api/rag/ingest/route.ts` - support contextual chunking
- Modify: `web/src/app/lab/page.tsx` - add contextual to strategy options

- [ ] **Step 1: Create context generator module**

Create `web/src/lib/rag/context-generator.ts`:
- Import `generateText` from `ai` and `arkModel` from `@/lib/llm/ark`
- Export function generateChunkContext(fullDocument: string, chunk: string): Promise<string>
- System prompt: instruct model to describe chunk's position and topic within the full document in under 100 chars
- Truncate document to first 6000 chars to manage tokens
- Temperature 0.1, maxTokens 150

- [ ] **Step 2: Create contextual chunker**

Create `web/src/lib/rag/chunkers/contextual.ts`:
- Use recursive splitter as base chunking
- For each chunk, call generateChunkContext to get context prefix
- Prepend "[context] {context}\n\n{chunk}" format
- Store contextPrefix in metadata
- Process in batches of 3 for concurrency control

- [ ] **Step 3: Register in chunk API and ingest API**

Add 'contextual' to the supported strategies in both `/api/rag/chunk/route.ts` and `/api/rag/ingest/route.ts`.

- [ ] **Step 4: Add to Lab page strategy options**

Add "contextual" as a chunking strategy option in lab page.

- [ ] **Step 5: Test with sample documents and commit**

---

### Task 2: Adaptive Query Router

**Why**: Not all queries need the same RAG pipeline. Simple factual questions need fast retrieval; complex analytical questions need multi-query + reranking; some queries don't need RAG at all. An adaptive router improves both quality and speed.

**Files:**
- Create: `web/src/lib/rag/query-router.ts`
- Modify: `web/src/app/api/rag/query/route.ts` - integrate router
- Modify: `web/src/app/query/page.tsx` - show routing decision in UI

- [ ] **Step 1: Create query router**

Create `web/src/lib/rag/query-router.ts`:
- Use generateObject with zod schema
- Route types: 'simple', 'analytical', 'comparison', 'no_rag'
- Output: type, reasoning, suggestedEnhancers, suggestedRetrieval mode, suggestedTopK, needsReranking
- Simple: semantic search, topK=3, no rerank
- Analytical: HyDE + multi-query, topK=8, rerank
- Comparison: multi-query, hybrid, topK=10, rerank
- no_rag: direct LLM answer without retrieval

- [ ] **Step 2: Integrate router into query API**

In `/api/rag/query/route.ts`, add router as the first pipeline step. When mode is 'auto' (new default), use router's suggestions. Log routing decision in trace.

- [ ] **Step 3: Add 'auto' mode to query page UI**

Add "Auto (smart routing)" as default mode option. Show routing decision in trace panel with reasoning.

- [ ] **Step 4: Commit**

---

### Task 3: Citation Grounding in Answers

**Why**: Competition judges expect answers to include inline citations like [1][2] that reference specific source chunks. This proves the answer is grounded in retrieved evidence, not hallucinated.

**Files:**
- Create: `web/src/lib/rag/citation-generator.ts`
- Modify: `web/src/app/api/rag/query/route.ts` - modify system prompt for citations
- Modify: `web/src/app/query/page.tsx` - render clickable citations

- [ ] **Step 1: Modify generation prompt to include citations**

Update the system prompt in the query API to instruct the model to use [1], [2] style inline citations referencing the provided context chunks. Number each context chunk in the prompt.

- [ ] **Step 2: Create citation parser for frontend**

Create `web/src/lib/rag/citation-generator.ts`:
- Export parseCitations(text): splits text into {type: 'text'|'citation', content, index?} segments
- Use regex /\[(\d+)\]/g to detect citations

- [ ] **Step 3: Render clickable citation badges in answer**

In the query page's StreamingAnswer section, parse the streamed text and render [N] as clickable badges that highlight the corresponding source in the SourceAttribution panel.

- [ ] **Step 4: Commit**

---

### Task 4: Sentence Window Retrieval (Chunk Expansion)

**Why**: When a small chunk matches, the surrounding context is often needed for a complete answer. Sentence Window retrieval stores small chunks for precise matching but expands to larger windows for generation.

**Files:**
- Create: `web/src/lib/rag/retrievers/sentence-window.ts`
- Modify: `web/src/app/api/rag/query/route.ts` - add sentence-window retrieval option
- Modify: `web/src/lib/supabase/vectors.ts` - add function to fetch neighboring chunks

- [ ] **Step 1: Add neighbor chunk fetching to vectors.ts**

Add getChunkNeighbors function:
- Fetch target chunk's chunk_index from Supabase
- Fetch surrounding chunks within windowSize range from same document
- Return ordered by chunk_index

- [ ] **Step 2: Create sentence window retriever**

Create `web/src/lib/rag/retrievers/sentence-window.ts`:
- First retrieve using standard semantic search (precise matching on small chunks)
- Then expand each result by fetching neighboring chunks
- Concatenate neighbor content for generation context
- Store originalContent in metadata

- [ ] **Step 3: Integrate into query API as retrieval option and commit**

---

### Task 5: Parent-Child Chunk Retrieval

**Why**: Store documents at two granularities. Small "child" chunks for precise matching, large "parent" chunks for complete context. Retrieve on children, return parents.

**Files:**
- Create: `web/src/lib/rag/chunkers/parent-child.ts`
- Create: `web/src/lib/rag/retrievers/parent-child.ts`
- Modify: `web/src/lib/supabase/vectors.ts` - add parent_chunk_id support

- [ ] **Step 1: Create parent-child chunker**

Create `web/src/lib/rag/chunkers/parent-child.ts`:
- Use recursive splitter with large parentChunkSize (1500) and small childChunkSize (300)
- Create parent chunks first, then sub-chunk each parent into children
- Return structure linking children to parents

- [ ] **Step 2: Create parent-child retriever**

Retrieve matching children via vector search, then fetch and return the full parent chunks for generation context.

- [ ] **Step 3: Add chunk_index and parent_chunk_id to chunks table**

Migration to add: chunk_index integer, parent_chunk_id uuid nullable.

- [ ] **Step 4: Commit**

---

### Task 6: Fix Dashboard Mock Data

**Why**: Judges will immediately notice fake data. Replace all hardcoded mock values with real Supabase queries.

**Files:**
- Modify: `web/src/app/page.tsx` - replace mock recent queries with real data
- Modify: `web/src/app/knowledge/page.tsx` - replace mock document list with real data

- [ ] **Step 1: Replace dashboard mock queries with real query_traces**

Fetch last 5 entries from query_traces table in Supabase. Display actual question, answer preview, mode, duration.

- [ ] **Step 2: Replace knowledge page mock documents with real data**

Query documents table joined with chunks for actual stats.

- [ ] **Step 3: Commit**

---

## Chunk 2: PHASE 2 - Advanced Self-Correcting RAG

### Task 7: Corrective RAG (CRAG)

**Why**: CRAG evaluates retrieved documents before generation. If retrieval quality is low, it triggers a corrective step: either refining the query or doing web search as fallback. This prevents garbage-in-garbage-out.

**Files:**
- Create: `web/src/lib/rag/corrective-rag.ts`
- Modify: `web/src/app/api/rag/query/route.ts` - integrate CRAG step

- [ ] **Step 1: Create CRAG evaluator**

Create `web/src/lib/rag/corrective-rag.ts`:
- Use generateObject with zod schema
- Assess retrieval quality: correct (>0.7), ambiguous (0.4-0.7), incorrect (<0.4)
- Output: decision, reasoning, suggestedRefinement (optional), filteredChunks
- For incorrect: suggest query refinement
- For ambiguous: filter low-quality chunks and suggest refinement

- [ ] **Step 2: Integrate CRAG into query pipeline**

After retrieval step, add CRAG assessment. If 'incorrect', retry with refined query. If 'ambiguous', merge original + refined results. Log decision in trace.

- [ ] **Step 3: Show CRAG decision in trace panel**

Add a "Retrieval Assessment" step to the trace visualization with traffic-light indicator (green/yellow/red).

- [ ] **Step 4: Commit**

---

### Task 8: Self-RAG (Self-Reflective Generation)

**Why**: Self-RAG adds reflection tokens during generation. After generating, the model evaluates whether the answer is faithful to sources and whether it should revise.

**Files:**
- Create: `web/src/lib/rag/self-rag.ts`
- Modify: `web/src/app/api/rag/query/route.ts` - add self-rag generation option

- [ ] **Step 1: Create Self-RAG generator**

Create `web/src/lib/rag/self-rag.ts`:
- Generate initial answer with citation instructions
- Split answer into paragraphs
- For each paragraph, use generateObject to assess: isRelevant, isSupported, isComplete, needsMoreRetrieval
- If unsupported paragraphs found and additional retrieval available, regenerate with expanded context
- Return: answer, reflections array, additionalRetrievals count
- Max 2 additional retrieval rounds

- [ ] **Step 2: Integrate Self-RAG as generation option in query API**

Add selfRag boolean to query API body. When enabled, use selfRAGGenerate instead of direct streamText. Include reflections in trace.

- [ ] **Step 3: Visualize reflections in trace panel**

Show each paragraph's reflection assessment (supported/relevant/complete) with colored indicators.

- [ ] **Step 4: Commit**

---

### Task 9: Query Decomposition for Complex Questions

**Why**: Complex multi-part questions benefit from being decomposed into sub-questions, each answered independently, then synthesized.

**Files:**
- Create: `web/src/lib/rag/query-decomposer.ts`
- Modify: `web/src/app/api/rag/query/route.ts` - integrate decomposition

- [ ] **Step 1: Create query decomposer**

Create `web/src/lib/rag/query-decomposer.ts`:
- Use generateObject with zod schema
- Output: isComplex, subQuestions array (with dependency tracking), synthesisStrategy (merge/compare/sequential)
- Simple questions: isComplex=false, single subQuestion
- Complex questions: 2-4 sub-questions with dependency order

- [ ] **Step 2: Integrate decomposition into query API**

For complex queries: decompose then answer each sub-question independently then synthesize final answer. Show sub-question pipeline in trace.

- [ ] **Step 3: Commit**

---

## Chunk 3: PHASE 3 - Benchmark and Proof

### Task 10: Evaluation Benchmark Suite

**Why**: Judges need quantitative proof. Create a benchmark page that runs standard RAG evaluation metrics across different configurations and shows comparative results.

**Files:**
- Create: `web/src/lib/rag/benchmark.ts` - benchmark runner
- Create: `web/src/lib/rag/benchmark-datasets.ts` - curated Q&A pairs with ground truth
- Create: `web/src/app/benchmark/page.tsx` - benchmark dashboard
- Create: `web/src/app/api/rag/benchmark/route.ts` - benchmark API

- [ ] **Step 1: Create benchmark dataset**

Create `web/src/lib/rag/benchmark-datasets.ts`:
- 10-15 curated Q&A pairs with ground truth answers
- Categories: factual, analytical, comparison, multi-hop
- Difficulty levels: easy, medium, hard
- Each item has: question, groundTruth, relevantChunkKeywords, category, difficulty

- [ ] **Step 2: Create benchmark runner**

Create `web/src/lib/rag/benchmark.ts`:
- BenchmarkConfig: chunkStrategy, retrievalMode, enhancers, rerank, selfRag, topK
- BenchmarkResult: aggregated metrics (avgRelevance, avgFaithfulness, avgCompleteness, retrievalPrecision, retrievalRecall, avgLatency, avgTokens, avgCost)
- Per-question breakdown with individual scores

- [ ] **Step 3: Create benchmark API endpoint**

POST `/api/rag/benchmark` - accepts config, runs all benchmark questions, returns aggregated metrics.

- [ ] **Step 4: Create benchmark dashboard page**

Visual page with:
- Config selector (strategy, retrieval mode, enhancers)
- "Run Benchmark" button
- Results table with per-question breakdown
- Radar chart comparing configs
- Bar charts for each metric

- [ ] **Step 5: Commit**

---

### Task 11: Knowledge Graph Visualization

**Why**: Show entity relationships extracted from documents. Even a simple entity co-occurrence graph adds visual impact and demonstrates document understanding.

**Files:**
- Create: `web/src/lib/rag/entity-extractor.ts`
- Create: `web/src/app/api/rag/entities/route.ts`
- Modify: `web/src/app/knowledge/page.tsx` - add entity graph tab

- [ ] **Step 1: Create entity extractor**

Use Ark to extract named entities and relationships from chunks. Store as simple JSON graph structure.

- [ ] **Step 2: Create entity API**

GET `/api/rag/entities?collection_id=X` - returns entity graph for a collection.

- [ ] **Step 3: Add graph visualization to knowledge page**

Use a force-directed graph (canvas/SVG) to show entity relationships. Nodes = entities, edges = co-occurrence in same chunk.

- [ ] **Step 4: Commit**

---

## Chunk 4: PHASE 4 - Demo Polish and Wow Factor

### Task 12: Guided Demo Mode

**Why**: First impression is everything for judges. Create a guided walkthrough that demonstrates each feature systematically.

**Files:**
- Create: `web/src/components/demo-mode.tsx` - guided tour overlay
- Create: `web/src/lib/demo-steps.ts` - demo script
- Modify: `web/src/app/page.tsx` - add "Start Demo" button

- [ ] **Step 1: Create demo script with steps**

Create `web/src/lib/demo-steps.ts`:
- Step sequence: Welcome -> Ingest (auto-import) -> Knowledge (visualize) -> Simple Query -> Complex Query (Self-RAG) -> Lab (strategy comparison) -> Benchmark (quantitative proof)
- Each step: id, title, description, page, action (optional auto-trigger)

- [ ] **Step 2: Create demo mode overlay component**

Floating panel with step navigation (prev/next), auto-navigation between pages, auto-triggering actions, and progress indicator.

- [ ] **Step 3: Add "Start Demo" button to dashboard and commit**

---

### Task 13: Enhanced Trace Visualization

**Why**: The trace panel is our core differentiator. Make it visually stunning.

**Files:**
- Modify: `web/src/app/query/page.tsx` - enhanced trace rendering
- Create: `web/src/components/rag/pipeline-diagram.tsx` - animated pipeline flow

- [ ] **Step 1: Create animated pipeline diagram**

Visual flowchart: Query -> [Router] -> [Enhancers] -> [Embedding] -> [Retrieval] -> [CRAG] -> [Reranking] -> [Self-RAG] -> [Evaluation]. Each node lights up as the pipeline progresses.

- [ ] **Step 2: Add timing waterfall chart**

Show each pipeline step's duration as a horizontal bar, similar to browser DevTools network waterfall.

- [ ] **Step 3: Add token flow visualization and commit**

---

### Task 14: Strategy Technique Catalog Page

**Why**: Show judges we understand the RAG landscape. Create a reference page cataloging all implemented techniques.

**Files:**
- Create: `web/src/app/techniques/page.tsx` - technique catalog

- [ ] **Step 1: Create technique catalog page**

Beautiful grid layout showing all RAG techniques:
- Each card: technique name, category tag, brief description, "Try it" link
- Categories: Chunking, Retrieval, Enhancement, Generation, Evaluation
- Status badges for each implemented technique
- Total count header

- [ ] **Step 2: Add to navigation and commit**

---

## Priority Execution Order

For maximum competition impact, execute in this order:

### Must-Have (Without these, we don't compete):
1. **Task 6**: Fix mock data - credibility
2. **Task 3**: Citation grounding - judges expect this
3. **Task 2**: Adaptive query router - smart pipeline
4. **Task 1**: Contextual retrieval - proven quality boost
5. **Task 7**: CRAG - self-correcting retrieval

### Should-Have (These win the competition):
6. **Task 8**: Self-RAG - unique differentiator
7. **Task 10**: Benchmark suite - quantitative proof
8. **Task 12**: Guided demo mode - judge experience
9. **Task 4**: Sentence window - context completeness
10. **Task 13**: Enhanced trace viz - wow factor

### Nice-to-Have (Cherry on top):
11. **Task 5**: Parent-child chunks - advanced technique
12. **Task 9**: Query decomposition - complex query handling
13. **Task 11**: Knowledge graph - visual impact
14. **Task 14**: Technique catalog - comprehensiveness

---

## Success Criteria

After implementing this plan, Glass Box RAG should demonstrate:

1. **12+ distinct RAG techniques** (vs typical 3-4 in competitors)
2. **Quantitative benchmarks** proving each technique's value
3. **Full pipeline transparency** with animated visualization
4. **Self-correcting generation** (CRAG + Self-RAG)
5. **Intelligent query routing** adapting to question complexity
6. **Inline citations** grounding every answer in sources
7. **Guided demo flow** for perfect judge presentation
8. **Real data everywhere** - no mock values

The combination of educational visualization + state-of-the-art techniques + quantitative proof is what wins.
