"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { defaultModel, modelTemplates } from "@/lib/domain/defaults";
import {
  loadActiveModelId,
  loadProjectState,
  saveActiveModelId,
  saveProjectState
} from "@/lib/domain/local-storage";
import {
  DistributionDefinition,
  FundraisingRound,
  MilestoneDefinition,
  MilestoneType,
  StartupModel
} from "@/lib/domain/types";

type ModelTab = "basics" | "revenue" | "costs" | "fundraising" | "macro" | "milestones" | "uncertainty" | "advanced";

const tabs: Array<{ id: ModelTab; label: string }> = [
  { id: "basics", label: "Basics" },
  { id: "revenue", label: "Revenue" },
  { id: "costs", label: "Costs" },
  { id: "fundraising", label: "Fundraising" },
  { id: "macro", label: "Macro + Correlation" },
  { id: "milestones", label: "Milestones" },
  { id: "uncertainty", label: "Uncertainty" },
  { id: "advanced", label: "Advanced JSON" }
];

function toNumber(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getDistribution(model: StartupModel, id: string): DistributionDefinition | undefined {
  return model.distributions.find((d) => d.id === id);
}

function updateDistribution(model: StartupModel, id: string, updater: (dist: DistributionDefinition) => DistributionDefinition): StartupModel {
  return {
    ...model,
    distributions: model.distributions.map((dist) => (dist.id === id ? updater(dist) : dist))
  };
}

function updateDistributionParam(
  model: StartupModel,
  distId: string,
  key: string,
  value: number
): StartupModel {
  return updateDistribution(model, distId, (dist) => ({
    ...dist,
    params: {
      ...dist.params,
      [key]: value
    }
  }));
}

function defaultParamsForDistributionType(type: DistributionDefinition["type"]): Record<string, number> {
  if (type === "normal") return { mean: 0, std: 1 };
  if (type === "lognormal") return { logMean: 0, logStd: 1 };
  if (type === "beta") return { alpha: 2, beta: 2, min: 0, max: 1 };
  if (type === "triangular") return { min: 0, mode: 0.5, max: 1 };
  if (type === "uniform") return { min: 0, max: 1 };
  return {};
}

export default function ModelPage() {
  const [model, setModel] = useState<StartupModel>(defaultModel);
  const [jsonText, setJsonText] = useState<string>(JSON.stringify(defaultModel, null, 2));
  const [status, setStatus] = useState<string>("Ready");
  const [activeTab, setActiveTab] = useState<ModelTab>("basics");
  const [selectedDistributionId, setSelectedDistributionId] = useState<string>(defaultModel.distributions[0]?.id ?? "");
  const [activeModelId, setActiveModelId] = useState<string>("");
  const [templateId, setTemplateId] = useState<string>("saas");

  useEffect(() => {
    const state = loadProjectState();
    setModel(state.model);
    setJsonText(JSON.stringify(state.model, null, 2));
    setActiveModelId(loadActiveModelId() ?? "");
  }, []);

  useEffect(() => {
    setJsonText(JSON.stringify(model, null, 2));
  }, [model]);

  useEffect(() => {
    if (!model.distributions.some((d) => d.id === selectedDistributionId)) {
      setSelectedDistributionId(model.distributions[0]?.id ?? "");
    }
  }, [model.distributions, selectedDistributionId]);

  const parsed = useMemo(() => {
    try {
      return { ok: true as const, value: JSON.parse(jsonText) as StartupModel };
    } catch (error) {
      return { ok: false as const, error: String(error) };
    }
  }, [jsonText]);

  const growthDist = getDistribution(model, model.revenueModel.momGrowthDistributionId);
  const churnDist = getDistribution(model, model.revenueModel.churnDistributionId);
  const arpuDist = getDistribution(model, model.revenueModel.arpuDistributionId);
  const cacDist = model.revenueModel.cacDistributionId
    ? getDistribution(model, model.revenueModel.cacDistributionId)
    : undefined;
  const cogsDist = getDistribution(model, model.costModel.variableCostPerUserDistributionId);
  const warnings = useMemo(() => {
    const issues: string[] = [];
    if (model.timeHorizonMonths < 12 || model.timeHorizonMonths > 60) {
      issues.push("Time horizon should stay within 12 to 60 months.");
    }
    if (model.initialCash < 0) {
      issues.push("Initial cash cannot be negative.");
    }
    if (model.correlation?.matrix) {
      const n = model.correlation.matrix.length;
      if (n === 0 || !model.correlation.matrix.every((row) => row.length === n)) {
        issues.push("Correlation matrix must be square.");
      } else {
        for (let i = 0; i < n; i += 1) {
          const diag = model.correlation.matrix[i][i];
          if (Math.abs(diag - 1) > 1e-6) {
            issues.push(`Correlation matrix diagonal at row ${i + 1} should be 1.`);
            break;
          }
        }
        for (let i = 0; i < n; i += 1) {
          for (let j = 0; j < n; j += 1) {
            const value = model.correlation.matrix[i][j];
            if (value < -1 || value > 1) {
              issues.push("Correlation coefficients must be within [-1, 1].");
              i = n;
              break;
            }
            if (Math.abs(value - model.correlation.matrix[j][i]) > 1e-6) {
              issues.push("Correlation matrix should be symmetric.");
              i = n;
              break;
            }
          }
        }
      }
    }
    for (const dist of model.distributions) {
      if (dist.clampMin !== undefined && dist.clampMax !== undefined && dist.clampMin > dist.clampMax) {
        issues.push(`Distribution '${dist.id}' has clampMin > clampMax.`);
      }
      if (dist.type === "discrete") {
        const total = (dist.discreteValues ?? []).reduce((sum, x) => sum + x.probability, 0);
        if (dist.discreteValues && dist.discreteValues.length > 0 && Math.abs(total - 1) > 0.001) {
          issues.push(`Discrete distribution '${dist.id}' probabilities sum to ${total.toFixed(3)} (target 1.000).`);
        }
      }
    }
    return issues;
  }, [model]);
  const horizonInvalid = model.timeHorizonMonths < 12 || model.timeHorizonMonths > 60;
  const initialCashInvalid = model.initialCash < 0;

  function setField<K extends keyof StartupModel>(key: K, value: StartupModel[K]) {
    setModel((prev) => ({ ...prev, [key]: value }));
  }

  function handleBasicsChange(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;
    if (name === "name") setField("name", value);
    if (name === "timeHorizonMonths") setField("timeHorizonMonths", toNumber(value, model.timeHorizonMonths));
    if (name === "initialCash") setField("initialCash", toNumber(value, model.initialCash));
    if (name === "startingUsers") setField("startingUsers", toNumber(value, model.startingUsers));
    if (name === "startingMrr") setField("startingMrr", toNumber(value, model.startingMrr));
  }

  async function handleSaveFromModel(nextModel: StartupModel) {
    const existing = loadProjectState();
    saveProjectState({ model: nextModel, scenarios: existing.scenarios });

    try {
      const response = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nextModel.name,
          model: nextModel,
          scenarios: existing.scenarios
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        setStatus(`Saved local only. API save failed: ${payload.error ?? "unknown error"}`);
        return;
      }
      setActiveModelId(payload.id);
      saveActiveModelId(payload.id);
      setStatus(`Saved locally and API model id ${payload.id}`);
    } catch {
      setStatus("Saved locally. API save unavailable.");
    }
  }

  async function handleSave() {
    await handleSaveFromModel(model);
  }

  async function handleSaveFromJson() {
    if (!parsed.ok) {
      setStatus("Invalid JSON. Fix errors before saving.");
      return;
    }
    setModel(parsed.value);
    await handleSaveFromModel(parsed.value);
  }

  function resetTemplate() {
    const existing = loadProjectState();
    saveProjectState({ model: defaultModel, scenarios: existing.scenarios });
    setModel(defaultModel);
    setJsonText(JSON.stringify(defaultModel, null, 2));
    setStatus("Reset to SaaS template.");
  }

  function applyTemplate() {
    const template = modelTemplates.find((t) => t.id === templateId);
    if (!template) return;
    setModel(JSON.parse(JSON.stringify(template.model)) as StartupModel);
    setStatus(`Applied template: ${template.name}`);
  }

  async function handleLoadById() {
    if (!activeModelId.trim()) {
      setStatus("Enter a model ID to load.");
      return;
    }
    try {
      const response = await fetch(`/api/models/${activeModelId.trim()}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        setStatus(`Load failed: ${payload.error ?? "unknown error"}`);
        return;
      }
      const loadedModel = payload.model as StartupModel;
      const existing = loadProjectState();
      saveProjectState({ model: loadedModel, scenarios: payload.scenarios ?? existing.scenarios });
      setModel(loadedModel);
      setStatus(`Loaded model ${payload.id}`);
      saveActiveModelId(payload.id);
    } catch {
      setStatus("Failed to load model by ID.");
    }
  }

  function updateRound(index: number, updater: (round: FundraisingRound) => FundraisingRound) {
    setModel((prev) => ({
      ...prev,
      fundraisingPlan: {
        ...prev.fundraisingPlan,
        rounds: prev.fundraisingPlan.rounds.map((round, i) => (i === index ? updater(round) : round))
      }
    }));
  }

  function addRound() {
    const created: FundraisingRound = {
      id: `round_${Date.now()}`,
      name: `Round ${model.fundraisingPlan.rounds.length + 1}`,
      targetMonth: 12,
      targetAmount: 1000000,
      preMoneyValuation: 8000000,
      timeToCloseDistributionId: "dist_close_lag",
      valuationMultiplierDistributionId: "dist_val_mult"
    };

    setModel((prev) => ({
      ...prev,
      fundraisingPlan: {
        ...prev.fundraisingPlan,
        rounds: [...prev.fundraisingPlan.rounds, created]
      }
    }));
  }

  function removeRound(index: number) {
    setModel((prev) => ({
      ...prev,
      fundraisingPlan: {
        ...prev.fundraisingPlan,
        rounds: prev.fundraisingPlan.rounds.filter((_, i) => i !== index)
      }
    }));
  }

  function updateMilestone(index: number, updater: (milestone: MilestoneDefinition) => MilestoneDefinition) {
    setModel((prev) => ({
      ...prev,
      milestones: prev.milestones.map((milestone, i) => (i === index ? updater(milestone) : milestone))
    }));
  }

  function addMilestone(type: MilestoneType) {
    const created: MilestoneDefinition = {
      type,
      month: type === "ARR_BY_MONTH" ? 24 : 30,
      threshold: type === "ARR_BY_MONTH" ? 1000000 : 0
    };

    setModel((prev) => ({
      ...prev,
      milestones: [...prev.milestones, created]
    }));
  }

  function removeMilestone(index: number) {
    setModel((prev) => ({
      ...prev,
      milestones: prev.milestones.filter((_, i) => i !== index)
    }));
  }

  function updateSelectedDistribution(updater: (dist: DistributionDefinition) => DistributionDefinition) {
    if (!selectedDistributionId) return;
    setModel((prev) => updateDistribution(prev, selectedDistributionId, updater));
  }

  function addDistribution() {
    const id = `dist_${Date.now()}`;
    const created: DistributionDefinition = {
      id,
      name: "New Distribution",
      type: "normal",
      params: { mean: 0, std: 1 }
    };
    setModel((prev) => ({ ...prev, distributions: [...prev.distributions, created] }));
    setSelectedDistributionId(id);
  }

  function removeSelectedDistribution() {
    if (!selectedDistributionId) return;
    const reservedIds = [
      model.revenueModel.momGrowthDistributionId,
      model.revenueModel.churnDistributionId,
      model.revenueModel.arpuDistributionId,
      model.costModel.variableCostPerUserDistributionId
    ];
    if (reservedIds.includes(selectedDistributionId)) {
      setStatus("Cannot remove distribution currently referenced by model inputs.");
      return;
    }
    setModel((prev) => ({
      ...prev,
      distributions: prev.distributions.filter((d) => d.id !== selectedDistributionId)
    }));
  }

  function renderDistributionParams(dist: DistributionDefinition) {
    const paramKeys = Array.from(new Set([...Object.keys(dist.params), "mean", "std", "logMean", "logStd", "alpha", "beta", "min", "mode", "max"]));
    const allowedByType: Record<DistributionDefinition["type"], string[]> = {
      normal: ["mean", "std"],
      lognormal: ["logMean", "logStd"],
      beta: ["alpha", "beta", "min", "max"],
      triangular: ["min", "mode", "max"],
      uniform: ["min", "max"],
      discrete: []
    };
    const keys = paramKeys.filter((key) => allowedByType[dist.type].includes(key));
    if (keys.length === 0) return null;
    return (
      <div className="grid gap-2 md:grid-cols-3">
        {keys.map((key) => (
          <label key={key} className="text-sm">
            {key}
            <input
              type="number"
              step="0.01"
              value={dist.params[key] ?? 0}
              onChange={(e) =>
                updateSelectedDistribution((d) => ({
                  ...d,
                  params: {
                    ...d.params,
                    [key]: Number(e.target.value)
                  }
                }))
              }
              className="mt-1 w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2"
            />
          </label>
        ))}
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Model Builder</h1>
        <p className="text-sm text-slate-700 dark:text-slate-300">Structured editing aligned to PRD sections, with full JSON override support.</p>
      </header>

      <div className="flex flex-wrap gap-3">
        <button onClick={handleSave} className="rounded bg-sky-500 px-3 py-2 text-sm font-medium text-slate-950">
          Save Model
        </button>
        <button onClick={resetTemplate} className="rounded border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm">
          Reset to Template
        </button>
        <select
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
        >
          {modelTemplates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
        <button onClick={applyTemplate} className="rounded border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm">
          Apply Template
        </button>
        <input
          value={activeModelId}
          onChange={(e) => setActiveModelId(e.target.value)}
          placeholder="model id"
          className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
        />
        <button onClick={handleLoadById} className="rounded border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm">
          Load by ID
        </button>
        <span className="text-xs text-slate-600 dark:text-slate-400">{status}</span>
      </div>

      {warnings.length > 0 && (
        <div className="rounded border border-amber-700/50 bg-amber-950/20 p-3">
          <h2 className="text-sm font-semibold text-amber-200">Validation Warnings</h2>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-amber-100/90">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`rounded border px-3 py-2 text-sm ${
              activeTab === tab.id ? "border-sky-500 bg-sky-500/10" : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "basics" && (
        <div className="grid gap-3 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 md:grid-cols-5">
          <label className="text-sm">
            Model Name
            <input name="name" value={model.name} onChange={handleBasicsChange} className="mt-1 w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2" />
          </label>
          <label className="text-sm">
            Horizon (months)
            <input
              name="timeHorizonMonths"
              type="number"
              min={12}
              max={60}
              value={model.timeHorizonMonths}
              onChange={handleBasicsChange}
              className={`mt-1 w-full rounded border bg-slate-100 dark:bg-slate-950 p-2 ${horizonInvalid ? "border-red-500" : "border-slate-300 dark:border-slate-700"}`}
            />
            {horizonInvalid && <p className="mt-1 text-xs text-red-400">Must be between 12 and 60 months.</p>}
          </label>
          <label className="text-sm">
            Initial Cash
            <input
              name="initialCash"
              type="number"
              min={0}
              value={model.initialCash}
              onChange={handleBasicsChange}
              className={`mt-1 w-full rounded border bg-slate-100 dark:bg-slate-950 p-2 ${initialCashInvalid ? "border-red-500" : "border-slate-300 dark:border-slate-700"}`}
            />
            {initialCashInvalid && <p className="mt-1 text-xs text-red-400">Initial cash cannot be negative.</p>}
          </label>
          <label className="text-sm">
            Starting Users
            <input
              name="startingUsers"
              type="number"
              min={0}
              value={model.startingUsers}
              onChange={handleBasicsChange}
              className="mt-1 w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2"
            />
          </label>
          <label className="text-sm">
            Starting MRR
            <input
              name="startingMrr"
              type="number"
              min={0}
              value={model.startingMrr}
              onChange={handleBasicsChange}
              className="mt-1 w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2"
            />
          </label>
        </div>
      )}

      {activeTab === "revenue" && (
        <div className="grid gap-3 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 md:grid-cols-2">
          <label className="text-sm md:col-span-2">
            Growth Mode
            <select
              value={model.revenueModel.growthMode}
              onChange={(e) =>
                setModel((prev) => ({
                  ...prev,
                  revenueModel: {
                    ...prev.revenueModel,
                    growthMode: e.target.value as StartupModel["revenueModel"]["growthMode"]
                  }
                }))
              }
              className="mt-1 w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2"
            >
              <option value="top_down">top_down</option>
              <option value="funnel">funnel</option>
            </select>
          </label>
          <label className="text-sm">
            Growth logMean
            <input
              type="number"
              step="0.01"
              value={growthDist?.params.logMean ?? 0}
              onChange={(e) => setModel((prev) => updateDistributionParam(prev, prev.revenueModel.momGrowthDistributionId, "logMean", Number(e.target.value)))}
              className="mt-1 w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2"
            />
          </label>
          <label className="text-sm">
            Growth logStd
            <input
              type="number"
              step="0.01"
              value={growthDist?.params.logStd ?? 0}
              onChange={(e) => setModel((prev) => updateDistributionParam(prev, prev.revenueModel.momGrowthDistributionId, "logStd", Number(e.target.value)))}
              className="mt-1 w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2"
            />
          </label>

          <label className="text-sm">
            Churn alpha
            <input
              type="number"
              step="0.1"
              value={churnDist?.params.alpha ?? 0}
              onChange={(e) => setModel((prev) => updateDistributionParam(prev, prev.revenueModel.churnDistributionId, "alpha", Number(e.target.value)))}
              className="mt-1 w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2"
            />
          </label>
          <label className="text-sm">
            Churn beta
            <input
              type="number"
              step="0.1"
              value={churnDist?.params.beta ?? 0}
              onChange={(e) => setModel((prev) => updateDistributionParam(prev, prev.revenueModel.churnDistributionId, "beta", Number(e.target.value)))}
              className="mt-1 w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2"
            />
          </label>

          <label className="text-sm">
            ARPU mean
            <input
              type="number"
              step="1"
              value={arpuDist?.params.mean ?? 0}
              onChange={(e) => setModel((prev) => updateDistributionParam(prev, prev.revenueModel.arpuDistributionId, "mean", Number(e.target.value)))}
              className="mt-1 w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2"
            />
          </label>
          <label className="text-sm">
            ARPU std
            <input
              type="number"
              step="1"
              value={arpuDist?.params.std ?? 0}
              onChange={(e) => setModel((prev) => updateDistributionParam(prev, prev.revenueModel.arpuDistributionId, "std", Number(e.target.value)))}
              className="mt-1 w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2"
            />
          </label>

          {model.revenueModel.cacDistributionId && (
            <>
              <label className="text-sm">
                CAC mean
                <input
                  type="number"
                  step="1"
                  value={cacDist?.params.mean ?? 0}
                  onChange={(e) =>
                    setModel((prev) =>
                      updateDistributionParam(prev, prev.revenueModel.cacDistributionId as string, "mean", Number(e.target.value))
                    )
                  }
                  className="mt-1 w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2"
                />
              </label>
              <label className="text-sm">
                CAC std
                <input
                  type="number"
                  step="1"
                  value={cacDist?.params.std ?? 0}
                  onChange={(e) =>
                    setModel((prev) =>
                      updateDistributionParam(prev, prev.revenueModel.cacDistributionId as string, "std", Number(e.target.value))
                    )
                  }
                  className="mt-1 w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2"
                />
              </label>
            </>
          )}

          <div className="md:col-span-2 rounded border border-slate-200 dark:border-slate-800 p-3">
            <h3 className="text-sm font-semibold">Funnel Settings</h3>
            <div className="mt-2 grid gap-2 md:grid-cols-3">
              <label className="text-sm">
                Visitors dist ID
                <input
                  value={model.revenueModel.funnel?.visitorsDistributionId ?? ""}
                  onChange={(e) =>
                    setModel((prev) => ({
                      ...prev,
                      revenueModel: {
                        ...prev.revenueModel,
                        funnel: {
                          visitorsDistributionId: e.target.value,
                          signupRateDistributionId: prev.revenueModel.funnel?.signupRateDistributionId ?? "dist_signup_rate",
                          activationRateDistributionId: prev.revenueModel.funnel?.activationRateDistributionId ?? "dist_activation_rate"
                        }
                      }
                    }))
                  }
                  className="mt-1 w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2"
                />
              </label>
              <label className="text-sm">
                Signup rate dist ID
                <input
                  value={model.revenueModel.funnel?.signupRateDistributionId ?? ""}
                  onChange={(e) =>
                    setModel((prev) => ({
                      ...prev,
                      revenueModel: {
                        ...prev.revenueModel,
                        funnel: {
                          visitorsDistributionId: prev.revenueModel.funnel?.visitorsDistributionId ?? "dist_visitors",
                          signupRateDistributionId: e.target.value,
                          activationRateDistributionId: prev.revenueModel.funnel?.activationRateDistributionId ?? "dist_activation_rate"
                        }
                      }
                    }))
                  }
                  className="mt-1 w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2"
                />
              </label>
              <label className="text-sm">
                Activation dist ID
                <input
                  value={model.revenueModel.funnel?.activationRateDistributionId ?? ""}
                  onChange={(e) =>
                    setModel((prev) => ({
                      ...prev,
                      revenueModel: {
                        ...prev.revenueModel,
                        funnel: {
                          visitorsDistributionId: prev.revenueModel.funnel?.visitorsDistributionId ?? "dist_visitors",
                          signupRateDistributionId: prev.revenueModel.funnel?.signupRateDistributionId ?? "dist_signup_rate",
                          activationRateDistributionId: e.target.value
                        }
                      }
                    }))
                  }
                  className="mt-1 w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2"
                />
              </label>
            </div>
          </div>

          <div className="md:col-span-2 rounded border border-slate-200 dark:border-slate-800 p-3">
            <h3 className="text-sm font-semibold">Expansion Revenue</h3>
            <div className="mt-2 grid gap-2 md:grid-cols-3">
              <label className="text-sm">
                Enabled
                <select
                  value={model.revenueModel.expansion?.enabled ? "true" : "false"}
                  onChange={(e) =>
                    setModel((prev) => ({
                      ...prev,
                      revenueModel: {
                        ...prev.revenueModel,
                        expansion: {
                          enabled: e.target.value === "true",
                          upgradeFractionDistributionId: prev.revenueModel.expansion?.upgradeFractionDistributionId ?? "dist_upgrade_fraction",
                          additionalArpuDistributionId: prev.revenueModel.expansion?.additionalArpuDistributionId ?? "dist_expansion_arpu"
                        }
                      }
                    }))
                  }
                  className="mt-1 w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2"
                >
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              </label>
              <label className="text-sm">
                Upgrade fraction dist ID
                <input
                  value={model.revenueModel.expansion?.upgradeFractionDistributionId ?? ""}
                  onChange={(e) =>
                    setModel((prev) => ({
                      ...prev,
                      revenueModel: {
                        ...prev.revenueModel,
                        expansion: {
                          enabled: prev.revenueModel.expansion?.enabled ?? true,
                          upgradeFractionDistributionId: e.target.value,
                          additionalArpuDistributionId: prev.revenueModel.expansion?.additionalArpuDistributionId ?? "dist_expansion_arpu"
                        }
                      }
                    }))
                  }
                  className="mt-1 w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2"
                />
              </label>
              <label className="text-sm">
                Additional ARPU dist ID
                <input
                  value={model.revenueModel.expansion?.additionalArpuDistributionId ?? ""}
                  onChange={(e) =>
                    setModel((prev) => ({
                      ...prev,
                      revenueModel: {
                        ...prev.revenueModel,
                        expansion: {
                          enabled: prev.revenueModel.expansion?.enabled ?? true,
                          upgradeFractionDistributionId: prev.revenueModel.expansion?.upgradeFractionDistributionId ?? "dist_upgrade_fraction",
                          additionalArpuDistributionId: e.target.value
                        }
                      }
                    }))
                  }
                  className="mt-1 w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2"
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {activeTab === "costs" && (
        <div className="space-y-4 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-sm">
              Fixed Cost (Month 1)
              <input
                type="number"
                value={model.costModel.fixedCosts[0]?.amount ?? 0}
                onChange={(e) =>
                  setModel((prev) => ({
                    ...prev,
                    costModel: {
                      ...prev.costModel,
                      fixedCosts: [{ month: 1, amount: Number(e.target.value) }]
                    }
                  }))
                }
                className="mt-1 w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2"
              />
            </label>
            <label className="text-sm">
              COGS mean
              <input
                type="number"
                value={cogsDist?.params.mean ?? 0}
                onChange={(e) => setModel((prev) => updateDistributionParam(prev, prev.costModel.variableCostPerUserDistributionId, "mean", Number(e.target.value)))}
                className="mt-1 w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2"
              />
            </label>
            <label className="text-sm">
              COGS std
              <input
                type="number"
                value={cogsDist?.params.std ?? 0}
                onChange={(e) => setModel((prev) => updateDistributionParam(prev, prev.costModel.variableCostPerUserDistributionId, "std", Number(e.target.value)))}
                className="mt-1 w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2"
              />
            </label>
            <label className="text-sm">
              Payroll Multiplier
              <input
                type="number"
                step="0.01"
                value={model.costModel.payrollTaxMultiplier ?? 1}
                onChange={(e) =>
                  setModel((prev) => ({
                    ...prev,
                    costModel: { ...prev.costModel, payrollTaxMultiplier: Number(e.target.value) }
                  }))
                }
                className="mt-1 w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2"
              />
            </label>
            <label className="text-sm md:col-span-3">
              Hiring Slippage Distribution ID
              <input
                value={model.costModel.hiringSlippageDistributionId ?? ""}
                onChange={(e) =>
                  setModel((prev) => ({
                    ...prev,
                    costModel: {
                      ...prev.costModel,
                      hiringSlippageDistributionId: e.target.value || undefined
                    }
                  }))
                }
                className="mt-1 w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2"
              />
            </label>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Hiring Plan</h3>
            {model.costModel.hiringPlan.map((item, index) => (
              <div key={`${item.role}-${index}`} className="grid gap-2 md:grid-cols-5">
                <input
                  value={item.role}
                  onChange={(e) =>
                    setModel((prev) => ({
                      ...prev,
                      costModel: {
                        ...prev.costModel,
                        hiringPlan: prev.costModel.hiringPlan.map((x, i) => (i === index ? { ...x, role: e.target.value } : x))
                      }
                    }))
                  }
                  className="rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2 text-sm"
                />
                <input
                  type="number"
                  value={item.month}
                  onChange={(e) =>
                    setModel((prev) => ({
                      ...prev,
                      costModel: {
                        ...prev.costModel,
                        hiringPlan: prev.costModel.hiringPlan.map((x, i) => (i === index ? { ...x, month: Number(e.target.value) } : x))
                      }
                    }))
                  }
                  className="rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2 text-sm"
                />
                <input
                  type="number"
                  value={item.salary}
                  onChange={(e) =>
                    setModel((prev) => ({
                      ...prev,
                      costModel: {
                        ...prev.costModel,
                        hiringPlan: prev.costModel.hiringPlan.map((x, i) => (i === index ? { ...x, salary: Number(e.target.value) } : x))
                      }
                    }))
                  }
                  className="rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2 text-sm"
                />
                <input
                  type="number"
                  value={item.count}
                  onChange={(e) =>
                    setModel((prev) => ({
                      ...prev,
                      costModel: {
                        ...prev.costModel,
                        hiringPlan: prev.costModel.hiringPlan.map((x, i) => (i === index ? { ...x, count: Number(e.target.value) } : x))
                      }
                    }))
                  }
                  className="rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2 text-sm"
                />
                <button
                  onClick={() =>
                    setModel((prev) => ({
                      ...prev,
                      costModel: {
                        ...prev.costModel,
                        hiringPlan: prev.costModel.hiringPlan.filter((_, i) => i !== index)
                      }
                    }))
                  }
                  className="rounded border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs"
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              onClick={() =>
                setModel((prev) => ({
                  ...prev,
                  costModel: {
                    ...prev.costModel,
                    hiringPlan: [...prev.costModel.hiringPlan, { month: 6, role: "New Hire", salary: 10000, count: 1 }]
                  }
                }))
              }
              className="rounded border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm"
            >
              Add Hire
            </button>
          </div>
        </div>
      )}

      {activeTab === "fundraising" && (
        <div className="space-y-4 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="grid gap-3 md:grid-cols-4">
            <label className="text-sm">
              Logistic alpha
              <input
                type="number"
                step="0.1"
                value={model.fundraisingPlan.logisticParams.alpha}
                onChange={(e) =>
                  setModel((prev) => ({
                    ...prev,
                    fundraisingPlan: {
                      ...prev.fundraisingPlan,
                      logisticParams: {
                        ...prev.fundraisingPlan.logisticParams,
                        alpha: Number(e.target.value)
                      }
                    }
                  }))
                }
                className="mt-1 w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2"
              />
            </label>
            <label className="text-sm">
              betaArr
              <input
                type="number"
                step="0.1"
                value={model.fundraisingPlan.logisticParams.betaArr}
                onChange={(e) =>
                  setModel((prev) => ({
                    ...prev,
                    fundraisingPlan: {
                      ...prev.fundraisingPlan,
                      logisticParams: {
                        ...prev.fundraisingPlan.logisticParams,
                        betaArr: Number(e.target.value)
                      }
                    }
                  }))
                }
                className="mt-1 w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2"
              />
            </label>
            <label className="text-sm">
              betaGrowth
              <input
                type="number"
                step="0.1"
                value={model.fundraisingPlan.logisticParams.betaGrowth}
                onChange={(e) =>
                  setModel((prev) => ({
                    ...prev,
                    fundraisingPlan: {
                      ...prev.fundraisingPlan,
                      logisticParams: {
                        ...prev.fundraisingPlan.logisticParams,
                        betaGrowth: Number(e.target.value)
                      }
                    }
                  }))
                }
                className="mt-1 w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2"
              />
            </label>
            <label className="text-sm">
              betaMacro
              <input
                type="number"
                step="0.1"
                value={model.fundraisingPlan.logisticParams.betaMacro}
                onChange={(e) =>
                  setModel((prev) => ({
                    ...prev,
                    fundraisingPlan: {
                      ...prev.fundraisingPlan,
                      logisticParams: {
                        ...prev.fundraisingPlan.logisticParams,
                        betaMacro: Number(e.target.value)
                      }
                    }
                  }))
                }
                className="mt-1 w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2"
              />
            </label>
          </div>

          <div className="space-y-3">
            {model.fundraisingPlan.rounds.map((round, index) => (
              <div key={round.id} className="grid gap-2 rounded border border-slate-200 dark:border-slate-800 p-3 md:grid-cols-6">
                <input
                  value={round.name}
                  onChange={(e) => updateRound(index, (r) => ({ ...r, name: e.target.value }))}
                  className="rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2 text-sm"
                />
                <input
                  type="number"
                  value={round.targetMonth}
                  onChange={(e) => updateRound(index, (r) => ({ ...r, targetMonth: Number(e.target.value) }))}
                  className="rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2 text-sm"
                />
                <input
                  type="number"
                  value={round.targetAmount}
                  onChange={(e) => updateRound(index, (r) => ({ ...r, targetAmount: Number(e.target.value) }))}
                  className="rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2 text-sm"
                />
                <input
                  type="number"
                  value={round.preMoneyValuation}
                  onChange={(e) => updateRound(index, (r) => ({ ...r, preMoneyValuation: Number(e.target.value) }))}
                  className="rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2 text-sm"
                />
                <input
                  value={round.amountDistributionId ?? ""}
                  placeholder="amount dist id"
                  onChange={(e) => updateRound(index, (r) => ({ ...r, amountDistributionId: e.target.value || undefined }))}
                  className="rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2 text-sm"
                />
                <input
                  value={round.closeProbabilityDistributionId ?? ""}
                  placeholder="close prob dist id"
                  onChange={(e) => updateRound(index, (r) => ({ ...r, closeProbabilityDistributionId: e.target.value || undefined }))}
                  className="rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2 text-sm"
                />
                <input
                  type="number"
                  value={round.requiredArrMin ?? 0}
                  placeholder="required ARR min"
                  onChange={(e) => updateRound(index, (r) => ({ ...r, requiredArrMin: Number(e.target.value) }))}
                  className="rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2 text-sm"
                />
                <input
                  type="number"
                  step="0.01"
                  value={round.requiredGrowthMin ?? 1}
                  placeholder="required growth min"
                  onChange={(e) => updateRound(index, (r) => ({ ...r, requiredGrowthMin: Number(e.target.value) }))}
                  className="rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2 text-sm"
                />
                <select
                  value={round.fallbackBridgeRound?.enabled ? "true" : "false"}
                  onChange={(e) =>
                    updateRound(index, (r) => ({
                      ...r,
                      fallbackBridgeRound: {
                        enabled: e.target.value === "true",
                        amountDistributionId: r.fallbackBridgeRound?.amountDistributionId ?? "dist_bridge_amount",
                        valuationMultiplierDistributionId: r.fallbackBridgeRound?.valuationMultiplierDistributionId ?? "dist_bridge_val_mult",
                        closeLagDistributionId: r.fallbackBridgeRound?.closeLagDistributionId ?? "dist_bridge_close_lag"
                      }
                    }))
                  }
                  className="rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2 text-sm"
                >
                  <option value="false">bridge off</option>
                  <option value="true">bridge on</option>
                </select>
                <button onClick={() => removeRound(index)} className="rounded border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs">
                  Remove
                </button>
              </div>
            ))}
            <button onClick={addRound} className="rounded border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm">
              Add Round
            </button>
          </div>
        </div>
      )}

      {activeTab === "macro" && (
        <div className="space-y-4 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="grid gap-3 md:grid-cols-5">
            <label className="text-sm">
              rho
              <input
                type="number"
                step="0.01"
                value={model.macroModel.rho}
                onChange={(e) => setModel((prev) => ({ ...prev, macroModel: { ...prev.macroModel, rho: Number(e.target.value) } }))}
                className="mt-1 w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2"
              />
            </label>
            <label className="text-sm">
              sigma
              <input
                type="number"
                step="0.01"
                value={model.macroModel.sigma}
                onChange={(e) => setModel((prev) => ({ ...prev, macroModel: { ...prev.macroModel, sigma: Number(e.target.value) } }))}
                className="mt-1 w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2"
              />
            </label>
            <label className="text-sm">
              gammaGrowth
              <input
                type="number"
                step="0.01"
                value={model.macroModel.gammaGrowth}
                onChange={(e) => setModel((prev) => ({ ...prev, macroModel: { ...prev.macroModel, gammaGrowth: Number(e.target.value) } }))}
                className="mt-1 w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2"
              />
            </label>
            <label className="text-sm">
              gammaChurn
              <input
                type="number"
                step="0.01"
                value={model.macroModel.gammaChurn}
                onChange={(e) => setModel((prev) => ({ ...prev, macroModel: { ...prev.macroModel, gammaChurn: Number(e.target.value) } }))}
                className="mt-1 w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2"
              />
            </label>
            <label className="text-sm">
              gammaCac
              <input
                type="number"
                step="0.01"
                value={model.macroModel.gammaCac}
                onChange={(e) => setModel((prev) => ({ ...prev, macroModel: { ...prev.macroModel, gammaCac: Number(e.target.value) } }))}
                className="mt-1 w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2"
              />
            </label>
            <label className="text-sm">
              Shock Enabled
              <select
                value={model.macroModel.shock?.enabled ? "true" : "false"}
                onChange={(e) =>
                  setModel((prev) => ({
                    ...prev,
                    macroModel: {
                      ...prev.macroModel,
                      shock: {
                        enabled: e.target.value === "true",
                        monthlyProbability: prev.macroModel.shock?.monthlyProbability ?? 0.02,
                        impactDistributionId: prev.macroModel.shock?.impactDistributionId ?? "dist_macro_shock_impact",
                        durationMonths: prev.macroModel.shock?.durationMonths ?? 3
                      }
                    }
                  }))
                }
                className="mt-1 w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2"
              >
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            </label>
            <label className="text-sm">
              Shock Monthly Probability
              <input
                type="number"
                step="0.001"
                value={model.macroModel.shock?.monthlyProbability ?? 0.02}
                onChange={(e) =>
                  setModel((prev) => ({
                    ...prev,
                    macroModel: {
                      ...prev.macroModel,
                      shock: {
                        enabled: prev.macroModel.shock?.enabled ?? true,
                        monthlyProbability: Number(e.target.value),
                        impactDistributionId: prev.macroModel.shock?.impactDistributionId ?? "dist_macro_shock_impact",
                        durationMonths: prev.macroModel.shock?.durationMonths ?? 3
                      }
                    }
                  }))
                }
                className="mt-1 w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2"
              />
            </label>
            <label className="text-sm">
              Shock Impact Dist ID
              <input
                value={model.macroModel.shock?.impactDistributionId ?? "dist_macro_shock_impact"}
                onChange={(e) =>
                  setModel((prev) => ({
                    ...prev,
                    macroModel: {
                      ...prev.macroModel,
                      shock: {
                        enabled: prev.macroModel.shock?.enabled ?? true,
                        monthlyProbability: prev.macroModel.shock?.monthlyProbability ?? 0.02,
                        impactDistributionId: e.target.value,
                        durationMonths: prev.macroModel.shock?.durationMonths ?? 3
                      }
                    }
                  }))
                }
                className="mt-1 w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2"
              />
            </label>
            <label className="text-sm">
              Shock Duration (months)
              <input
                type="number"
                value={model.macroModel.shock?.durationMonths ?? 3}
                onChange={(e) =>
                  setModel((prev) => ({
                    ...prev,
                    macroModel: {
                      ...prev.macroModel,
                      shock: {
                        enabled: prev.macroModel.shock?.enabled ?? true,
                        monthlyProbability: prev.macroModel.shock?.monthlyProbability ?? 0.02,
                        impactDistributionId: prev.macroModel.shock?.impactDistributionId ?? "dist_macro_shock_impact",
                        durationMonths: Number(e.target.value)
                      }
                    }
                  }))
                }
                className="mt-1 w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2"
              />
            </label>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Correlation Matrix</h3>
            <textarea
              value={JSON.stringify(model.correlation?.matrix ?? [], null, 2)}
              onChange={(e) => {
                try {
                  const matrix = JSON.parse(e.target.value) as number[][];
                  setModel((prev) => ({ ...prev, correlation: prev.correlation ? { ...prev.correlation, matrix } : undefined }));
                } catch {
                  // keep invalid JSON local until fixed
                }
              }}
              className="h-44 w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2 font-mono text-xs"
            />
          </div>
        </div>
      )}

      {activeTab === "milestones" && (
        <div className="space-y-4 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          {model.milestones.map((milestone, index) => (
            <div key={`${milestone.type}-${index}`} className="grid gap-2 md:grid-cols-4">
              <select
                value={milestone.type}
                onChange={(e) => updateMilestone(index, (m) => ({ ...m, type: e.target.value as MilestoneType }))}
                className="rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2 text-sm"
              >
                <option value="ARR_BY_MONTH">ARR_BY_MONTH</option>
                <option value="PROFITABILITY_BY_MONTH">PROFITABILITY_BY_MONTH</option>
              </select>
              <input
                type="number"
                value={milestone.month}
                onChange={(e) => updateMilestone(index, (m) => ({ ...m, month: Number(e.target.value) }))}
                className="rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2 text-sm"
              />
              <input
                type="number"
                value={milestone.threshold}
                onChange={(e) => updateMilestone(index, (m) => ({ ...m, threshold: Number(e.target.value) }))}
                className="rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2 text-sm"
              />
              <button onClick={() => removeMilestone(index)} className="rounded border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs">
                Remove
              </button>
            </div>
          ))}

          <div className="flex gap-2">
            <button onClick={() => addMilestone("ARR_BY_MONTH")} className="rounded border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm">
              Add ARR Milestone
            </button>
            <button
              onClick={() => addMilestone("PROFITABILITY_BY_MONTH")}
              className="rounded border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm"
            >
              Add Profitability Milestone
            </button>
          </div>
        </div>
      )}

      {activeTab === "uncertainty" && (
        <div className="grid gap-4 md:grid-cols-[280px_1fr]">
          <aside className="space-y-2 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
            <div className="flex gap-2">
              <button onClick={addDistribution} className="rounded border border-slate-300 dark:border-slate-700 px-2 py-1 text-xs">
                Add
              </button>
              <button onClick={removeSelectedDistribution} className="rounded border border-slate-300 dark:border-slate-700 px-2 py-1 text-xs">
                Remove
              </button>
            </div>
            {model.distributions.map((dist) => (
              <button
                key={dist.id}
                onClick={() => setSelectedDistributionId(dist.id)}
                className={`w-full rounded border px-3 py-2 text-left text-sm ${
                  selectedDistributionId === dist.id ? "border-sky-500 bg-sky-500/10" : "border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950"
                }`}
              >
                <div className="font-medium">{dist.name}</div>
                <div className="text-xs text-slate-600 dark:text-slate-400">{dist.id}</div>
                <div className="text-xs text-slate-600 dark:text-slate-400">{dist.type}</div>
              </button>
            ))}
          </aside>

          <div className="space-y-4 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            {(() => {
              const dist = model.distributions.find((d) => d.id === selectedDistributionId);
              if (!dist) return <p className="text-sm text-slate-700 dark:text-slate-300">Select a distribution.</p>;
              return (
                <>
                  <div className="grid gap-3 md:grid-cols-3">
                    <label className="text-sm">
                      Name
                      <input
                        value={dist.name}
                        onChange={(e) => updateSelectedDistribution((d) => ({ ...d, name: e.target.value }))}
                        className="mt-1 w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2"
                      />
                    </label>
                    <label className="text-sm">
                      ID
                      <input
                        value={dist.id}
                        onChange={(e) => {
                          const nextId = e.target.value.trim();
                          if (!nextId) return;
                          setModel((prev) => ({
                            ...prev,
                            distributions: prev.distributions.map((d) => (d.id === dist.id ? { ...d, id: nextId } : d)),
                            revenueModel: {
                              ...prev.revenueModel,
                              momGrowthDistributionId:
                                prev.revenueModel.momGrowthDistributionId === dist.id ? nextId : prev.revenueModel.momGrowthDistributionId,
                              churnDistributionId:
                                prev.revenueModel.churnDistributionId === dist.id ? nextId : prev.revenueModel.churnDistributionId,
                              arpuDistributionId:
                                prev.revenueModel.arpuDistributionId === dist.id ? nextId : prev.revenueModel.arpuDistributionId
                            },
                            costModel: {
                              ...prev.costModel,
                              variableCostPerUserDistributionId:
                                prev.costModel.variableCostPerUserDistributionId === dist.id
                                  ? nextId
                                  : prev.costModel.variableCostPerUserDistributionId
                            }
                          }));
                          setSelectedDistributionId(nextId);
                        }}
                        className="mt-1 w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2"
                      />
                    </label>
                    <label className="text-sm">
                      Type
                      <select
                        value={dist.type}
                        onChange={(e) =>
                          updateSelectedDistribution((d) => ({
                            ...d,
                            type: e.target.value as DistributionDefinition["type"],
                            params: defaultParamsForDistributionType(
                              e.target.value as DistributionDefinition["type"]
                            )
                          }))
                        }
                        className="mt-1 w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2"
                      >
                        <option value="normal">normal</option>
                        <option value="lognormal">lognormal</option>
                        <option value="beta">beta</option>
                        <option value="triangular">triangular</option>
                        <option value="uniform">uniform</option>
                        <option value="discrete">discrete</option>
                      </select>
                    </label>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="text-sm">
                      Clamp Min
                      <input
                        type="number"
                        value={dist.clampMin ?? ""}
                        onChange={(e) =>
                          updateSelectedDistribution((d) => ({
                            ...d,
                            clampMin: e.target.value === "" ? undefined : Number(e.target.value)
                          }))
                        }
                        className="mt-1 w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2"
                      />
                    </label>
                    <label className="text-sm">
                      Clamp Max
                      <input
                        type="number"
                        value={dist.clampMax ?? ""}
                        onChange={(e) =>
                          updateSelectedDistribution((d) => ({
                            ...d,
                            clampMax: e.target.value === "" ? undefined : Number(e.target.value)
                          }))
                        }
                        className="mt-1 w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2"
                      />
                    </label>
                  </div>

                  {renderDistributionParams(dist)}

                  {dist.type === "discrete" && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold">Discrete Values</h3>
                      {(dist.discreteValues ?? []).map((row, index) => (
                        <div key={index} className="grid gap-2 md:grid-cols-3">
                          <input
                            type="number"
                            value={row.value}
                            onChange={(e) =>
                              updateSelectedDistribution((d) => ({
                                ...d,
                                discreteValues: (d.discreteValues ?? []).map((x, i) =>
                                  i === index ? { ...x, value: Number(e.target.value) } : x
                                )
                              }))
                            }
                            className="rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2 text-sm"
                          />
                          <input
                            type="number"
                            step="0.01"
                            value={row.probability}
                            onChange={(e) =>
                              updateSelectedDistribution((d) => ({
                                ...d,
                                discreteValues: (d.discreteValues ?? []).map((x, i) =>
                                  i === index ? { ...x, probability: Number(e.target.value) } : x
                                )
                              }))
                            }
                            className="rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2 text-sm"
                          />
                          <button
                            onClick={() =>
                              updateSelectedDistribution((d) => ({
                                ...d,
                                discreteValues: (d.discreteValues ?? []).filter((_, i) => i !== index)
                              }))
                            }
                            className="rounded border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            updateSelectedDistribution((d) => ({
                              ...d,
                              discreteValues: [...(d.discreteValues ?? []), { value: 0, probability: 0.5 }]
                            }))
                          }
                          className="rounded border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm"
                        >
                          Add Row
                        </button>
                        <button
                          onClick={() =>
                            updateSelectedDistribution((d) => {
                              const values = d.discreteValues ?? [];
                              const total = values.reduce((sum, x) => sum + x.probability, 0);
                              if (total <= 0) return d;
                              return {
                                ...d,
                                discreteValues: values.map((x) => ({ ...x, probability: x.probability / total }))
                              };
                            })
                          }
                          className="rounded border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm"
                        >
                          Normalize Probabilities
                        </button>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {activeTab === "advanced" && (
        <div className="space-y-2">
          <textarea
            value={jsonText}
            onChange={(event) => setJsonText(event.target.value)}
            className="h-[560px] w-full rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 font-mono text-xs"
          />
          <div className="flex items-center gap-3">
            <button onClick={handleSaveFromJson} className="rounded border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm">
              Save Advanced JSON
            </button>
            {!parsed.ok && <p className="text-sm text-red-400">Parse error: {parsed.error}</p>}
          </div>
        </div>
      )}
    </section>
  );
}
