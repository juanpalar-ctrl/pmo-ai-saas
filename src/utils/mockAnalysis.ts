// Mock data para testing SIN gastar API credits
export const generateMockAnalysis = (framework: string) => ({
  risk: {
    analysis: {
      analysis: {
        topRisks: [
          { description: "Integration delays with legacy systems", probability: 0.3, impact: "HIGH" },
          { description: "Resource availability constraints", probability: 0.25, impact: "MEDIUM" },
          { description: "Technical debt accumulation", probability: 0.2, impact: "MEDIUM" }
        ],
        delayProbability: 0.35,
        overallRiskScore: "MEDIUM"
      }
    }
  },
  economic: {
    analysis: {
      analysis: {
        budget_status: "ON_TRACK",
        budget_health: 0.85,
        worst_case_total_cost: 52000,
        cost_of_delay: 8500,
        daily_burn_rate: 2100,
        recommendations: [
          "Optimize resource allocation to reduce daily burn",
          "Monitor integration points for potential delays",
          "Implement technical debt reduction in sprint planning"
        ]
      }
    }
  },
  reports: {
    senior_report: `EXECUTIVE SUMMARY
Project Status: ON TRACK

Key Metrics:
- Budget Health: 85%
- Risk Level: MEDIUM (35% delay probability)
- Schedule Performance: 96%

RECOMMENDATIONS:
1. Maintain current pace to avoid scope creep
2. Allocate buffer for integration testing
3. Weekly executive steering reviews recommended`,
    
    technical_report: `TECHNICAL ASSESSMENT

Architecture Review: SOUND
- Current stack supports scalability requirements
- No critical bottlenecks identified
- Infrastructure provisioned adequately

Risk Areas:
- Legacy system integration (3-week window)
- Data migration validation required
- Performance testing needed before go-live

Recommendations:
1. Schedule integration dry-run in week 3
2. Implement continuous performance monitoring
3. Plan contingency for legacy API delays`
  },
  metrics: {
    pv: "50000.00",
    ev: "48000.00",
    ac: "45000.00",
    cpi: "1.07",
    spi: "0.96",
    roi: "6.67",
    framework: framework.toUpperCase()
  },
  timestamp: new Date().toISOString()
});

export function isMockEnabled(): boolean {
  return process.env.USE_MOCK_DATA === 'true';
}

export function getCacheDurationHours(): number {
  return parseInt(process.env.CACHE_ANALYSIS_HOURS || '24');
}
