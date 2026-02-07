import { NextResponse } from "next/server";
import { makeId } from "@/lib/utils/id";
import { getRepository } from "@/lib/api/repository";
import { runSimulation } from "@/lib/sim/engine/run-simulation";
import { simulationRequestSchema } from "@/lib/validation/simulation";
import { SimulationOutput } from "@/lib/domain/types";

const dailyUsage = new Map<string, { date: string; runsUsed: number }>();
const resultCache = new Map<string, { cachedAt: number; output: SimulationOutput }>();

function sessionKey(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for") ?? "";
  return forwardedFor.split(",")[0]?.trim() || "local-session";
}

function dayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  const repository = getRepository();
  const runId = makeId("run");
  const createdAt = new Date().toISOString();

  await repository.saveSimulation({
    id: runId,
    status: "running",
    progress: 5,
    createdAt
  });

  try {
    const json = await request.json();
    const parsed = simulationRequestSchema.parse(json);
    const cacheKey = JSON.stringify(parsed);
    const cached = resultCache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < 5 * 60 * 1000) {
      const cachedOutput = {
        ...cached.output,
        runId,
        createdAt
      };
      await repository.saveSimulation({
        id: runId,
        status: "completed",
        progress: 100,
        output: cachedOutput,
        createdAt,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      });
      return NextResponse.json({ runId, status: "completed", cached: true, output: cachedOutput });
    }

    const key = sessionKey(request);
    const today = dayKey();
    const usage = dailyUsage.get(key);
    if (!usage || usage.date !== today) {
      dailyUsage.set(key, { date: today, runsUsed: parsed.params.nRuns });
    } else {
      const nextRunsUsed = usage.runsUsed + parsed.params.nRuns;
      if (nextRunsUsed > 100000) {
        await repository.saveSimulation({
          id: runId,
          status: "failed",
          progress: 100,
          error: "Daily run cap exceeded for this session",
          createdAt
        });
        return NextResponse.json({ runId, status: "failed", error: "Daily run cap exceeded for this session" }, { status: 429 });
      }
      dailyUsage.set(key, { date: today, runsUsed: nextRunsUsed });
    }

    await repository.saveSimulation({
      id: runId,
      status: "running",
      progress: 20,
      createdAt
    });

    const output = runSimulation(parsed, runId);

    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await repository.saveSimulation({
      id: runId,
      status: "completed",
      progress: 100,
      output,
      createdAt,
      expiresAt: expires
    });

    resultCache.set(cacheKey, { cachedAt: Date.now(), output });
    return NextResponse.json({ runId, status: "completed", output });
  } catch (error) {
    await repository.saveSimulation({
      id: runId,
      status: "failed",
      progress: 100,
      error: String(error),
      createdAt
    });
    return NextResponse.json({ runId, status: "failed", error: String(error) }, { status: 400 });
  }
}
