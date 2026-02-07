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

const models = new Map<string, ModelRecord>();
const simulations = new Map<string, SimulationRecord>();

export const store = {
  models,
  simulations
};

export type { ModelRecord, SimulationRecord };
