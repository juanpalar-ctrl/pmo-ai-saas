import { EconomicAgent } from '../../agents/economicAgent';
import { AgentInput } from '../../types/agents';

jest.mock('../../config/anthropic', () => ({
  anthropicClient: {
    messages: {
      create: jest.fn()
    }
  },
  aiConfig: { model: 'claude-opus-4-6', maxTokens: 2000, temperature: 0.7 }
}));

describe('[UNIT] EconomicAgent - Logica pura (sin API)', () => {
  let agent: EconomicAgent;

  beforeEach(() => {
    agent = new EconomicAgent();
  });

  describe('validateInput', () => {
    it('debe validar input correcto', () => {
      const input: AgentInput = { projectId: 1, projectName: 'Test' };
      expect(agent.validateInput(input)).toBe(true);
    });

    it('debe rechazar sin projectId', () => {
      expect(agent.validateInput({ projectName: 'Test' } as any)).toBe(false);
    });
  });

  describe('setFramework', () => {
    it('debe soportar frameworks', () => {
      agent.setFramework('scrum');
      const prompt = agent.buildPrompt({ projectId: 1, projectName: 'Test' });
      expect(prompt).toContain('SCRUM');
    });
  });

  describe('buildPrompt', () => {
    it('debe incluir nombre del proyecto', () => {
      const input: AgentInput = { projectId: 1, projectName: 'BudgetProject' };
      const prompt = agent.buildPrompt(input);
      expect(prompt).toContain('BudgetProject');
    });

    it('debe pedir JSON valido', () => {
      const input: AgentInput = { projectId: 1, projectName: 'Test' };
      const prompt = agent.buildPrompt(input);
      expect(prompt).toContain('JSON');
    });
  });

  describe('parseResponse', () => {
    it('debe parsear JSON limpio', () => {
      const response = JSON.stringify({
        analysis: { budget_status: 'HEALTHY', budget_health: 0.85 }
      });
      const result = agent.parseResponse(response);
      expect(result.analysis.budget_status).toBe('HEALTHY');
    });

    it('debe devolver fallback para JSON invalido', () => {
      const response = 'Not JSON';
      const result = agent.parseResponse(response);
      expect(result.analysis).toBeDefined();
      expect(result.analysis.budget_status).toBeDefined();
    });
  });
});
