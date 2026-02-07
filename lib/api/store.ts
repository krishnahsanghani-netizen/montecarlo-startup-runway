import { ScenarioDefinition, SimulationOutput, StartupModel } from "@/lib/domain/types";

interface ModelRecord {
  id: string;
  name: string;
  model: StartupModel;
  scenarios: ScenarioDefinition[];
  updatedAt: string;
}

interface SimulationRecord {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  progress: number;
  output?: SimulationOutput;
  error?: string;
  createdAt: string;
  expiresAt?: string;
}

type InMemoryStore = {
  models: Map<string, ModelRecord>;
  simulations: Map<string, SimulationRecord>;
};

declare global {
  var __MONTE_CARLO_STORE__: InMemoryStore | undefined;
}

const globalStore: InMemoryStore =
  globalThis.__MONTE_CARLO_STORE__ ??
  {
    models: new Map<string, ModelRecord>(),
    simulations: new Map<string, SimulationRecord>()
  };

if (!globalThis.__MONTE_CARLO_STORE__) {
  globalThis.__MONTE_CARLO_STORE__ = globalStore;
}

export const store = {
  models: globalStore.models,
  simulations: globalStore.simulations
};

export type { ModelRecord, SimulationRecord };
