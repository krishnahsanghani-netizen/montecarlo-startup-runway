import { z } from "zod";

const discretePointSchema = z.object({
  value: z.number(),
  probability: z.number().min(0).max(1)
});

const distributionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["normal", "lognormal", "beta", "triangular", "uniform", "discrete"]),
  params: z.record(z.number()),
  clampMin: z.number().optional(),
  clampMax: z.number().optional(),
  discreteValues: z.array(discretePointSchema).optional()
});

const macroOverrideSchema = z.object({
  rho: z.number().min(-0.999).max(0.999).optional(),
  sigma: z.number().nonnegative().optional(),
  gammaGrowth: z.number().optional(),
  gammaChurn: z.number().optional(),
  gammaCac: z.number().optional(),
  shock: z
    .object({
      enabled: z.boolean(),
      monthlyProbability: z.number().min(0).max(1),
      impactDistributionId: z.string(),
      durationMonths: z.number().int().min(1).max(24)
    })
    .optional()
});

export const simulationRequestSchema = z.object({
  model: z.object({
    name: z.string().min(1),
    timeHorizonMonths: z.number().int().min(12).max(60),
    initialCash: z.number(),
    startingUsers: z.number().nonnegative(),
    startingMrr: z.number().nonnegative(),
    revenueModel: z.object({
      growthMode: z.enum(["top_down", "funnel"]),
      momGrowthDistributionId: z.string(),
      churnDistributionId: z.string(),
      arpuDistributionId: z.string(),
      cacDistributionId: z.string().optional(),
      funnel: z
        .object({
          visitorsDistributionId: z.string(),
          signupRateDistributionId: z.string(),
          activationRateDistributionId: z.string()
        })
        .optional(),
      expansion: z
        .object({
          enabled: z.boolean(),
          upgradeFractionDistributionId: z.string(),
          additionalArpuDistributionId: z.string()
        })
        .optional()
    }),
    costModel: z.object({
      fixedCosts: z.array(z.object({ month: z.number().int().min(1), amount: z.number().nonnegative() })),
      variableCostPerUserDistributionId: z.string(),
      hiringPlan: z.array(
        z.object({
          month: z.number().int().min(1),
          role: z.string(),
          salary: z.number().nonnegative(),
          count: z.number().int().min(1)
        })
      ),
      payrollTaxMultiplier: z.number().positive().optional(),
      hiringSlippageDistributionId: z.string().optional()
    }),
    fundraisingPlan: z.object({
      rounds: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          targetMonth: z.number().int().min(1),
          targetAmount: z.number().nonnegative(),
          preMoneyValuation: z.number().positive(),
          closeProbabilityDistributionId: z.string().optional(),
          timeToCloseDistributionId: z.string(),
          valuationMultiplierDistributionId: z.string(),
          amountDistributionId: z.string().optional(),
          requiredArrMin: z.number().nonnegative().optional(),
          requiredGrowthMin: z.number().optional(),
          fallbackBridgeRound: z
            .object({
              enabled: z.boolean(),
              amountDistributionId: z.string().optional(),
              valuationMultiplierDistributionId: z.string().optional(),
              closeLagDistributionId: z.string().optional()
            })
            .optional()
        })
      ),
      logisticParams: z.object({
        alpha: z.number(),
        betaArr: z.number(),
        betaGrowth: z.number(),
        betaMacro: z.number()
      })
    }),
    macroModel: z.object({
      rho: z.number().min(-0.999).max(0.999),
      sigma: z.number().nonnegative(),
      gammaGrowth: z.number(),
      gammaChurn: z.number(),
      gammaCac: z.number(),
      shock: z
        .object({
          enabled: z.boolean(),
          monthlyProbability: z.number().min(0).max(1),
          impactDistributionId: z.string(),
          durationMonths: z.number().int().min(1).max(24)
        })
        .optional()
    }),
    distributions: z.array(distributionSchema),
    correlation: z
      .object({
        variables: z.array(z.string()),
        matrix: z.array(z.array(z.number())),
        byMonth: z
          .array(
            z.object({
              month: z.number().int().min(1),
              matrix: z.array(z.array(z.number()))
            })
          )
          .optional()
      })
      .optional(),
    milestones: z.array(
      z.object({
        type: z.enum(["ARR_BY_MONTH", "PROFITABILITY_BY_MONTH"]),
        threshold: z.number(),
        month: z.number().int().min(1)
      })
    )
  }),
  scenarios: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      enabled: z.boolean().optional(),
      distributionParamOverrides: z.record(z.record(z.number())).optional(),
      macroOverrides: macroOverrideSchema.optional(),
      correlationOverride: z
        .object({
          matrix: z.array(z.array(z.number()))
        })
        .optional(),
      correlationsByMonthOverride: z
        .array(
          z.object({
            month: z.number().int().min(1),
            matrix: z.array(z.array(z.number()))
          })
        )
        .optional()
    })
  ),
  params: z.object({
    nRuns: z.number().int().min(100).max(10000),
    seed: z.number().int().nonnegative(),
    horizonMonths: z.number().int().min(12).max(60),
    samplePathCount: z.number().int().min(10).max(100)
  })
});

export type SimulationRequestDto = z.infer<typeof simulationRequestSchema>;
