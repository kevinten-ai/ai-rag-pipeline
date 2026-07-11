"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { StrategyCompare, type CompareResult } from "@/components/lab/StrategyCompare";
import { RadarChart } from "@/components/lab/RadarChart";
import { FlaskConical, Play, Loader2 } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StrategyOption {
  id: string;
  label: string;
  description?: string;
}

interface ExperimentState {
  question: string;
  selected: Set<string>;
  results: CompareResult[];
  isLoading: boolean;
}

// ---------------------------------------------------------------------------
// Constants per tab
// ---------------------------------------------------------------------------

const CHUNKING_STRATEGIES: StrategyOption[] = [
  { id: "fixed-size", label: "固定大小", description: "按固定 token 数分块" },
  { id: "recursive", label: "递归字符", description: "按分隔符递归切分" },
  { id: "semantic", label: "语义分块", description: "按语义边界分块" },
  { id: "document-aware", label: "文档结构", description: "按标题/段落结构分块" },
  { id: "contextual", label: "上下文增强", description: "LLM 生成上下文前缀，提升检索质量" },
];

const RETRIEVAL_STRATEGIES: StrategyOption[] = [
  { id: "semantic", label: "语义检索", description: "基于向量余弦相似度" },
  { id: "keyword", label: "关键词检索", description: "基于 BM25 文本匹配" },
  { id: "hybrid", label: "混合检索", description: "向量 + 关键词加权融合" },
];

const QUERY_STRATEGIES: StrategyOption[] = [
  { id: "rewrite", label: "查询改写", description: "LLM 重写用户问题" },
  { id: "hyde", label: "HyDE", description: "生成假设文档再检索" },
  { id: "multi-query", label: "多查询", description: "拆分为多个子查询" },
];

const MODEL_STRATEGIES: StrategyOption[] = [
  { id: "kimi", label: "Kimi (Moonshot)", description: "月之暗面大模型" },
  { id: "ark", label: "Ark (Volcengine)", description: "火山引擎 Ark Agent Plan" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toggleSet<T>(set: Set<T>, item: T): Set<T> {
  const next = new Set(set);
  if (next.has(item)) {
    next.delete(item);
  } else {
    next.add(item);
  }
  return next;
}

function useExperiment(defaultStrategies: string[]) {
  const [state, setState] = useState<ExperimentState>({
    question: "",
    selected: new Set(defaultStrategies),
    results: [],
    isLoading: false,
  });

  const setQuestion = useCallback(
    (question: string) => setState((s) => ({ ...s, question })),
    []
  );

  const toggleStrategy = useCallback(
    (id: string) =>
      setState((s) => ({ ...s, selected: toggleSet(s.selected, id) })),
    []
  );

  const setResults = useCallback(
    (results: CompareResult[]) =>
      setState((s) => ({ ...s, results, isLoading: false })),
    []
  );

  const setLoading = useCallback(
    () => setState((s) => ({ ...s, isLoading: true })),
    []
  );

  return { state, setQuestion, toggleStrategy, setResults, setLoading };
}

const RETRIEVAL_MODE_IDS = new Set(["semantic", "keyword", "hybrid"]);
const QUERY_ENHANCER_IDS = new Set(["rewrite", "hyde", "multi-query"]);
const MODEL_IDS = new Set(["kimi", "ark"]);

/** Call the query API with given config and return a CompareResult */
async function runStrategyQuery(
  question: string,
  strategy: string,
  extraBody: Record<string, unknown> = {}
): Promise<CompareResult> {
  const start = performance.now();
  try {
    // Map strategy to the correct API fields
    const apiBody: Record<string, unknown> = { question, ...extraBody };

    if (RETRIEVAL_MODE_IDS.has(strategy)) {
      apiBody.mode = strategy;
    } else if (QUERY_ENHANCER_IDS.has(strategy)) {
      apiBody.enhancers = [strategy];
    } else if (MODEL_IDS.has(strategy)) {
      apiBody.model = strategy;
    } else {
      // Chunking or other strategies — pass as strategy field
      apiBody.strategy = strategy;
    }

    const res = await fetch("/api/rag/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(apiBody),
    });
    const data = await res.json();
    const durationMs = Math.round(performance.now() - start);

    return {
      strategy,
      answer: data.answer ?? "无回答",
      sources: (data.sources ?? []).map(
        (s: { chunk_id?: string; content?: string; score?: number }) => ({
          chunkId: s.chunk_id ?? "unknown",
          score: s.score ?? 0,
          content: s.content ?? "",
        })
      ),
      durationMs,
      metrics: data.evaluation ?? {
        relevance: 0,
        faithfulness: 0,
        completeness: 0,
      },
    };
  } catch {
    return {
      strategy,
      answer: "请求失败",
      sources: [],
      durationMs: Math.round(performance.now() - start),
    };
  }
}

// ---------------------------------------------------------------------------
// Strategy checkbox grid
// ---------------------------------------------------------------------------

function StrategySelector({
  options,
  selected,
  onToggle,
}: {
  options: StrategyOption[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const isSelected = selected.has(opt.id);
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onToggle(opt.id)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
              isSelected
                ? "border-primary bg-primary/5 text-primary"
                : "border-border bg-card text-muted-foreground hover:border-primary/30"
            }`}
          >
            <span
              className={`flex size-4 items-center justify-center rounded border text-[10px] ${
                isSelected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-muted-foreground/40"
              }`}
            >
              {isSelected && "✓"}
            </span>
            <span className="font-medium">{opt.label}</span>
            {opt.description && (
              <span className="hidden text-xs text-muted-foreground sm:inline">
                — {opt.description}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Radar data builder
// ---------------------------------------------------------------------------

function buildRadarData(results: CompareResult[]) {
  return results
    .filter((r) => r.metrics)
    .map((r) => ({
      strategy: r.strategy,
      relevance: r.metrics!.relevance,
      faithfulness: r.metrics!.faithfulness,
      completeness: r.metrics!.completeness,
      latency: r.durationMs,
      cost: r.durationMs * 0.001, // simplified cost estimation
    }));
}

// ---------------------------------------------------------------------------
// Experiment panel wrapper
// ---------------------------------------------------------------------------

function ExperimentPanel({
  strategies,
  defaultStrategies,
  extraControls,
  getExtraBody,
}: {
  strategies: StrategyOption[];
  defaultStrategies: string[];
  extraControls?: React.ReactNode;
  getExtraBody?: () => Record<string, unknown>;
}) {
  const { state, setQuestion, toggleStrategy, setResults, setLoading } =
    useExperiment(defaultStrategies);

  const handleRun = async () => {
    if (!state.question.trim() || state.selected.size === 0) return;
    setLoading();
    const extra = getExtraBody?.() ?? {};
    const promises = Array.from(state.selected).map((s) =>
      runStrategyQuery(state.question, s, extra)
    );
    const results = await Promise.all(promises);
    setResults(results);
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div>
            <label className="mb-2 block text-sm font-medium">
              测试问题
            </label>
            <div className="flex gap-2">
              <Input
                placeholder="输入要测试的问题..."
                value={state.question}
                onChange={(e) =>
                  setQuestion((e.target as HTMLInputElement).value)
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRun();
                }}
              />
              <Button
                onClick={handleRun}
                disabled={
                  state.isLoading ||
                  !state.question.trim() ||
                  state.selected.size === 0
                }
              >
                {state.isLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Play className="size-4" />
                )}
                运行实验
              </Button>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              选择策略
            </label>
            <StrategySelector
              options={strategies}
              selected={state.selected}
              onToggle={toggleStrategy}
            />
          </div>

          {extraControls}
        </CardContent>
      </Card>

      {/* Results */}
      <StrategyCompare results={state.results} isLoading={state.isLoading} />

      {/* Radar */}
      {state.results.length > 1 && (
        <RadarChart data={buildRadarData(state.results)} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chunking tab extra controls
// ---------------------------------------------------------------------------

function ChunkingControls({
  onOptionsRef,
}: {
  onOptionsRef: React.MutableRefObject<() => Record<string, unknown>>;
}) {
  const [chunkSize, setChunkSize] = useState(512);
  const [chunkOverlap, setChunkOverlap] = useState(50);

  useEffect(() => {
    onOptionsRef.current = () => ({
      chunk_size: chunkSize,
      chunk_overlap: chunkOverlap,
    });
  }, [chunkOverlap, chunkSize, onOptionsRef]);

  return (
    <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
      <p className="text-sm font-medium">分块参数</p>
      <div>
        <div className="mb-2 flex justify-between text-sm">
          <span>Chunk Size</span>
          <span className="text-muted-foreground">{chunkSize} tokens</span>
        </div>
        <Slider
          value={[chunkSize]}
          min={128}
          max={2048}
          step={64}
          onValueChange={(val) => {
            const v = Array.isArray(val) ? val[0] : val;
            setChunkSize(v);
          }}
        />
      </div>
      <div>
        <div className="mb-2 flex justify-between text-sm">
          <span>Overlap</span>
          <span className="text-muted-foreground">{chunkOverlap} tokens</span>
        </div>
        <Slider
          value={[chunkOverlap]}
          min={0}
          max={512}
          step={16}
          onValueChange={(val) => {
            const v = Array.isArray(val) ? val[0] : val;
            setChunkOverlap(v);
          }}
        />
      </div>
    </div>
  );
}

function ChunkingTab() {
  const optionsRef = { current: () => ({}) as Record<string, unknown> };

  return (
    <ExperimentPanel
      strategies={CHUNKING_STRATEGIES}
      defaultStrategies={["recursive", "semantic"]}
      extraControls={<ChunkingControls onOptionsRef={optionsRef} />}
      getExtraBody={() => optionsRef.current()}
    />
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const TAB_META = [
  {
    value: "chunking",
    label: "分块策略",
    title: "分块策略对比",
    description: "对比不同分块大小和重叠度对检索效果的影响",
  },
  {
    value: "retrieval",
    label: "检索策略",
    title: "检索策略对比",
    description: "对比向量检索、关键词检索和混合检索的效果",
  },
  {
    value: "query",
    label: "查询增强",
    title: "查询增强策略对比",
    description: "对比查询改写、HyDE 和多查询对检索效果的提升",
  },
  {
    value: "model",
    label: "模型对比",
    title: "生成模型对比",
    description: "对比不同 LLM 模型对回答质量的影响",
  },
];

export default function LabPage() {
  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FlaskConical className="size-5" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">策略实验室</h1>
            <p className="mt-1 text-muted-foreground">
              对比不同 RAG 策略的效果，找到最优配置
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="chunking">
        <TabsList>
          {TAB_META.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Chunking Tab */}
        <TabsContent value="chunking">
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">{TAB_META[0].title}</h2>
              <p className="text-sm text-muted-foreground">
                {TAB_META[0].description}
              </p>
            </div>
            <ChunkingTab />
          </div>
        </TabsContent>

        {/* Retrieval Tab */}
        <TabsContent value="retrieval">
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">{TAB_META[1].title}</h2>
              <p className="text-sm text-muted-foreground">
                {TAB_META[1].description}
              </p>
            </div>
            <ExperimentPanel
              strategies={RETRIEVAL_STRATEGIES}
              defaultStrategies={["semantic", "hybrid"]}
            />
          </div>
        </TabsContent>

        {/* Query Enhancement Tab */}
        <TabsContent value="query">
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">{TAB_META[2].title}</h2>
              <p className="text-sm text-muted-foreground">
                {TAB_META[2].description}
              </p>
            </div>
            <ExperimentPanel
              strategies={QUERY_STRATEGIES}
              defaultStrategies={["rewrite", "hyde"]}
            />
          </div>
        </TabsContent>

        {/* Model Tab */}
        <TabsContent value="model">
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">{TAB_META[3].title}</h2>
              <p className="text-sm text-muted-foreground">
                {TAB_META[3].description}
              </p>
            </div>
            <ExperimentPanel
              strategies={MODEL_STRATEGIES}
              defaultStrategies={["kimi", "ark"]}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
