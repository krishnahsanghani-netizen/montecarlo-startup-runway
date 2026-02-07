import { defaultModel, defaultScenarios } from "@/lib/domain/defaults";
import { ScenarioDefinition, StartupModel } from "@/lib/domain/types";

const PROJECT_STATE_KEY = "mc_lab_project_state_v1";
const ACTIVE_MODEL_ID_KEY = "mc_lab_active_model_id_v1";

export interface ProjectState {
  model: StartupModel;
  scenarios: ScenarioDefinition[];
}

function inBrowser(): boolean {
  return typeof window !== "undefined";
}

export function defaultProjectState(): ProjectState {
  return {
    model: defaultModel,
    scenarios: defaultScenarios
  };
}

export function loadProjectState(): ProjectState {
  if (!inBrowser()) return defaultProjectState();

  const raw = window.localStorage.getItem(PROJECT_STATE_KEY);
  if (!raw) return defaultProjectState();

  try {
    const parsed = JSON.parse(raw) as Partial<ProjectState>;
    return {
      model: parsed.model ?? defaultModel,
      scenarios: parsed.scenarios ?? defaultScenarios
    };
  } catch {
    return defaultProjectState();
  }
}

export function saveProjectState(state: ProjectState): void {
  if (!inBrowser()) return;
  window.localStorage.setItem(PROJECT_STATE_KEY, JSON.stringify(state));
}

export function saveActiveModelId(id: string): void {
  if (!inBrowser()) return;
  window.localStorage.setItem(ACTIVE_MODEL_ID_KEY, id);
}

export function loadActiveModelId(): string | null {
  if (!inBrowser()) return null;
  return window.localStorage.getItem(ACTIVE_MODEL_ID_KEY);
}
