import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import { ModelRecord, SimulationRecord, store } from "@/lib/api/store";
import { ScenarioDefinition, SimulationOutput, StartupModel } from "@/lib/domain/types";

export interface DataRepository {
  saveModel(input: { id: string; name: string; model: StartupModel; scenarios: ScenarioDefinition[]; updatedAt: string }): Promise<void>;
  getModel(id: string): Promise<ModelRecord | null>;

  saveSimulation(record: SimulationRecord): Promise<void>;
  getSimulation(id: string): Promise<SimulationRecord | null>;
  deleteSimulation(id: string): Promise<void>;
  listExpiredSimulationIds(nowIso: string): Promise<string[]>;
}

class MemoryRepository implements DataRepository {
  async saveModel(input: { id: string; name: string; model: StartupModel; scenarios: ScenarioDefinition[]; updatedAt: string }) {
    store.models.set(input.id, {
      id: input.id,
      name: input.name,
      model: input.model,
      scenarios: input.scenarios,
      updatedAt: input.updatedAt
    });
  }

  async getModel(id: string) {
    return store.models.get(id) ?? null;
  }

  async saveSimulation(record: SimulationRecord) {
    store.simulations.set(record.id, record);
  }

  async getSimulation(id: string) {
    return store.simulations.get(id) ?? null;
  }

  async deleteSimulation(id: string) {
    store.simulations.delete(id);
  }

  async listExpiredSimulationIds(nowIso: string) {
    const now = Date.parse(nowIso);
    const ids: string[] = [];
    for (const [id, record] of store.simulations.entries()) {
      if (record.expiresAt && Date.parse(record.expiresAt) < now) {
        ids.push(id);
      }
    }
    return ids;
  }
}

class PrismaRepository implements DataRepository {
  async saveModel(input: { id: string; name: string; model: StartupModel; scenarios: ScenarioDefinition[]; updatedAt: string }) {
    const payload = JSON.parse(
      JSON.stringify({
        model: input.model,
        scenarios: input.scenarios
      })
    ) as Prisma.InputJsonValue;

    await prisma.modelConfig.upsert({
      where: { id: input.id },
      create: {
        id: input.id,
        name: input.name,
        payload
      },
      update: {
        name: input.name,
        payload,
        updatedAt: new Date(input.updatedAt)
      }
    });
  }

  async getModel(id: string) {
    const record = await prisma.modelConfig.findUnique({ where: { id } });
    if (!record) return null;
    const payload = record.payload as unknown as {
      model: StartupModel;
      scenarios?: ScenarioDefinition[];
    };

    return {
      id: record.id,
      name: record.name,
      model: payload.model,
      scenarios: payload.scenarios ?? [],
      updatedAt: record.updatedAt.toISOString()
    };
  }

  async saveSimulation(record: SimulationRecord) {
    const resultPayload = JSON.parse(
      JSON.stringify({
        progress: record.progress,
        output: record.output,
        error: record.error
      })
    ) as Prisma.InputJsonValue;

    await prisma.simulationRun.upsert({
      where: { id: record.id },
      create: {
        id: record.id,
        status: record.status,
        seed: 0,
        nRuns: 0,
        horizonMonths: 0,
        startedAt: new Date(record.createdAt),
        completedAt: record.status === "completed" || record.status === "failed" ? new Date() : null,
        expiresAt: record.expiresAt ? new Date(record.expiresAt) : null,
        resultPayload
      },
      update: {
        status: record.status,
        completedAt: record.status === "completed" || record.status === "failed" ? new Date() : null,
        expiresAt: record.expiresAt ? new Date(record.expiresAt) : null,
        resultPayload
      }
    });
  }

  async getSimulation(id: string) {
    const row = await prisma.simulationRun.findUnique({ where: { id } });
    if (!row) return null;

    const payload = (row.resultPayload ?? {}) as unknown as {
      progress?: number;
      output?: SimulationOutput;
      error?: string;
    };

    return {
      id: row.id,
      status: row.status as SimulationRecord["status"],
      progress: payload.progress ?? 0,
      output: payload.output,
      error: payload.error,
      createdAt: row.startedAt.toISOString(),
      expiresAt: row.expiresAt?.toISOString()
    };
  }

  async deleteSimulation(id: string) {
    await prisma.simulationRun.delete({ where: { id } });
  }

  async listExpiredSimulationIds(nowIso: string) {
    const now = new Date(nowIso);
    const rows = await prisma.simulationRun.findMany({
      where: {
        expiresAt: {
          lt: now
        }
      },
      select: { id: true }
    });
    return rows.map((row) => row.id);
  }
}

let singleton: DataRepository | null = null;

export function getRepository(): DataRepository {
  if (singleton) return singleton;

  if (process.env.DATABASE_URL) {
    singleton = new PrismaRepository();
  } else {
    singleton = new MemoryRepository();
  }

  return singleton;
}
