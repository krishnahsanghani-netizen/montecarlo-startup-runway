import { NextResponse } from "next/server";
import { getRepository } from "@/lib/api/repository";

function extractRunId(url: string): string | null {
  const pathname = new URL(url).pathname;
  const match = pathname.match(/\/api\/exports\/(.+)\.csv$/);
  return match?.[1] ?? null;
}

const HEADER = [
  "record_type",
  "scenario",
  "run",
  "month",
  "users_p50",
  "new_users_p50",
  "churned_users_p50",
  "mrr_p50",
  "cash_p50",
  "arr_p50",
  "burn_p50",
  "runway_p50",
  "cac_p50",
  "fixed_costs_p50",
  "payroll_costs_p50",
  "variable_costs_p50",
  "total_costs_p50",
  "funds_raised_p50",
  "macro_index_p50",
  "growth_rate_p50",
  "churn_rate_p50",
  "default_prob_cumulative",
  "path_users",
  "path_new_users",
  "path_churned_users",
  "path_mrr",
  "path_cash",
  "path_arr",
  "path_burn",
  "path_runway",
  "path_macro",
  "path_funds_raised",
  "path_valuation",
  "default_prob_horizon",
  "median_arr_horizon",
  "terminal_cash_p5",
  "terminal_cash_p95",
  "milestone_probability_first",
  "run_default_month",
  "run_terminal_cash",
  "run_terminal_arr",
  "run_max_drawdown_cash",
  "run_max_burn_rate",
  "round_name",
  "round_bin_start",
  "round_bin_end",
  "round_bin_count",
  "round_bin_probability",
  "round_bin_type"
] as const;

type RowMap = Partial<Record<(typeof HEADER)[number], string | number>>;

function csvRow(values: RowMap): string {
  return HEADER.map((key) => {
    const value = values[key] ?? "";
    const text = String(value);
    return text.includes(",") ? `"${text.replaceAll('"', '""')}"` : text;
  }).join(",");
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

  const lines = [HEADER.join(",")];
  for (const scenario of record.output.results) {
    lines.push(
      csvRow({
        record_type: "summary",
        scenario: scenario.scenarioName,
        default_prob_horizon: scenario.summary.defaultProbabilityByHorizon.toFixed(4),
        median_arr_horizon: scenario.summary.medianArrAtHorizon.toFixed(2),
        terminal_cash_p5: scenario.summary.terminalCashP5.toFixed(2),
        terminal_cash_p95: scenario.summary.terminalCashP95.toFixed(2),
        milestone_probability_first: (scenario.summary.milestoneProbabilities[0]?.probability ?? 0).toFixed(4)
      })
    );

    for (const row of scenario.monthlyAggregates) {
      lines.push(
        csvRow({
          record_type: "aggregate",
          scenario: scenario.scenarioName,
          month: row.month,
          users_p50: row.users.p50.toFixed(2),
          new_users_p50: row.newUsers.p50.toFixed(2),
          churned_users_p50: row.churnedUsers.p50.toFixed(2),
          mrr_p50: row.mrr.p50.toFixed(2),
          cash_p50: row.cash.p50.toFixed(2),
          arr_p50: row.arr.p50.toFixed(2),
          burn_p50: row.burn.p50.toFixed(2),
          runway_p50: row.runway.p50.toFixed(2),
          cac_p50: row.cac.p50.toFixed(2),
          fixed_costs_p50: row.fixedCosts.p50.toFixed(2),
          payroll_costs_p50: row.payrollCosts.p50.toFixed(2),
          variable_costs_p50: row.variableCosts.p50.toFixed(2),
          total_costs_p50: row.totalCosts.p50.toFixed(2),
          funds_raised_p50: row.fundsRaised.p50.toFixed(2),
          macro_index_p50: row.macroIndex.p50.toFixed(6),
          growth_rate_p50: row.growthRate.p50.toFixed(6),
          churn_rate_p50: row.churnRate.p50.toFixed(6),
          default_prob_cumulative: row.defaultProbabilityCumulative.toFixed(4)
        })
      );
    }

    for (const path of scenario.samplePaths) {
      for (let i = 0; i < path.cash.length; i += 1) {
        lines.push(
          csvRow({
            record_type: "sample_path",
            scenario: scenario.scenarioName,
            run: path.run,
            month: i + 1,
            path_users: path.users[i]?.toFixed(2) ?? "",
            path_new_users: path.newUsers[i]?.toFixed(2) ?? "",
            path_churned_users: path.churnedUsers[i]?.toFixed(2) ?? "",
            path_mrr: path.mrr[i]?.toFixed(2) ?? "",
            path_cash: path.cash[i]?.toFixed(2) ?? "",
            path_arr: path.arr[i]?.toFixed(2) ?? "",
            path_burn: path.burn[i]?.toFixed(2) ?? "",
            path_runway: Number.isFinite(path.runway[i] ?? Number.NaN) ? (path.runway[i] as number).toFixed(4) : "Infinity",
            path_macro: path.macroIndex[i]?.toFixed(6) ?? "",
            path_funds_raised: path.fundsRaised[i]?.toFixed(2) ?? "",
            path_valuation: path.valuation[i]?.toFixed(2) ?? ""
          })
        );
      }
    }

    for (const runOutcome of scenario.runOutcomes) {
      lines.push(
        csvRow({
          record_type: "run_outcome",
          scenario: scenario.scenarioName,
          run_default_month: runOutcome.defaultMonth ?? "",
          run_terminal_cash: runOutcome.terminalCash.toFixed(2),
          run_terminal_arr: runOutcome.terminalArr.toFixed(2),
          run_max_drawdown_cash: runOutcome.maxDrawdownCash.toFixed(2),
          run_max_burn_rate: runOutcome.maxBurnRate.toFixed(2)
        })
      );
    }

    for (const round of scenario.fundraisingRoundOutcomes) {
      for (const bin of round.amountRaisedHistogram) {
        lines.push(
          csvRow({
            record_type: "round_histogram",
            scenario: scenario.scenarioName,
            round_name: round.roundName,
            round_bin_start: bin.binStart.toFixed(2),
            round_bin_end: bin.binEnd.toFixed(2),
            round_bin_count: bin.count,
            round_bin_probability: bin.probability.toFixed(6),
            round_bin_type: "amount"
          })
        );
      }
      for (const bin of round.valuationHistogram) {
        lines.push(
          csvRow({
            record_type: "round_histogram",
            scenario: scenario.scenarioName,
            round_name: round.roundName,
            round_bin_start: bin.binStart.toFixed(2),
            round_bin_end: bin.binEnd.toFixed(2),
            round_bin_count: bin.count,
            round_bin_probability: bin.probability.toFixed(6),
            round_bin_type: "valuation"
          })
        );
      }
    }
  }

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=simulation-${runId}.csv`
    }
  });
}
