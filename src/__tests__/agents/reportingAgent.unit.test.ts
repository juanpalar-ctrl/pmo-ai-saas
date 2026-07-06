import { ReportingAgent } from '../../agents/reportingAgent';
import { AgentInput } from '../../types/agents';

jest.mock('../../config/anthropic', () => ({
  anthropicClient: { messages: { create: jest.fn() } },
  aiConfig: { model: 'claude-opus-4-6', maxTokens: 2000, temperature: 0.7 },
}));

import { anthropicClient } from '../../config/anthropic';

const mockCreate = anthropicClient.messages.create as jest.Mock;

function textResponse(text: string, tokens = 100) {
  return { content: [{ type: 'text', text }], usage: { input_tokens: tokens, output_tokens: tokens } };
}

describe('[UNIT] ReportingAgent', () => {
  let agent: ReportingAgent;

  beforeEach(() => {
    agent = new ReportingAgent();
    mockCreate.mockReset();
  });

  describe('validateInput', () => {
    it('accepts input with projectId and projectName', () => {
      expect(agent.validateInput({ projectId: 1, projectName: 'X' })).toBe(true);
    });

    it('rejects input missing projectName', () => {
      expect(agent.validateInput({ projectId: 1 } as any)).toBe(false);
    });
  });

  describe('buildPrompt (delegates to the senior/executive prompt)', () => {
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

  describe('analyze — two independent API calls', () => {
    const input: AgentInput = {
      projectId: 1,
      projectName: 'Proyecto Fénix',
      timeline: { percentageComplete: 40, daysRemaining: 20 },
      budget: { total: 10000, spent: 6000 },
    };

    it('makes exactly two API calls, each with the agent\'s own full maxTokens budget', async () => {
      mockCreate
        .mockResolvedValueOnce(textResponse('Reporte ejecutivo completo.'))
        .mockResolvedValueOnce(textResponse('Reporte técnico completo.'));

      const result = await agent.analyze(input);

      expect(mockCreate).toHaveBeenCalledTimes(2);
      for (const call of mockCreate.mock.calls) {
        expect(call[0].max_tokens).toBe((agent as any).maxTokens);
      }
      expect(result.analysis.senior_report).toBe('Reporte ejecutivo completo.');
      expect(result.analysis.technical_report).toBe('Reporte técnico completo.');
    });

    it('a verbose senior_report does not truncate technical_report (separate budgets)', async () => {
      const longSeniorReport = 'x'.repeat(50000); // would have exhausted a shared 6144-token budget
      mockCreate
        .mockResolvedValueOnce(textResponse(longSeniorReport))
        .mockResolvedValueOnce(textResponse('Reporte técnico completo, sin cortes.'));

      const result = await agent.analyze(input);

      expect(result.analysis.senior_report).toBe(longSeniorReport);
      expect(result.analysis.technical_report).toBe('Reporte técnico completo, sin cortes.');
    });

    it('sums token usage from both calls', async () => {
      mockCreate
        .mockResolvedValueOnce(textResponse('A', 200))
        .mockResolvedValueOnce(textResponse('B', 300));

      const result = await agent.analyze(input);

      expect(result.tokensUsed).toBe(200 + 200 + 300 + 300);
    });

    it('falls back gracefully when a response has no text content', async () => {
      agent.setAnalysisOutputs(
        { analysis: { analysis: { overallRiskScore: 'HIGH' } } },
        { analysis: { analysis: { budget_status: 'CRITICAL' } } }
      );
      mockCreate
        .mockResolvedValueOnce({ content: [{ type: 'other' }], usage: { input_tokens: 1, output_tokens: 0 } })
        .mockResolvedValueOnce(textResponse('Reporte técnico completo.'));

      const result = await agent.analyze(input);

      expect(result.analysis.senior_report).toContain('HIGH');
      expect(result.analysis.senior_report).toContain('CRITICAL');
      expect(result.analysis.technical_report).toBe('Reporte técnico completo.');
    });

    it('rejects when validateInput fails, without calling the API', async () => {
      await expect(agent.analyze({ projectId: 1 } as any)).rejects.toThrow(/Input inválido/);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('propagates errors from the API', async () => {
      mockCreate.mockRejectedValueOnce(new Error('API down'));
      await expect(agent.analyze(input)).rejects.toThrow('API down');
    });
  });
});
