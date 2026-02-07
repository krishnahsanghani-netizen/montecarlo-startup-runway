"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { loadProjectState } from "@/lib/domain/local-storage";
import { ScenarioResult } from "@/lib/domain/types";

interface SimulationRecord {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  progress: number;
  output?: {
    runId: string;
    createdAt: string;
    results: ScenarioResult[];
  };
  error?: string;
}

function asPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function asCurrency(value: number): string {
  return `$${Math.round(value).toLocaleString()}`;
}

function buildComparisonRows(results: ScenarioResult[]) {
  if (results.length === 0) return [];
  const base = results[0];
  return results.slice(1).map((scenario) => ({
    scenario: scenario.scenarioName,
    deltaDefaultProbability:
      scenario.summary.defaultProbabilityByHorizon - base.summary.defaultProbabilityByHorizon,
    deltaMedianArr: scenario.summary.medianArrAtHorizon - base.summary.medianArrAtHorizon,
    deltaTerminalCashP50:
      (scenario.monthlyAggregates.at(-1)?.cash.p50 ?? 0) - (base.monthlyAggregates.at(-1)?.cash.p50 ?? 0)
  }));
}

export default function SimulatePage() {
  const [nRuns, setNRuns] = useState(5000);
  const [seed, setSeed] = useState(42);
  const [horizon, setHorizon] = useState(36);
  const [samplePathCount, setSamplePathCount] = useState(75);
  const [runId, setRunId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("idle");
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ScenarioResult[]>([]);
  const [selectedPathIndex, setSelectedPathIndex] = useState(0);
  const [overlayMetric, setOverlayMetric] = useState<"default" | "arr_p50" | "cash_p50">("default");
  const [selectedSensitivityOutcome, setSelectedSensitivityOutcome] = useState<"defaultByHorizon" | "terminalArr" | "terminalCash">("defaultByHorizon");
  const [progressPct, setProgressPct] = useState(0);
  const [etaSeconds, setEtaSeconds] = useState<number | null>(null);

  const headline = useMemo(() => {
    const first = results[0];
    if (!first) return null;
    return first.summary;
  }, [results]);
  const headlineRunStats = useMemo(() => {
    const first = results[0];
    if (!first || first.runOutcomes.length === 0) return null;
    const drawdowns = first.runOutcomes.map((x) => x.maxDrawdownCash).sort((a, b) => a - b);
    const burns = first.runOutcomes.map((x) => x.maxBurnRate).sort((a, b) => a - b);
    const median = (arr: number[]) => arr[Math.floor(arr.length * 0.5)] ?? 0;
    return {
      medianMaxDrawdown: median(drawdowns),
      medianMaxBurnRate: median(burns)
    };
  }, [results]);

  const primaryScenario = results[0] ?? null;
  const comparisonRows = useMemo(() => buildComparisonRows(results), [results]);
  const overlaySeriesData = useMemo(() => {
    if (results.length === 0) return [];
    const horizonLength = results[0].monthlyAggregates.length;
    return Array.from({ length: horizonLength }, (_, idx) => {
      const row: Record<string, number> = { month: idx + 1 };
      for (const scenario of results) {
        if (overlayMetric === "default") {
          row[scenario.scenarioName] = scenario.monthlyAggregates[idx]?.defaultProbabilityCumulative ?? 0;
        } else if (overlayMetric === "arr_p50") {
          row[scenario.scenarioName] = scenario.monthlyAggregates[idx]?.arr.p50 ?? 0;
        } else {
          row[scenario.scenarioName] = scenario.monthlyAggregates[idx]?.cash.p50 ?? 0;
        }
      }
      return row as { month: number } & Record<string, number>;
    });
  }, [results, overlayMetric]);
  const selectedSamplePath = useMemo(() => {
    if (!primaryScenario || primaryScenario.samplePaths.length === 0) return null;
    const idx = Math.min(selectedPathIndex, primaryScenario.samplePaths.length - 1);
    return primaryScenario.samplePaths[idx];
  }, [primaryScenario, selectedPathIndex]);

  const pathDrilldownData = useMemo(() => {
    if (!primaryScenario || !selectedSamplePath) return [];
    const length = Math.min(primaryScenario.monthlyAggregates.length, selectedSamplePath.cash.length);
    return Array.from({ length }, (_, idx) => ({
      month: idx + 1,
      pathCash: selectedSamplePath.cash[idx],
      p5: primaryScenario.monthlyAggregates[idx].cash.p5,
      p50: primaryScenario.monthlyAggregates[idx].cash.p50,
      p95: primaryScenario.monthlyAggregates[idx].cash.p95
    }));
  }, [primaryScenario, selectedSamplePath]);
  const sensitivityHeatmapRows = useMemo(() => {
    if (!primaryScenario) return [];
    const byInput = new Map<string, Record<string, number>>();
    for (const point of primaryScenario.sensitivity) {
      const row = byInput.get(point.input) ?? {};
      row[point.outcome] = point.score;
      byInput.set(point.input, row);
    }
    return Array.from(byInput.entries()).map(([input, scores]) => ({
      input,
      defaultByHorizon: scores.defaultByHorizon ?? 0,
      terminalArr: scores.terminalArr ?? 0,
      terminalCash: scores.terminalCash ?? 0
    }));
  }, [primaryScenario]);
  const runOutcomeScatter = useMemo(() => {
    if (!primaryScenario) return [];
    return primaryScenario.runOutcomes.map((row) => ({
      terminalArr: row.terminalArr,
      maxBurnRate: row.maxBurnRate,
      maxDrawdownCash: row.maxDrawdownCash
    }));
  }, [primaryScenario]);

  const tornadoData = useMemo(() => {
    if (!primaryScenario) return [];
    return primaryScenario.sensitivity
      .filter((point) => point.outcome === selectedSensitivityOutcome)
      .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
      .slice(0, 12)
      .map((point) => ({
        input: point.input,
        score: point.score
      }));
  }, [primaryScenario, selectedSensitivityOutcome]);

  const scenarioPalette = ["#38bdf8", "#f97316", "#22c55e", "#a78bfa", "#f43f5e", "#eab308"];

  async function handleRun() {
    setError(null);
    setStatus("starting");
    setProgressPct(2);
    setEtaSeconds(null);
    const state = loadProjectState();
    const activeScenarioCount = state.scenarios.filter((s) => s.enabled !== false).length || 1;
    const expectedMs = Math.max(1200, Math.round((nRuns * horizon * activeScenarioCount) / 90000) * 1000);
    const startedAt = Date.now();
    let optimisticTimer: ReturnType<typeof setInterval> | null = null;

    const payload = {
      model: state.model,
      scenarios: state.scenarios,
      params: {
        nRuns,
        seed,
        horizonMonths: horizon,
        samplePathCount
      }
    };

    const startRes = await fetch("/api/simulations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const startJson = await startRes.json();
    if (!startRes.ok) {
      setStatus("failed");
      setError(startJson.error ?? "Failed to start simulation");
      return;
    }

    setRunId(startJson.runId);
    setStatus("running");
    optimisticTimer = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const optimistic = Math.min(95, Math.round((elapsed / expectedMs) * 100));
      setProgressPct((prev) => Math.max(prev, optimistic));
      const remaining = Math.max(0, Math.round((expectedMs - elapsed) / 1000));
      setEtaSeconds(remaining);
    }, 300);

    const poll = async () => {
      const statusRes = await fetch(`/api/simulations/${startJson.runId}`, { cache: "no-store" });
      const statusJson = (await statusRes.json()) as SimulationRecord;

      if (!statusRes.ok) {
        if (optimisticTimer) clearInterval(optimisticTimer);
        setStatus("failed");
        setError((statusJson as unknown as { error?: string }).error ?? "Polling failed");
        return;
      }

      setProgressPct((prev) => Math.max(prev, statusJson.progress ?? prev));

      if (statusJson.status === "completed" && statusJson.output) {
        if (optimisticTimer) clearInterval(optimisticTimer);
        setProgressPct(100);
        setEtaSeconds(0);
        setResults(statusJson.output.results);
        setStatus("completed");
        return;
      }

      if (statusJson.status === "failed") {
        if (optimisticTimer) clearInterval(optimisticTimer);
        setStatus("failed");
        setError(statusJson.error ?? "Simulation failed");
        return;
      }

      setTimeout(poll, 400);
    };

    poll();
  }

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Simulation Dashboard</h1>
        <p className="text-sm text-slate-700 dark:text-slate-300">Manual run mode with seed control and scenario comparison output.</p>
      </header>

      <div className="grid gap-3 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 md:grid-cols-4">
        <label className="text-sm">
          Runs
          <input
            type="number"
            min={100}
            max={10000}
            value={nRuns}
            onChange={(e) => setNRuns(Number(e.target.value))}
            className="mt-1 w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2"
          />
        </label>
        <label className="text-sm">
          Seed
          <input
            type="number"
            min={0}
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value))}
            className="mt-1 w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2"
          />
        </label>
        <label className="text-sm">
          Horizon (months)
          <input
            type="number"
            min={12}
            max={60}
            value={horizon}
            onChange={(e) => setHorizon(Number(e.target.value))}
            className="mt-1 w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2"
          />
        </label>
        <label className="text-sm">
          Sample paths
          <input
            type="number"
            min={10}
            max={100}
            value={samplePathCount}
            onChange={(e) => setSamplePathCount(Number(e.target.value))}
            className="mt-1 w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button onClick={handleRun} className="rounded bg-sky-500 px-4 py-2 font-medium text-slate-950">
          Run Simulation
        </button>
        <span className="text-sm text-slate-700 dark:text-slate-300">Status: {status}</span>
        {runId && <span className="text-xs text-slate-600 dark:text-slate-400">Run ID: {runId}</span>}
        {runId && (
          <>
            <a className="rounded border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs" href={`/api/exports/${runId}.csv`}>
              Export CSV
            </a>
            <a className="rounded border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs" href={`/api/exports/${runId}.json`}>
              Export JSON
            </a>
          </>
        )}
      </div>

      {(status === "running" || status === "starting") && (
        <section className="space-y-2 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
          <div className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300">
            <span>Simulation progress</span>
            <span>
              {progressPct}%{etaSeconds !== null ? ` • ETA ~${etaSeconds}s` : ""}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded bg-slate-800">
            <div className="h-full bg-sky-500 transition-all duration-300" style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }} />
          </div>
        </section>
      )}

      {error && <p className="rounded border border-red-800 bg-red-950/50 p-3 text-sm text-red-300">{error}</p>}

      {headline && (
        <section className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
          <article className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <h2 className="text-xs uppercase text-slate-600 dark:text-slate-400">Default Probability</h2>
            <p className="text-2xl font-semibold">{asPercent(headline.defaultProbabilityByHorizon)}</p>
          </article>
          <article className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <h2 className="text-xs uppercase text-slate-600 dark:text-slate-400">Survival Probability</h2>
            <p className="text-2xl font-semibold">{asPercent(headline.survivalProbability)}</p>
          </article>
          <article className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <h2 className="text-xs uppercase text-slate-600 dark:text-slate-400">Median ARR</h2>
            <p className="text-2xl font-semibold">{asCurrency(headline.medianArrAtHorizon)}</p>
          </article>
          <article className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <h2 className="text-xs uppercase text-slate-600 dark:text-slate-400">Terminal Cash P5</h2>
            <p className="text-2xl font-semibold">{asCurrency(headline.terminalCashP5)}</p>
          </article>
          <article className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <h2 className="text-xs uppercase text-slate-600 dark:text-slate-400">Terminal Cash P95</h2>
            <p className="text-2xl font-semibold">{asCurrency(headline.terminalCashP95)}</p>
          </article>
          <article className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <h2 className="text-xs uppercase text-slate-600 dark:text-slate-400">Milestone Hit (First)</h2>
            <p className="text-2xl font-semibold">
              {headline.milestoneProbabilities[0]
                ? asPercent(headline.milestoneProbabilities[0].probability)
                : "N/A"}
            </p>
          </article>
          {headlineRunStats && (
            <article className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <h2 className="text-xs uppercase text-slate-600 dark:text-slate-400">Median Max Drawdown</h2>
              <p className="text-2xl font-semibold">{asCurrency(headlineRunStats.medianMaxDrawdown)}</p>
            </article>
          )}
          {headlineRunStats && (
            <article className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <h2 className="text-xs uppercase text-slate-600 dark:text-slate-400">Median Max Burn</h2>
              <p className="text-2xl font-semibold">{asCurrency(headlineRunStats.medianMaxBurnRate)}</p>
            </article>
          )}
        </section>
      )}

      {primaryScenario && (
        <section className="grid gap-4 md:grid-cols-2">
          <article className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <h2 className="mb-3 text-sm font-semibold">Cash Fan Chart ({primaryScenario.scenarioName})</h2>
            <div className="h-64 w-full">
              <ResponsiveContainer>
                <LineChart data={primaryScenario.monthlyAggregates}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="month" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <Tooltip formatter={(v: number) => asCurrency(v)} />
                  <Legend />
                  <Line type="monotone" dataKey="cash.p5" stroke="#ef4444" dot={false} name="P5" />
                  <Line type="monotone" dataKey="cash.p50" stroke="#38bdf8" dot={false} name="P50" />
                  <Line type="monotone" dataKey="cash.p95" stroke="#22c55e" dot={false} name="P95" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <h2 className="mb-3 text-sm font-semibold">ARR Fan Chart ({primaryScenario.scenarioName})</h2>
            <div className="h-64 w-full">
              <ResponsiveContainer>
                <LineChart data={primaryScenario.monthlyAggregates}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="month" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <Tooltip formatter={(v: number) => asCurrency(v)} />
                  <Legend />
                  <Line type="monotone" dataKey="arr.p5" stroke="#ef4444" dot={false} name="P5" />
                  <Line type="monotone" dataKey="arr.p50" stroke="#38bdf8" dot={false} name="P50" />
                  <Line type="monotone" dataKey="arr.p95" stroke="#22c55e" dot={false} name="P95" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <h2 className="mb-3 text-sm font-semibold">Users Fan Chart ({primaryScenario.scenarioName})</h2>
            <div className="h-64 w-full">
              <ResponsiveContainer>
                <LineChart data={primaryScenario.monthlyAggregates}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="month" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" tickFormatter={(v) => `${Math.round(v).toLocaleString()}`} />
                  <Tooltip formatter={(v: number) => Math.round(v).toLocaleString()} />
                  <Legend />
                  <Line type="monotone" dataKey="users.p5" stroke="#ef4444" dot={false} name="P5" />
                  <Line type="monotone" dataKey="users.p50" stroke="#38bdf8" dot={false} name="P50" />
                  <Line type="monotone" dataKey="users.p95" stroke="#22c55e" dot={false} name="P95" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <h2 className="mb-3 text-sm font-semibold">MRR Fan Chart ({primaryScenario.scenarioName})</h2>
            <div className="h-64 w-full">
              <ResponsiveContainer>
                <LineChart data={primaryScenario.monthlyAggregates}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="month" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <Tooltip formatter={(v: number) => asCurrency(v)} />
                  <Legend />
                  <Line type="monotone" dataKey="mrr.p5" stroke="#ef4444" dot={false} name="P5" />
                  <Line type="monotone" dataKey="mrr.p50" stroke="#38bdf8" dot={false} name="P50" />
                  <Line type="monotone" dataKey="mrr.p95" stroke="#22c55e" dot={false} name="P95" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <h2 className="mb-3 text-sm font-semibold">Runway Fan Chart ({primaryScenario.scenarioName})</h2>
            <div className="h-64 w-full">
              <ResponsiveContainer>
                <LineChart data={primaryScenario.monthlyAggregates}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="month" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" tickFormatter={(v) => (v > 1e8 ? "∞" : `${Math.round(v)}m`)} />
                  <Tooltip formatter={(v: number) => (v > 1e8 ? "∞" : `${v.toFixed(1)} months`)} />
                  <Legend />
                  <Line type="monotone" dataKey="runway.p5" stroke="#ef4444" dot={false} name="P5" />
                  <Line type="monotone" dataKey="runway.p50" stroke="#38bdf8" dot={false} name="P50" />
                  <Line type="monotone" dataKey="runway.p95" stroke="#22c55e" dot={false} name="P95" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <h2 className="mb-3 text-sm font-semibold">CAC Fan Chart ({primaryScenario.scenarioName})</h2>
            <div className="h-64 w-full">
              <ResponsiveContainer>
                <LineChart data={primaryScenario.monthlyAggregates}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="month" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" tickFormatter={(v) => `$${Math.round(v)}`} />
                  <Tooltip formatter={(v: number) => asCurrency(v)} />
                  <Legend />
                  <Line type="monotone" dataKey="cac.p5" stroke="#ef4444" dot={false} name="P5" />
                  <Line type="monotone" dataKey="cac.p50" stroke="#38bdf8" dot={false} name="P50" />
                  <Line type="monotone" dataKey="cac.p95" stroke="#22c55e" dot={false} name="P95" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <h2 className="mb-3 text-sm font-semibold">Funds Raised ({primaryScenario.scenarioName})</h2>
            <div className="h-64 w-full">
              <ResponsiveContainer>
                <LineChart data={primaryScenario.monthlyAggregates}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="month" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <Tooltip formatter={(v: number) => asCurrency(v)} />
                  <Legend />
                  <Line type="monotone" dataKey="fundsRaised.p5" stroke="#ef4444" dot={false} name="P5" />
                  <Line type="monotone" dataKey="fundsRaised.p50" stroke="#f97316" dot={false} name="P50" />
                  <Line type="monotone" dataKey="fundsRaised.p95" stroke="#22c55e" dot={false} name="P95" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <h2 className="mb-3 text-sm font-semibold">Macro Index ({primaryScenario.scenarioName})</h2>
            <div className="h-64 w-full">
              <ResponsiveContainer>
                <AreaChart data={primaryScenario.monthlyAggregates}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="month" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip formatter={(v: number) => v.toFixed(3)} />
                  <Legend />
                  <Area type="monotone" dataKey="macroIndex.p95" stroke="#22c55e" fill="#22c55e22" name="P95" />
                  <Area type="monotone" dataKey="macroIndex.p50" stroke="#38bdf8" fill="#38bdf822" name="P50" />
                  <Area type="monotone" dataKey="macroIndex.p5" stroke="#ef4444" fill="#ef444422" name="P5" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 md:col-span-2">
            <h2 className="mb-3 text-sm font-semibold">Cumulative Default Probability ({primaryScenario.scenarioName})</h2>
            <div className="h-64 w-full">
              <ResponsiveContainer>
                <LineChart data={primaryScenario.monthlyAggregates}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="month" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" tickFormatter={(v) => `${Math.round(v * 100)}%`} />
                  <Tooltip formatter={(v: number) => asPercent(v)} />
                  <Line type="monotone" dataKey="defaultProbabilityCumulative" stroke="#f97316" dot={false} name="Default Probability" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </article>
        </section>
      )}

      {primaryScenario && (
        <section className="grid gap-4 md:grid-cols-2">
          <article className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Sensitivity Tornado ({primaryScenario.scenarioName})</h2>
              <select
                value={selectedSensitivityOutcome}
                onChange={(e) =>
                  setSelectedSensitivityOutcome(
                    e.target.value as "defaultByHorizon" | "terminalArr" | "terminalCash"
                  )
                }
                className="rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 px-2 py-1 text-xs"
              >
                <option value="defaultByHorizon">defaultByHorizon</option>
                <option value="terminalArr">terminalArr</option>
                <option value="terminalCash">terminalCash</option>
              </select>
            </div>
            <div className="h-80 w-full">
              <ResponsiveContainer>
                <BarChart data={tornadoData} layout="vertical" margin={{ left: 80, right: 8, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis type="number" stroke="#94a3b8" domain={[-1, 1]} />
                  <YAxis type="category" dataKey="input" stroke="#94a3b8" width={120} />
                  <Tooltip formatter={(v: number) => v.toFixed(3)} />
                  <Bar dataKey="score" fill="#f97316" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <h2 className="mb-3 text-sm font-semibold">Sensitivity Heatmap ({primaryScenario.scenarioName})</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-xs">
                <thead>
                  <tr className="text-slate-600 dark:text-slate-400">
                    <th className="border border-slate-200 dark:border-slate-800 px-2 py-1 text-left">Input</th>
                    <th className="border border-slate-200 dark:border-slate-800 px-2 py-1 text-left">defaultByHorizon</th>
                    <th className="border border-slate-200 dark:border-slate-800 px-2 py-1 text-left">terminalArr</th>
                    <th className="border border-slate-200 dark:border-slate-800 px-2 py-1 text-left">terminalCash</th>
                  </tr>
                </thead>
                <tbody>
                  {sensitivityHeatmapRows.map((row) => (
                    <tr key={row.input}>
                      <td className="border border-slate-200 dark:border-slate-800 px-2 py-1">{row.input}</td>
                      {(["defaultByHorizon", "terminalArr", "terminalCash"] as const).map((key) => {
                        const value = row[key];
                        const alpha = Math.min(0.8, Math.abs(value));
                        const bg =
                          value >= 0
                            ? `rgba(34,197,94,${alpha})`
                            : `rgba(239,68,68,${alpha})`;
                        return (
                          <td key={`${row.input}-${key}`} className="border border-slate-200 dark:border-slate-800 px-2 py-1" style={{ background: bg }}>
                            {value.toFixed(3)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      )}

      {comparisonRows.length > 0 && (
        <section className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <h2 className="mb-3 text-sm font-semibold">Scenario Delta vs Base</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead>
                <tr className="text-slate-600 dark:text-slate-400">
                  <th className="px-2 py-1">Scenario</th>
                  <th className="px-2 py-1">Default Prob Delta</th>
                  <th className="px-2 py-1">Median ARR Delta</th>
                  <th className="px-2 py-1">Terminal Cash P50 Delta</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row.scenario} className="border-t border-slate-200 dark:border-slate-800">
                    <td className="px-2 py-1">{row.scenario}</td>
                    <td className="px-2 py-1">{asPercent(row.deltaDefaultProbability)}</td>
                    <td className="px-2 py-1">{asCurrency(row.deltaMedianArr)}</td>
                    <td className="px-2 py-1">{asCurrency(row.deltaTerminalCashP50)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {results.length > 1 && (
        <section className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h2 className="text-sm font-semibold">Scenario Overlay</h2>
            <select
              value={overlayMetric}
              onChange={(e) => setOverlayMetric(e.target.value as "default" | "arr_p50" | "cash_p50")}
              className="rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 px-2 py-1 text-xs"
            >
              <option value="default">Cumulative Default Probability</option>
              <option value="arr_p50">ARR P50</option>
              <option value="cash_p50">Cash P50</option>
            </select>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer>
              <LineChart data={overlaySeriesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="month" stroke="#94a3b8" />
                <YAxis
                  stroke="#94a3b8"
                  tickFormatter={(v) =>
                    overlayMetric === "default" ? `${Math.round(v * 100)}%` : `${Math.round(v / 1000)}k`
                  }
                />
                <Tooltip
                  formatter={(v: number) =>
                    overlayMetric === "default" ? asPercent(v) : asCurrency(v)
                  }
                />
                <Legend />
                {results.map((scenario, idx) => (
                  <Line
                    key={scenario.scenarioId}
                    type="monotone"
                    dataKey={scenario.scenarioName}
                    stroke={scenarioPalette[idx % scenarioPalette.length]}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {primaryScenario && primaryScenario.samplePaths.length > 0 && (
        <section className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h2 className="text-sm font-semibold">Sample Path Drilldown ({primaryScenario.scenarioName})</h2>
            <label className="text-xs">
              Path
              <select
                value={Math.min(selectedPathIndex, primaryScenario.samplePaths.length - 1)}
                onChange={(e) => setSelectedPathIndex(Number(e.target.value))}
                className="ml-2 rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 px-2 py-1"
              >
                {primaryScenario.samplePaths.map((path, idx) => (
                  <option key={path.run} value={idx}>
                    #{path.run}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer>
              <LineChart data={pathDrilldownData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="month" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip formatter={(v: number) => asCurrency(v)} />
                <Legend />
                <Line type="monotone" dataKey="p5" stroke="#ef4444" dot={false} name="P5" />
                <Line type="monotone" dataKey="p50" stroke="#38bdf8" dot={false} name="P50" />
                <Line type="monotone" dataKey="p95" stroke="#22c55e" dot={false} name="P95" />
                <Line type="monotone" dataKey="pathCash" stroke="#facc15" dot={false} name="Selected Path" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {primaryScenario && runOutcomeScatter.length > 0 && (
        <section className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <h2 className="mb-3 text-sm font-semibold">Run Outcomes Scatter ({primaryScenario.scenarioName})</h2>
          <div className="h-72 w-full">
            <ResponsiveContainer>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis
                  type="number"
                  dataKey="terminalArr"
                  name="Terminal ARR"
                  stroke="#94a3b8"
                  tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                />
                <YAxis
                  type="number"
                  dataKey="maxBurnRate"
                  name="Max Burn"
                  stroke="#94a3b8"
                  tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  formatter={(value: number) => asCurrency(value)}
                />
                <Scatter data={runOutcomeScatter} fill="#f97316" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {results.length > 0 && (
        <section className="space-y-4">
          {results.map((scenario) => (
            <article key={scenario.scenarioId} className="space-y-3 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <h2 className="text-lg font-semibold">{scenario.scenarioName}</h2>
              <p className="text-sm text-slate-700 dark:text-slate-300">{scenario.narrative}</p>
              {scenario.warnings && scenario.warnings.length > 0 && (
                <ul className="rounded border border-amber-700/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-200">
                  {scenario.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 p-3">
                  <h3 className="mb-2 text-sm font-medium">Default Month Distribution</h3>
                  <div className="h-56 w-full">
                    <ResponsiveContainer>
                      <BarChart data={scenario.defaultMonthDistribution.filter((x) => x.count > 0)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                        <XAxis dataKey="month" stroke="#94a3b8" />
                        <YAxis stroke="#94a3b8" tickFormatter={(v) => `${Math.round(v * 100)}%`} />
                        <Tooltip formatter={(v: number) => asPercent(v)} />
                        <Bar dataKey="probability" fill="#f97316" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 p-3">
                  <h3 className="mb-2 text-sm font-medium">Fundraising Success by Round</h3>
                  <div className="h-56 w-full">
                    <ResponsiveContainer>
                      <BarChart data={scenario.fundraisingRoundOutcomes}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                        <XAxis dataKey="roundName" stroke="#94a3b8" />
                        <YAxis stroke="#94a3b8" tickFormatter={(v) => `${Math.round(v * 100)}%`} />
                        <Tooltip formatter={(v: number) => asPercent(v)} />
                        <Bar dataKey="successProbability" fill="#22c55e" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 p-3">
                  <h3 className="mb-2 text-sm font-medium">Terminal ARR Histogram</h3>
                  <div className="h-56 w-full">
                    <ResponsiveContainer>
                      <BarChart
                        data={scenario.terminalHistograms.arr.map((bin) => ({
                          label: `${Math.round(bin.binStart / 1000)}k`,
                          probability: bin.probability
                        }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                        <XAxis dataKey="label" stroke="#94a3b8" hide />
                        <YAxis stroke="#94a3b8" tickFormatter={(v) => `${Math.round(v * 100)}%`} />
                        <Tooltip formatter={(v: number) => asPercent(v)} />
                        <Bar dataKey="probability" fill="#38bdf8" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 p-3">
                  <h3 className="mb-2 text-sm font-medium">Terminal Cash Histogram</h3>
                  <div className="h-56 w-full">
                    <ResponsiveContainer>
                      <BarChart
                        data={scenario.terminalHistograms.cash.map((bin) => ({
                          label: `${Math.round(bin.binStart / 1000)}k`,
                          probability: bin.probability
                        }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                        <XAxis dataKey="label" stroke="#94a3b8" hide />
                        <YAxis stroke="#94a3b8" tickFormatter={(v) => `${Math.round(v * 100)}%`} />
                        <Tooltip formatter={(v: number) => asPercent(v)} />
                        <Bar dataKey="probability" fill="#22c55e" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <h3 className="text-sm font-medium">Milestones</h3>
                <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300">
                  {scenario.summary.milestoneProbabilities.map((m, index) => (
                    <li key={`${scenario.scenarioId}-m-${index}`}>
                      {m.type} by month {m.month} (threshold {m.threshold}): {asPercent(m.probability)}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-1">
                <h3 className="text-sm font-medium">Top Sensitivities</h3>
                <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300">
                  {scenario.sensitivity.slice(0, 6).map((point, index) => (
                    <li key={`${scenario.scenarioId}-${point.input}-${point.outcome}-${index}`}>
                      {point.input} {"->"} {point.outcome}: {point.score.toFixed(3)}
                    </li>
                  ))}
                </ul>
              </div>

              {scenario.fundraisingRoundOutcomes.length > 0 && (
                <div className="space-y-1">
                  <h3 className="text-sm font-medium">Fundraising Detail</h3>
                  <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300">
                    {scenario.fundraisingRoundOutcomes.map((round) => (
                      <li key={`${scenario.scenarioId}-${round.roundId}`}>
                        {round.roundName}: attempts {round.attempts}, successes {round.successes}, success {asPercent(round.successProbability)}, valuation samples {round.valuationHistogram.reduce((sum, x) => sum + x.count, 0)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </article>
          ))}
        </section>
      )}
    </section>
  );
}
