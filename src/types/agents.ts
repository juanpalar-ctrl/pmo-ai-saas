// ============================================
// TIPOS PARA AGENTES IA
// Mantiene consistencia entre agentes
// ============================================

// Input genérico que reciben todos los agentes
export interface AgentInput {
  projectId: number;
  projectName: string;
  status?: string;
  timeline?: any;
  teamVelocity?: number[];
  workPending?: any;
  budget?: any;
  resources?: any;
  risks?: any;
  lang?: 'es' | 'en';
  [key: string]: any;
}

// Output genérico que devuelven todos los agentes
export interface AgentOutput {
  agentName: string;
  timestamp: string;
  projectId: number;
  analysis: any;
  tokensUsed?: number;
  executionTimeMs?: number;
}

// Interface para Agente Base
export interface IAgent {
  name: string;
  version: string;
  analyze(input: AgentInput): Promise<AgentOutput>;
  validateInput(input: AgentInput): boolean;
}