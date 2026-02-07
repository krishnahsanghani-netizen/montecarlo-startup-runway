import { NextResponse } from "next/server";
import { getRepository } from "@/lib/api/repository";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repository = getRepository();
  const record = await repository.getSimulation(id);
  if (!record) {
    return NextResponse.json({ error: "Simulation not found" }, { status: 404 });
  }

  if (record.expiresAt && Date.now() > Date.parse(record.expiresAt)) {
    await repository.deleteSimulation(id);
    return NextResponse.json({ error: "Simulation expired" }, { status: 410 });
  }

  return NextResponse.json(record);
}
