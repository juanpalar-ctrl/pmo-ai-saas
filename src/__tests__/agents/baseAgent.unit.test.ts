import { BaseAgent } from '../../agents/baseAgent';
import { AgentInput, AgentOutput } from '../../types/agents';

jest.mock('../../config/anthropic', () => ({
  anthropicClient: {
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: '{"analysis": {}}' }],
        usage: { input_tokens: 100, output_tokens: 200 }
      })
    }
  },
  aiConfig: { model: 'claude-opus-4-6', maxTokens: 2000, temperature: 0.7 }
}));

class TestAgent extends BaseAgent {
  name = 'Test Agent';
  version = '1.0.0';

  validateInput(input: AgentInput): boolean {
    return !!(input.projectId && input.projectName);
  }

  buildPrompt(input: AgentInput): string {
    return `Test prompt for ${input.projectName}`;
  }

  parseResponse(response: string): any {
    try {
      return JSON.parse(response);
    } catch {
      return { analysis: {} };
    }
  }
}

describe('[UNIT] BaseAgent - Clase base', () => {
  let agent: TestAgent;

  beforeEach(() => {
    agent = new TestAgent();
  });

  describe('propiedades', () => {
    it('debe tener nombre y version', () => {
      expect(agent.name).toBe('Test Agent');
      expect(agent.version).toBe('1.0.0');
    });
  });

  describe('validateInput', () => {
    it('debe validar input correcto', () => {
      const input: AgentInput = { projectId: 1, projectName: 'Test' };
      expect(agent.validateInput(input)).toBe(true);
    });

    it('debe rechazar input invalido', () => {
      expect(agent.validateInput({} as any)).toBe(false);
    });
  });

  describe('buildPrompt', () => {
    it('debe construir prompt con datos del proyecto', () => {
      const input: AgentInput = { projectId: 1, projectName: 'MyProject' };
      const prompt = agent.buildPrompt(input);
      expect(prompt).toContain('MyProject');
    });
  });

  describe('parseResponse', () => {
    it('debe parsear JSON valido', () => {
      const response = '{"analysis": {"test": true}}';
      const result = agent.parseResponse(response);
      expect(result.analysis.test).toBe(true);
    });

    it('debe devolver fallback para JSON invalido', () => {
      const response = 'invalid json';
      const result = agent.parseResponse(response);
      expect(result.analysis).toBeDefined();
    });
  });
});
