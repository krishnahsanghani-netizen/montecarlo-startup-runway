import { describe, expect, it } from "vitest";
import { POST as postSimulation } from "@/app/api/simulations/route";
import { GET as getSimulation } from "@/app/api/simulations/[id]/route";
import { GET as getCsvExport } from "@/app/api/exports/[runId].csv/route";
import { GET as getJsonExport } from "@/app/api/exports/[runId].json/route";
import { defaultModel, defaultScenarios } from "@/lib/domain/defaults";

async function json(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

describe("simulation api lifecycle", () => {
  it("creates run, reads result, and exports csv/json", async () => {
    const startReq = new Request("http://localhost/api/simulations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: {
          ...defaultModel,
          timeHorizonMonths: 18
        },
        scenarios: defaultScenarios,
        params: {
          nRuns: 300,
          seed: 99,
          horizonMonths: 18,
          samplePathCount: 20
        }
      })
    });

    const startRes = await postSimulation(startReq);
    expect(startRes.status).toBe(200);

    const startPayload = await json(startRes);
    const runId = String(startPayload.runId ?? "");
    expect(runId.length).toBeGreaterThan(3);

    const statusRes = await getSimulation(new Request(`http://localhost/api/simulations/${runId}`), {
      params: Promise.resolve({ id: runId })
    });

    expect(statusRes.status).toBe(200);
    const statusPayload = await json(statusRes);
    expect(statusPayload.status).toBe("completed");

    const csvRes = await getCsvExport(new Request(`http://localhost/api/exports/${runId}.csv`));
    expect(csvRes.status).toBe(200);
    const csvText = await csvRes.text();
    expect(csvText).toContain(
      "record_type,scenario,run,month,users_p50,new_users_p50,churned_users_p50,mrr_p50,cash_p50,arr_p50,burn_p50,runway_p50,cac_p50,fixed_costs_p50,payroll_costs_p50,variable_costs_p50,total_costs_p50,funds_raised_p50,macro_index_p50,growth_rate_p50,churn_rate_p50,default_prob_cumulative,path_users,path_new_users,path_churned_users,path_mrr,path_cash,path_arr,path_burn,path_runway,path_macro,path_funds_raised,path_valuation,default_prob_horizon,median_arr_horizon,terminal_cash_p5,terminal_cash_p95,milestone_probability_first,run_default_month,run_terminal_cash,run_terminal_arr,run_max_drawdown_cash,run_max_burn_rate,round_name,round_bin_start,round_bin_end,round_bin_count,round_bin_probability,round_bin_type"
    );
    expect(csvText).toContain("summary,");
    expect(csvText).toContain("aggregate,");
    expect(csvText).toContain("sample_path,");

    const jsonRes = await getJsonExport(new Request(`http://localhost/api/exports/${runId}.json`));
    expect(jsonRes.status).toBe(200);
    const exportPayload = await json(jsonRes);
    expect(exportPayload.runId).toBe(runId);
  });
});
