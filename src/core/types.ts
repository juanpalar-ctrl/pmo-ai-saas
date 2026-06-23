// ============================================
// TIPOS CENTRALES - Core Domain Types
// ============================================

export interface RiskAnalysisOutput {
  topRisks: Array<{
    description: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    probability: number;
    impact?: string;
  }>;
  delayProbability: number;
  overallRiskScore: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  recommendations?: string[];
}

export interface EconomicAnalysisOutput {
  budget_status: 'CRITICAL' | 'WARNING' | 'HEALTHY' | 'EXCELLENT';
  budget_health: number;
  cpi: number;
  spi: number;
  recommendations: string[];
  costVariance?: number;
  scheduleVariance?: number;
}

// AnalysisOutput - Compatible con lo que retorna orchestrator
export interface AnalysisOutput {
  risk: any;
  economic: any;
  reports: {
    senior_report: string;
    technical_report: string;
  };
  metrics: {
    pv: string | number;
    ev: string | number;
    ac: string | number;
    cv: string | number;
    cpi: string | number;
    spi: string | number;
    roi: string | number;
    framework?: string;
    percentComplete?: string | number;
  };
  timestamp: string;
}

export interface AnalysisInputDTO {
  projectId: number;
  projectName: string;
  framework?: string;
  forceRefresh?: boolean;
}

export interface ProjectAnalysisInput {
  projectId: number;
  projectName: string;
  timeline: {
    percentageComplete: number;
    daysRemaining: number;
  };
  budget: {
    total: number;
    spent: number;
  };
}
