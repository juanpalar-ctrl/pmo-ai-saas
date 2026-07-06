import { ReportingAgent } from '../../agents/reportingAgent';
import { AgentInput } from '../../types/agents';

jest.mock('../../config/anthropic', () => ({
  anthropicClient: { messages: { create: jest.fn() } },
  aiConfig: { model: 'claude-opus-4-6', maxTokens: 2000, temperature: 0.7 },
}));

describe('[UNIT] ReportingAgent', () => {
  let agent: ReportingAgent;

  beforeEach(() => {
    agent = new ReportingAgent();
  });

  describe('validateInput', () => {
    it('accepts input with projectId and projectName', () => {
      expect(agent.validateInput({ projectId: 1, projectName: 'X' })).toBe(true);
    });

    it('rejects input missing projectName', () => {
      expect(agent.validateInput({ projectId: 1 } as any)).toBe(false);
    });
  });

  describe('buildPrompt', () => {
    it('includes the project name and key metrics', () => {
      agent.setAnalysisOutputs(
        { analysis: { analysis: { overallRiskScore: 'HIGH', delayProbability: 0.4, topRisks: [] } } },
        { analysis: { analysis: { budget_status: 'AT_RISK', daily_burn_rate: 500 } } }
      );
      const input: AgentInput = {
        projectId: 1,
        projectName: 'Proyecto Fénix',
        timeline: { percentageComplete: 40, daysRemaining: 20 },
        budget: { total: 10000, spent: 6000 },
      };
      const prompt = agent.buildPrompt(input);
      expect(prompt).toContain('Proyecto Fénix');
      expect(prompt).toContain('HIGH');
      expect(prompt).toContain('AT_RISK');
    });

    it('falls back to safe defaults when risk/economic outputs are missing', () => {
      const input: AgentInput = { projectId: 1, projectName: 'X' };
      const prompt = agent.buildPrompt(input);
      expect(prompt).toContain('MEDIUM');
      expect(prompt).toContain('UNKNOWN');
    });
  });

  describe('parseResponse', () => {
    it('extracts senior_report and technical_report between fenced markers', () => {
      const response = `===SENIOR_REPORT===
Reporte ejecutivo de prueba.
===TECHNICAL_REPORT===
Reporte técnico de prueba.
===END===`;
      const result = agent.parseResponse(response);
      expect(result.senior_report).toBe('Reporte ejecutivo de prueba.');
      expect(result.technical_report).toBe('Reporte técnico de prueba.');
    });

    it('does not truncate the technical report on Spanish words containing "end" (e.g. "entender")', () => {
      const response = `===SENIOR_REPORT===
Resumen ejecutivo.
===TECHNICAL_REPORT===
Necesitamos entender el problema de arquitectura antes de recomendar nada.
===END===`;
      const result = agent.parseResponse(response);
      expect(result.technical_report).toContain('Necesitamos entender el problema de arquitectura antes de recomendar nada.');
    });

    it('still extracts the technical report when the ===END=== marker is missing', () => {
      const response = `===SENIOR_REPORT===
Resumen ejecutivo.
===TECHNICAL_REPORT===
Reporte técnico sin cierre.`;
      const result = agent.parseResponse(response);
      expect(result.technical_report).toBe('Reporte técnico sin cierre.');
    });

    it('strips markdown code fences before parsing', () => {
      const response = '```\n===SENIOR_REPORT===\nA.\n===TECHNICAL_REPORT===\nB.\n===END===\n```';
      const result = agent.parseResponse(response);
      expect(result.senior_report).toBe('A.');
      expect(result.technical_report).toBe('B.');
    });

    it('falls back to a generated report when markers are missing entirely', () => {
      agent.setAnalysisOutputs(
        { analysis: { analysis: { overallRiskScore: 'HIGH' } } },
        { analysis: { analysis: { budget_status: 'CRITICAL' } } }
      );
      const result = agent.parseResponse('respuesta sin ningún formato reconocible');
      expect(result.senior_report).toContain('HIGH');
      expect(result.senior_report).toContain('CRITICAL');
      expect(result.technical_report).toBeDefined();
    });
  });
});
