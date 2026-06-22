// ============================================
// TIPOS CENTRALES - Core Domain Types
// Estos NO se usan en ningún lado todavía
// Safe to add sin romper nada
// ============================================

// Tipos para análisis de riesgo
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

// Tipos para análisis económico
export interface EconomicAnalysisOutput {
  budget_status: 'CRITICAL' | 'WARNING' | 'HEALTHY' | 'EXCELLENT';
  budget_health: number; // 0-1
  cpi: number;
  spi: number;
  recommendations: string[];
  costVariance?: number;
  scheduleVariance?: number;
}

// Salida final del análisis
export interface AnalysisOutput {
  risk: any;
  economic: any;
  reports: {
    senior_report: string;
    technical_report: string;
  };
  metrics: {
    pv: number;
    ev: number;
    ac: number;
    cv: number;
    cpi: number;
    spi: number;
    roi: number;
    framework?: string;
    percentComplete?: number;
  };
  timestamp: string;
}

// DTO para input de análisis
export interface AnalysisInputDTO {
  projectId: number;
  projectName: string;
  framework?: string;
  forceRefresh?: boolean;
}

// Tipos para inputs de análisis de proyecto
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
