import { NextResponse } from "next/server";
import { getRepository } from "@/lib/api/repository";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await getRepository().getModel(id);
  if (!record) {
    return NextResponse.json({ error: "Model not found" }, { status: 404 });
  }
  return NextResponse.json(record);
}
