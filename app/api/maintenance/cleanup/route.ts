import { NextResponse } from "next/server";
import { getRepository } from "@/lib/api/repository";

function authorized(request: Request): boolean {
  const configured = process.env.CLEANUP_TOKEN;
  if (!configured) return true;
  const token = request.headers.get("x-cleanup-token");
  return token === configured;
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const repository = getRepository();
  const nowIso = new Date().toISOString();
  const expiredIds = await repository.listExpiredSimulationIds(nowIso);

  for (const id of expiredIds) {
    await repository.deleteSimulation(id);
  }

  return NextResponse.json({
    deletedCount: expiredIds.length,
    deletedIds: expiredIds,
    ranAt: nowIso
  });
}
