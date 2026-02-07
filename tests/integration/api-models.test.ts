import { describe, expect, it } from "vitest";
import { POST as postModel } from "@/app/api/models/route";
import { GET as getModel } from "@/app/api/models/[id]/route";
import { defaultModel, defaultScenarios } from "@/lib/domain/defaults";

async function json(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

describe("models api", () => {
  it("saves and loads full model + scenario payload", async () => {
    const customScenarios = [
      {
        ...defaultScenarios[0],
        distributionParamOverrides: {
          dist_growth: { logMean: 0.05, logStd: 0.2 }
        }
      },
      {
        ...defaultScenarios[1],
        enabled: false
      }
    ];

    const postReq = new Request("http://localhost/api/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Integration Model",
        model: {
          ...defaultModel,
          name: "Integration Model"
        },
        scenarios: customScenarios
      })
    });

    const postRes = await postModel(postReq);
    expect(postRes.status).toBe(200);
    const postPayload = await json(postRes);
    const id = String(postPayload.id ?? "");
    expect(id.length).toBeGreaterThan(3);

    const getRes = await getModel(new Request(`http://localhost/api/models/${id}`), {
      params: Promise.resolve({ id })
    });

    expect(getRes.status).toBe(200);
    const getPayload = await json(getRes);
    expect(getPayload.id).toBe(id);

    const model = getPayload.model as { name: string };
    expect(model.name).toBe("Integration Model");

    const scenarios = getPayload.scenarios as Array<{ id: string; enabled?: boolean; distributionParamOverrides?: unknown }>;
    expect(scenarios.length).toBe(2);
    expect(scenarios[1].enabled).toBe(false);
    expect(scenarios[0].distributionParamOverrides).toBeTruthy();
  });
});
