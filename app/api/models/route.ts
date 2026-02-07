import { NextResponse } from "next/server";
import { defaultScenarios } from "@/lib/domain/defaults";
import { getRepository } from "@/lib/api/repository";
import { ScenarioDefinition, StartupModel } from "@/lib/domain/types";
import { makeId } from "@/lib/utils/id";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      id?: string;
      name: string;
      model: StartupModel;
      scenarios?: ScenarioDefinition[];
    };

    const id = body.id ?? makeId("mdl");
    const now = new Date().toISOString();
    const repository = getRepository();

    await repository.saveModel({
      id,
      name: body.name,
      model: body.model,
      scenarios: body.scenarios ?? defaultScenarios,
      updatedAt: now
    });

    return NextResponse.json({ id, savedAt: now });
  } catch (error) {
    return NextResponse.json({ error: "Failed to save model", detail: String(error) }, { status: 400 });
  }
}
