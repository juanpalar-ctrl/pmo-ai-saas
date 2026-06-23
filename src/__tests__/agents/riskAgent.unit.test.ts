import { RiskAgent } from '../../agents/riskAgent';
import { AgentInput } from '../../types/agents';

// Mock de anthropicClient
jest.mock('../../config/anthropic', () => ({
  anthropicClient: {
    messages: {
      create: jest.fn()
    }
  },
  aiConfig: { model: 'claude-opus-4-6', maxTokens: 2000, temperature: 0.7 }
}));

describe('[UNIT] RiskAgent - Logica pura (sin API)', () => {
  let agent: RiskAgent;

  beforeEach(() => {
    agent = new RiskAgent();
  });

  describe('validateInput', () => {
    it('debe validar input correcto', () => {
      const input: AgentInput = { projectId: 1, projectName: 'Test' };
      expect(agent.validateInput(input)).toBe(true);
    });

    it('debe rechazar sin projectId', () => {
      expect(agent.validateInput({ projectName: 'Test' } as any)).toBe(false);
    });

    it('debe rechazar sin projectName', () => {
      expect(agent.validateInput({ projectId: 1 } as any)).toBe(false);
    });
  });

  describe('setFramework', () => {
    it('debe soportar Scrum', () => {
      agent.setFramework('scrum');
      const prompt = agent.buildPrompt({ projectId: 1, projectName: 'Test' });
      expect(prompt).toContain('SCRUM');
    });

    it('debe soportar Kanban', () => {
      agent.setFramework('kanban');
      const prompt = agent.buildPrompt({ projectId: 1, projectName: 'Test' });
      expect(prompt).toContain('KANBAN');
    });
  });

  describe('buildPrompt', () => {
    it('debe incluir nombre del proyecto', () => {
      const input: AgentInput = { projectId: 1, projectName: 'MyProject' };
      const prompt = agent.buildPrompt(input);
      expect(prompt).toContain('MyProject');
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
        analysis: { overallRiskScore: 'HIGH', topRisks: [] }
      });
      const result = agent.parseResponse(response);
      expect(result.analysis.overallRiskScore).toBe('HIGH');
    });

    it('debe parsear JSON con backticks', () => {
      const response = '```json\n{ "analysis": { "overallRiskScore": "MEDIUM", "topRisks": [] } }\n```';
      const result = agent.parseResponse(response);
      expect(result.analysis.overallRiskScore).toBe('MEDIUM');
    });

    it('debe devolver fallback para JSON invalido', () => {
      const response = 'Not JSON at all';
      const result = agent.parseResponse(response);
      expect(result.analysis).toBeDefined();
    });
  });
});
