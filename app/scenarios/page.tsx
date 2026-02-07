"use client";

import { useEffect, useMemo, useState } from "react";
import { defaultScenarios } from "@/lib/domain/defaults";
import { loadProjectState, saveProjectState } from "@/lib/domain/local-storage";
import { ScenarioDefinition } from "@/lib/domain/types";

function cloneScenario(source: ScenarioDefinition): ScenarioDefinition {
  return {
    ...source,
    id: `${source.id}_copy_${Date.now()}`,
    name: `${source.name} Copy`,
    distributionParamOverrides: source.distributionParamOverrides
      ? JSON.parse(JSON.stringify(source.distributionParamOverrides))
      : undefined,
    macroOverrides: source.macroOverrides ? JSON.parse(JSON.stringify(source.macroOverrides)) : undefined,
    correlationOverride: source.correlationOverride
      ? JSON.parse(JSON.stringify(source.correlationOverride))
      : undefined,
    correlationsByMonthOverride: source.correlationsByMonthOverride
      ? JSON.parse(JSON.stringify(source.correlationsByMonthOverride))
      : undefined
  };
}

export default function ScenariosPage() {
  const [scenarios, setScenarios] = useState<ScenarioDefinition[]>(defaultScenarios);
  const [selectedId, setSelectedId] = useState<string>(defaultScenarios[0]?.id ?? "");
  const [jsonText, setJsonText] = useState<string>(JSON.stringify(defaultScenarios, null, 2));
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [status, setStatus] = useState<string>("Ready");
  const [overrideDistId, setOverrideDistId] = useState<string>("");
  const [overrideParamKey, setOverrideParamKey] = useState<string>("mean");
  const [overrideParamValue, setOverrideParamValue] = useState<string>("0");

  useEffect(() => {
    const state = loadProjectState();
    setScenarios(state.scenarios.length > 0 ? state.scenarios : defaultScenarios);
    setSelectedId((state.scenarios[0] ?? defaultScenarios[0])?.id ?? "");
  }, []);

  useEffect(() => {
    setJsonText(JSON.stringify(scenarios, null, 2));
  }, [scenarios]);

  const selectedScenario = useMemo(() => scenarios.find((s) => s.id === selectedId) ?? null, [scenarios, selectedId]);

  const parsedJson = useMemo(() => {
    try {
      return { ok: true as const, value: JSON.parse(jsonText) as ScenarioDefinition[] };
    } catch (error) {
      return { ok: false as const, error: String(error) };
    }
  }, [jsonText]);
  const warnings = useMemo(() => {
    const issues: string[] = [];
    const ids = new Set<string>();
    let enabledCount = 0;
    for (const scenario of scenarios) {
      if (ids.has(scenario.id)) issues.push(`Duplicate scenario id: ${scenario.id}`);
      ids.add(scenario.id);
      if (scenario.enabled !== false) enabledCount += 1;
      const rho = scenario.macroOverrides?.rho;
      const sigma = scenario.macroOverrides?.sigma;
      if (rho !== undefined && (rho < -0.999 || rho > 0.999)) {
        issues.push(`Scenario '${scenario.name}' has rho override outside [-0.999, 0.999].`);
      }
      if (sigma !== undefined && sigma < 0) {
        issues.push(`Scenario '${scenario.name}' has negative sigma override.`);
      }
    }
    if (enabledCount === 0) issues.push("At least one scenario should be enabled.");
    return issues;
  }, [scenarios]);
  const modelDistributions = useMemo(() => loadProjectState().model.distributions, []);

  function updateScenario(id: string, updater: (scenario: ScenarioDefinition) => ScenarioDefinition) {
    setScenarios((prev) => prev.map((s) => (s.id === id ? updater(s) : s)));
  }

  function addScenario() {
    const created: ScenarioDefinition = {
      id: `scenario_${Date.now()}`,
      name: `Custom ${scenarios.length + 1}`,
      enabled: true,
      distributionParamOverrides: {},
      macroOverrides: {}
    };
    setScenarios((prev) => [...prev, created]);
    setSelectedId(created.id);
  }

  function duplicateSelected() {
    if (!selectedScenario) return;
    const cloned = cloneScenario(selectedScenario);
    setScenarios((prev) => [...prev, cloned]);
    setSelectedId(cloned.id);
  }

  function deleteSelected() {
    if (!selectedScenario) return;
    if (scenarios.length <= 1) {
      setStatus("At least one scenario is required.");
      return;
    }
    const next = scenarios.filter((s) => s.id !== selectedScenario.id);
    setScenarios(next);
    setSelectedId(next[0].id);
  }

  function handleSave() {
    const existing = loadProjectState();
    saveProjectState({ model: existing.model, scenarios });
    setStatus(`Saved ${scenarios.length} scenario(s) locally at ${new Date().toLocaleTimeString()}`);
  }

  function resetTemplate() {
    const existing = loadProjectState();
    saveProjectState({ model: existing.model, scenarios: defaultScenarios });
    setScenarios(defaultScenarios);
    setSelectedId(defaultScenarios[0]?.id ?? "");
    setStatus("Reset scenarios to template set.");
  }

  function applyJson() {
    if (!parsedJson.ok) {
      setStatus("Invalid JSON. Fix errors first.");
      return;
    }
    if (parsedJson.value.length === 0) {
      setStatus("Need at least one scenario.");
      return;
    }
    setScenarios(parsedJson.value);
    setSelectedId(parsedJson.value[0].id);
    setStatus("Applied JSON scenarios.");
  }

  function addDistributionOverride() {
    if (!selectedScenario) return;
    const distId = overrideDistId.trim();
    const paramKey = overrideParamKey.trim();
    const value = Number(overrideParamValue);
    if (!distId || !paramKey || !Number.isFinite(value)) {
      setStatus("Provide valid distribution override inputs.");
      return;
    }

    updateScenario(selectedScenario.id, (scenario) => ({
      ...scenario,
      distributionParamOverrides: {
        ...(scenario.distributionParamOverrides ?? {}),
        [distId]: {
          ...(scenario.distributionParamOverrides?.[distId] ?? {}),
          [paramKey]: value
        }
      }
    }));
    setStatus(`Added override ${distId}.${paramKey} = ${value}`);
  }

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Scenario Manager</h1>
        <p className="text-sm text-slate-700 dark:text-slate-300">Structured editor for common flows with optional advanced JSON mode.</p>
      </header>

      <div className="flex flex-wrap gap-3">
        <button onClick={handleSave} className="rounded bg-sky-500 px-3 py-2 text-sm font-medium text-slate-950">
          Save Scenarios
        </button>
        <button onClick={addScenario} className="rounded border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm">
          Add Scenario
        </button>
        <button onClick={duplicateSelected} className="rounded border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm">
          Duplicate Selected
        </button>
        <button onClick={deleteSelected} className="rounded border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm">
          Delete Selected
        </button>
        <button onClick={resetTemplate} className="rounded border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm">
          Reset to Templates
        </button>
        <button onClick={() => setShowAdvanced((x) => !x)} className="rounded border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm">
          {showAdvanced ? "Hide Advanced JSON" : "Show Advanced JSON"}
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

      <div className="grid gap-4 md:grid-cols-[280px_1fr]">
        <aside className="space-y-2 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
          {scenarios.map((scenario) => (
            <button
              key={scenario.id}
              onClick={() => setSelectedId(scenario.id)}
              className={`w-full rounded border px-3 py-2 text-left text-sm ${
                selectedId === scenario.id
                  ? "border-sky-500 bg-sky-500/10"
                  : "border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 hover:border-slate-400 dark:hover:border-slate-500"
              }`}
            >
              <div className="font-medium">{scenario.name}</div>
              <div className="text-xs text-slate-600 dark:text-slate-400">{scenario.enabled === false ? "Disabled" : "Enabled"}</div>
              {scenarios.filter((x) => x.id === scenario.id).length > 1 && (
                <div className="text-xs text-red-400">Duplicate ID</div>
              )}
            </button>
          ))}
        </aside>

        <div className="space-y-4 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          {selectedScenario ? (
            <>
              <label className="block text-sm">
                Name
                <input
                  value={selectedScenario.name}
                  onChange={(e) => updateScenario(selectedScenario.id, (s) => ({ ...s, name: e.target.value }))}
                  className="mt-1 w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2"
                />
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedScenario.enabled !== false}
                  onChange={(e) => updateScenario(selectedScenario.id, (s) => ({ ...s, enabled: e.target.checked }))}
                />
                Enabled in simulation runs
              </label>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm">
                  Macro Rho Override
                  <input
                    type="number"
                    step="0.01"
                    value={selectedScenario.macroOverrides?.rho ?? ""}
                    placeholder="(inherit base)"
                    onChange={(e) =>
                      updateScenario(selectedScenario.id, (s) => ({
                        ...s,
                        macroOverrides: {
                          ...(s.macroOverrides ?? {}),
                          rho: e.target.value === "" ? undefined : Number(e.target.value)
                        }
                      }))
                    }
                    className="mt-1 w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2"
                  />
                </label>

                <label className="text-sm">
                  Macro Sigma Override
                  <input
                    type="number"
                    step="0.01"
                    value={selectedScenario.macroOverrides?.sigma ?? ""}
                    placeholder="(inherit base)"
                    onChange={(e) =>
                      updateScenario(selectedScenario.id, (s) => ({
                        ...s,
                        macroOverrides: {
                          ...(s.macroOverrides ?? {}),
                          sigma: e.target.value === "" ? undefined : Number(e.target.value)
                        }
                      }))
                    }
                    className="mt-1 w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2"
                  />
                </label>

                <label className="text-sm">
                  Macro Shock Probability Override
                  <input
                    type="number"
                    step="0.001"
                    value={selectedScenario.macroOverrides?.shock?.monthlyProbability ?? ""}
                    placeholder="(inherit base)"
                    onChange={(e) =>
                      updateScenario(selectedScenario.id, (s) => ({
                        ...s,
                        macroOverrides: {
                          ...(s.macroOverrides ?? {}),
                          shock:
                            e.target.value === ""
                              ? undefined
                              : {
                                  enabled: s.macroOverrides?.shock?.enabled ?? true,
                                  monthlyProbability: Number(e.target.value),
                                  impactDistributionId: s.macroOverrides?.shock?.impactDistributionId ?? "dist_macro_shock_impact",
                                  durationMonths: s.macroOverrides?.shock?.durationMonths ?? 3
                                }
                        }
                      }))
                    }
                    className="mt-1 w-full rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 p-2"
                  />
                </label>
              </div>

              <div className="space-y-2 rounded border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 p-3">
                <h3 className="text-sm font-semibold">Correlation Override Matrix</h3>
                <textarea
                  value={JSON.stringify(selectedScenario.correlationOverride?.matrix ?? [], null, 2)}
                  onChange={(e) => {
                    try {
                      const matrix = JSON.parse(e.target.value) as number[][];
                      updateScenario(selectedScenario.id, (s) => ({
                        ...s,
                        correlationOverride: matrix.length > 0 ? { matrix } : undefined
                      }));
                    } catch {
                      // keep draft in textarea-only edits impossible in structured mode
                    }
                  }}
                  className="h-36 w-full rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 font-mono text-xs"
                />
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400">
                Distribution parameter overrides can be edited in advanced JSON mode for full control.
              </p>

              <div className="space-y-2 rounded border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 p-3">
                <h3 className="text-sm font-semibold">Distribution Overrides</h3>
                <div className="grid gap-2 md:grid-cols-4">
                  <select
                    value={overrideDistId}
                    onChange={(e) => setOverrideDistId(e.target.value)}
                    className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-sm"
                  >
                    <option value="">Select Distribution</option>
                    {modelDistributions.map((dist) => (
                      <option key={dist.id} value={dist.id}>
                        {dist.id}
                      </option>
                    ))}
                  </select>
                  <input
                    value={overrideParamKey}
                    onChange={(e) => setOverrideParamKey(e.target.value)}
                    placeholder="param key"
                    className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-sm"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={overrideParamValue}
                    onChange={(e) => setOverrideParamValue(e.target.value)}
                    placeholder="value"
                    className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-sm"
                  />
                  <button onClick={addDistributionOverride} className="rounded border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm">
                    Add Override
                  </button>
                </div>

                <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300">
                  {Object.entries(selectedScenario.distributionParamOverrides ?? {}).flatMap(([distId, params]) =>
                    Object.entries(params).map(([key, value]) => (
                      <li key={`${selectedScenario.id}-${distId}-${key}`} className="flex items-center justify-between gap-2">
                        <span>
                          {distId}.{key} = {value}
                        </span>
                        <button
                          onClick={() =>
                            updateScenario(selectedScenario.id, (scenario) => {
                              const next = { ...(scenario.distributionParamOverrides ?? {}) };
                              const nextParams = { ...(next[distId] ?? {}) };
                              delete nextParams[key];
                              if (Object.keys(nextParams).length === 0) {
                                delete next[distId];
                              } else {
                                next[distId] = nextParams;
                              }
                              return {
                                ...scenario,
                                distributionParamOverrides: next
                              };
                            })
                          }
                          className="rounded border border-slate-300 dark:border-slate-700 px-2 py-1 text-[10px]"
                        >
                          Remove
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-700 dark:text-slate-300">Select a scenario to edit.</p>
          )}
        </div>
      </div>

      {showAdvanced && (
        <div className="space-y-2">
          <textarea
            value={jsonText}
            onChange={(event) => setJsonText(event.target.value)}
            className="h-[420px] w-full rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 font-mono text-xs"
          />
          <div className="flex items-center gap-3">
            <button onClick={applyJson} className="rounded border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm">
              Apply JSON
            </button>
            {!parsedJson.ok && <p className="text-sm text-red-400">Parse error: {parsedJson.error}</p>}
          </div>
        </div>
      )}
    </section>
  );
}
