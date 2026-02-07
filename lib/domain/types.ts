export type DistributionType =
  | "normal"
  | "lognormal"
  | "beta"
  | "triangular"
  | "uniform"
  | "discrete";

export interface DistributionDefinition {
  id: string;
  name: string;
  type: DistributionType;
  params: Record<string, number>;
  clampMin?: number;
  clampMax?: number;
  discreteValues?: Array<{ value: number; probability: number }>;
}

export interface CorrelationModel {
  variables: string[];
  matrix: number[][];
  byMonth?: Array<{
    month: number;
    matrix: number[][];
  }>;
}

export interface RevenueModel {
  growthMode: "top_down" | "funnel";
  momGrowthDistributionId: string;
  churnDistributionId: string;
  arpuDistributionId: string;
  cacDistributionId?: string;
  funnel?: {
    visitorsDistributionId: string;
    signupRateDistributionId: string;
    activationRateDistributionId: string;
  };
  expansion?: {
    enabled: boolean;
    upgradeFractionDistributionId: string;
    additionalArpuDistributionId: string;
  };
}

export interface HiringPlanItem {
  month: number;
  role: string;
  salary: number;
  count: number;
}

export interface CostModel {
  fixedCosts: Array<{ month: number; amount: number }>;
  variableCostPerUserDistributionId: string;
  hiringPlan: HiringPlanItem[];
  payrollTaxMultiplier?: number;
  hiringSlippageDistributionId?: string;
}

export interface FundraisingRound {
  id: string;
  name: string;
  targetMonth: number;
  targetAmount: number;
  preMoneyValuation: number;
  closeProbabilityDistributionId?: string;
  timeToCloseDistributionId: string;
  valuationMultiplierDistributionId: string;
  amountDistributionId?: string;
  requiredArrMin?: number;
  requiredGrowthMin?: number;
  fallbackBridgeRound?: {
    enabled: boolean;
    amountDistributionId?: string;
    valuationMultiplierDistributionId?: string;
    closeLagDistributionId?: string;
  };
}

export interface FundraisingPlan {
  rounds: FundraisingRound[];
  logisticParams: {
    alpha: number;
    betaArr: number;
    betaGrowth: number;
    betaMacro: number;
  };
}

export interface MacroModel {
  rho: number;
  sigma: number;
  gammaGrowth: number;
  gammaChurn: number;
  gammaCac: number;
  shock?: {
    enabled: boolean;
    monthlyProbability: number;
    impactDistributionId: string;
    durationMonths: number;
  };
}

export type MilestoneType = "ARR_BY_MONTH" | "PROFITABILITY_BY_MONTH";

export interface MilestoneDefinition {
  type: MilestoneType;
  threshold: number;
  month: number;
}

export interface StartupModel {
  name: string;
  timeHorizonMonths: number;
  initialCash: number;
  startingUsers: number;
  startingMrr: number;
  revenueModel: RevenueModel;
  costModel: CostModel;
  fundraisingPlan: FundraisingPlan;
  macroModel: MacroModel;
  distributions: DistributionDefinition[];
  correlation?: CorrelationModel;
  milestones: MilestoneDefinition[];
}

export interface ScenarioDefinition {
  id: string;
  name: string;
  enabled?: boolean;
  distributionParamOverrides?: Record<string, Record<string, number>>;
  macroOverrides?: Partial<MacroModel>;
  correlationOverride?: {
    matrix: number[][];
  };
  correlationsByMonthOverride?: Array<{
    month: number;
    matrix: number[][];
  }>;
}

export interface SimulationParams {
  nRuns: number;
  seed: number;
  horizonMonths: number;
  samplePathCount: number;
}

export interface SimulationRequest {
  model: StartupModel;
  scenarios: ScenarioDefinition[];
  params: SimulationParams;
}

export interface MonthlyAggregate {
  month: number;
  users: QuantileSet;
  newUsers: QuantileSet;
  churnedUsers: QuantileSet;
  mrr: QuantileSet;
  cash: QuantileSet;
  arr: QuantileSet;
  burn: QuantileSet;
  runway: QuantileSet;
  cac: QuantileSet;
  fixedCosts: QuantileSet;
  payrollCosts: QuantileSet;
  variableCosts: QuantileSet;
  totalCosts: QuantileSet;
  fundsRaised: QuantileSet;
  macroIndex: QuantileSet;
  growthRate: QuantileSet;
  churnRate: QuantileSet;
  defaultProbabilityCumulative: number;
}

export interface QuantileSet {
  mean: number;
  std: number;
  p5: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
}

export interface RunSummary {
  defaultProbabilityByHorizon: number;
  survivalProbability: number;
  medianArrAtHorizon: number;
  terminalCashP5: number;
  terminalCashP95: number;
  milestoneProbabilities: Array<{
    type: MilestoneType;
    month: number;
    threshold: number;
    probability: number;
  }>;
}

export interface SensitivityPoint {
  input: string;
  score: number;
  outcome: "defaultByHorizon" | "terminalArr" | "terminalCash";
}

export interface SamplePath {
  run: number;
  users: number[];
  newUsers: number[];
  churnedUsers: number[];
  mrr: number[];
  cash: number[];
  arr: number[];
  burn: number[];
  runway: number[];
  macroIndex: number[];
  fundsRaised: number[];
  valuation: number[];
}

export interface RunOutcomeStats {
  defaultMonth: number | null;
  terminalCash: number;
  terminalArr: number;
  maxDrawdownCash: number;
  maxBurnRate: number;
}

export interface ScenarioResult {
  scenarioId: string;
  scenarioName: string;
  warnings?: string[];
  summary: RunSummary;
  monthlyAggregates: MonthlyAggregate[];
  defaultMonthDistribution: Array<{
    month: number;
    count: number;
    probability: number;
  }>;
  terminalHistograms: {
    arr: Array<{ binStart: number; binEnd: number; count: number; probability: number }>;
    cash: Array<{ binStart: number; binEnd: number; count: number; probability: number }>;
  };
  fundraisingRoundOutcomes: Array<{
    roundId: string;
    roundName: string;
    attempts: number;
    successes: number;
    successProbability: number;
    closeMonthDistribution: Array<{
      month: number;
      count: number;
      probability: number;
    }>;
    amountRaisedHistogram: Array<{ binStart: number; binEnd: number; count: number; probability: number }>;
    valuationHistogram: Array<{ binStart: number; binEnd: number; count: number; probability: number }>;
  }>;
  sensitivity: SensitivityPoint[];
  samplePaths: SamplePath[];
  runOutcomes: RunOutcomeStats[];
  narrative: string;
}

export interface SimulationOutput {
  runId: string;
  createdAt: string;
  results: ScenarioResult[];
}
