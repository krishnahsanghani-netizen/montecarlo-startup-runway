import { StartupModel, ScenarioDefinition } from "@/lib/domain/types";

export const defaultModel: StartupModel = {
  name: "SaaS Template",
  timeHorizonMonths: 36,
  initialCash: 1500000,
  startingUsers: 120,
  startingMrr: 12000,
  revenueModel: {
    growthMode: "top_down",
    momGrowthDistributionId: "dist_growth",
    churnDistributionId: "dist_churn",
    arpuDistributionId: "dist_arpu",
    cacDistributionId: "dist_cac",
    funnel: {
      visitorsDistributionId: "dist_visitors",
      signupRateDistributionId: "dist_signup_rate",
      activationRateDistributionId: "dist_activation_rate"
    },
    expansion: {
      enabled: true,
      upgradeFractionDistributionId: "dist_upgrade_fraction",
      additionalArpuDistributionId: "dist_expansion_arpu"
    }
  },
  costModel: {
    fixedCosts: [{ month: 1, amount: 30000 }],
    variableCostPerUserDistributionId: "dist_cogs",
    hiringPlan: [{ month: 4, role: "Engineer", salary: 12000, count: 2 }],
    payrollTaxMultiplier: 1.12,
    hiringSlippageDistributionId: "dist_hiring_slippage"
  },
  fundraisingPlan: {
    rounds: [
      {
        id: "round_seed_plus",
        name: "Seed+",
        targetMonth: 12,
        targetAmount: 2000000,
        preMoneyValuation: 12000000,
        closeProbabilityDistributionId: "dist_round_close_prob",
        timeToCloseDistributionId: "dist_close_lag",
        valuationMultiplierDistributionId: "dist_val_mult",
        requiredArrMin: 250000,
        requiredGrowthMin: 1.02,
        fallbackBridgeRound: {
          enabled: true,
          amountDistributionId: "dist_bridge_amount",
          valuationMultiplierDistributionId: "dist_bridge_val_mult",
          closeLagDistributionId: "dist_bridge_close_lag"
        }
      }
    ],
    logisticParams: {
      alpha: -5,
      betaArr: 0.5,
      betaGrowth: 1,
      betaMacro: 0.8
    }
  },
  macroModel: {
    rho: 0.65,
    sigma: 0.2,
    gammaGrowth: 0.12,
    gammaChurn: 0.08,
    gammaCac: 0.1,
    shock: {
      enabled: true,
      monthlyProbability: 0.02,
      impactDistributionId: "dist_macro_shock_impact",
      durationMonths: 3
    }
  },
  distributions: [
    {
      id: "dist_growth",
      name: "MoM User Growth",
      type: "lognormal",
      params: { logMean: 0.08, logStd: 0.12 },
      clampMin: 0.7,
      clampMax: 1.6
    },
    {
      id: "dist_churn",
      name: "Monthly Churn",
      type: "beta",
      params: { alpha: 2, beta: 25, min: 0, max: 0.2 },
      clampMin: 0,
      clampMax: 0.5
    },
    {
      id: "dist_arpu",
      name: "ARPU",
      type: "normal",
      params: { mean: 95, std: 12 },
      clampMin: 20
    },
    {
      id: "dist_cogs",
      name: "COGS per User",
      type: "normal",
      params: { mean: 11, std: 2 },
      clampMin: 1
    },
    {
      id: "dist_cac",
      name: "CAC",
      type: "normal",
      params: { mean: 120, std: 25 },
      clampMin: 20
    },
    {
      id: "dist_round_close_prob",
      name: "Round Close Probability Multiplier",
      type: "beta",
      params: { alpha: 10, beta: 3, min: 0.5, max: 1 }
    },
    {
      id: "dist_close_lag",
      name: "Close Lag",
      type: "discrete",
      params: {},
      discreteValues: [
        { value: 1, probability: 0.2 },
        { value: 2, probability: 0.5 },
        { value: 3, probability: 0.3 }
      ]
    },
    {
      id: "dist_val_mult",
      name: "Valuation Multiplier",
      type: "triangular",
      params: { min: 0.75, mode: 1, max: 1.35 },
      clampMin: 0.5,
      clampMax: 2
    },
    {
      id: "dist_visitors",
      name: "Monthly Visitors",
      type: "normal",
      params: { mean: 12000, std: 2000 },
      clampMin: 1000
    },
    {
      id: "dist_signup_rate",
      name: "Signup Rate",
      type: "beta",
      params: { alpha: 6, beta: 34, min: 0.01, max: 0.4 }
    },
    {
      id: "dist_activation_rate",
      name: "Activation Rate",
      type: "beta",
      params: { alpha: 12, beta: 18, min: 0.05, max: 0.9 }
    },
    {
      id: "dist_upgrade_fraction",
      name: "Upgrade Fraction",
      type: "beta",
      params: { alpha: 2, beta: 20, min: 0, max: 0.5 }
    },
    {
      id: "dist_expansion_arpu",
      name: "Expansion ARPU",
      type: "normal",
      params: { mean: 35, std: 10 },
      clampMin: 0
    },
    {
      id: "dist_hiring_slippage",
      name: "Hiring Slippage Months",
      type: "discrete",
      params: {},
      discreteValues: [
        { value: 0, probability: 0.6 },
        { value: 1, probability: 0.3 },
        { value: 2, probability: 0.1 }
      ]
    },
    {
      id: "dist_bridge_amount",
      name: "Bridge Round Amount",
      type: "triangular",
      params: { min: 250000, mode: 450000, max: 800000 },
      clampMin: 100000
    },
    {
      id: "dist_bridge_val_mult",
      name: "Bridge Valuation Multiplier",
      type: "triangular",
      params: { min: 0.5, mode: 0.7, max: 0.95 },
      clampMin: 0.3,
      clampMax: 1
    },
    {
      id: "dist_bridge_close_lag",
      name: "Bridge Close Lag",
      type: "discrete",
      params: {},
      discreteValues: [
        { value: 0, probability: 0.5 },
        { value: 1, probability: 0.35 },
        { value: 2, probability: 0.15 }
      ]
    },
    {
      id: "dist_macro_shock_impact",
      name: "Macro Shock Impact",
      type: "normal",
      params: { mean: -1.2, std: 0.4 },
      clampMax: -0.2
    }
  ],
  correlation: {
    variables: ["growth", "churn", "arpu", "macro"],
    matrix: [
      [1, -0.3, 0.2, 0.4],
      [-0.3, 1, -0.1, -0.4],
      [0.2, -0.1, 1, 0.1],
      [0.4, -0.4, 0.1, 1]
    ],
    byMonth: [
      {
        month: 18,
        matrix: [
          [1, -0.4, 0.25, 0.55],
          [-0.4, 1, -0.15, -0.5],
          [0.25, -0.15, 1, 0.2],
          [0.55, -0.5, 0.2, 1]
        ]
      }
    ]
  },
  milestones: [
    { type: "ARR_BY_MONTH", threshold: 1000000, month: 24 },
    { type: "PROFITABILITY_BY_MONTH", threshold: 0, month: 30 }
  ]
};

export const consumerAppModel: StartupModel = {
  ...defaultModel,
  name: "Consumer App Template",
  initialCash: 700000,
  startingUsers: 5000,
  startingMrr: 8000,
  costModel: {
    ...defaultModel.costModel,
    fixedCosts: [{ month: 1, amount: 45000 }],
    hiringPlan: [{ month: 3, role: "Growth", salary: 9000, count: 2 }]
  },
  distributions: defaultModel.distributions.map((dist) => {
    if (dist.id === "dist_growth") {
      return {
        ...dist,
        params: { logMean: 0.12, logStd: 0.22 }
      };
    }
    if (dist.id === "dist_churn") {
      return {
        ...dist,
        params: { alpha: 3, beta: 15, min: 0, max: 0.35 }
      };
    }
    if (dist.id === "dist_arpu") {
      return {
        ...dist,
        params: { mean: 12, std: 4 },
        clampMin: 1
      };
    }
    return dist;
  }),
  fundraisingPlan: {
    ...defaultModel.fundraisingPlan,
    rounds: [
      {
        id: "round_seed_growth",
        name: "Growth Round",
        targetMonth: 9,
        targetAmount: 3000000,
        preMoneyValuation: 15000000,
        timeToCloseDistributionId: "dist_close_lag",
        valuationMultiplierDistributionId: "dist_val_mult"
      }
    ]
  }
};

export const modelTemplates = [
  { id: "saas", name: "SaaS Template", model: defaultModel },
  { id: "consumer_app", name: "Consumer App Template", model: consumerAppModel }
] as const;

export const defaultScenarios: ScenarioDefinition[] = [
  { id: "base", name: "Base", enabled: true },
  {
    id: "bear",
    name: "Bear",
    enabled: true,
    distributionParamOverrides: {
      dist_growth: { logMean: -0.02, logStd: 0.22 },
      dist_churn: { alpha: 5, beta: 10, min: 0.03, max: 0.45 },
      dist_arpu: { mean: 72, std: 15 },
      dist_cogs: { mean: 15, std: 3 },
      dist_cac: { mean: 165, std: 35 }
    },
    macroOverrides: {
      rho: 0.75,
      sigma: 0.38,
      gammaGrowth: 0.2,
      gammaChurn: 0.14,
      shock: {
        enabled: true,
        monthlyProbability: 0.08,
        impactDistributionId: "dist_macro_shock_impact",
        durationMonths: 5
      }
    },
    correlationOverride: {
      matrix: [
        [1, -0.5, 0.3, 0.65],
        [-0.5, 1, -0.2, -0.6],
        [0.3, -0.2, 1, 0.25],
        [0.65, -0.6, 0.25, 1]
      ]
    }
  },
  {
    id: "bull",
    name: "Bull",
    enabled: true,
    distributionParamOverrides: {
      dist_growth: { logMean: 0.16, logStd: 0.08 },
      dist_churn: { alpha: 2, beta: 35, min: 0, max: 0.12 },
      dist_arpu: { mean: 125, std: 8 },
      dist_cogs: { mean: 9, std: 1.5 },
      dist_cac: { mean: 95, std: 18 }
    },
    macroOverrides: {
      rho: 0.55,
      sigma: 0.15,
      gammaGrowth: 0.08,
      gammaChurn: 0.05,
      shock: {
        enabled: true,
        monthlyProbability: 0.01,
        impactDistributionId: "dist_macro_shock_impact",
        durationMonths: 2
      }
    }
  }
];
