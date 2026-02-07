import { NextResponse } from "next/server";
import { getRepository } from "@/lib/api/repository";

function extractRunId(url: string): string | null {
  const pathname = new URL(url).pathname;
  const match = pathname.match(/\/api\/exports\/(.+)\.json$/);
  return match?.[1] ?? null;
}

export async function GET(request: Request) {
  const runId = extractRunId(request.url);
  if (!runId) {
    return NextResponse.json({ error: "Invalid export path" }, { status: 400 });
  }
  const record = await getRepository().getSimulation(runId);
  if (!record || !record.output) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }
  return NextResponse.json(record.output, {
    headers: {
      "Content-Disposition": `attachment; filename=simulation-${runId}.json`
    }
  });
}
