import { WellbeingAgent } from '../../agents/wellbeingAgent';
import { AgentInput } from '../../types/agents';

jest.mock('../../config/anthropic', () => ({
  anthropicClient: {
    messages: {
      create: jest.fn(),
    },
  },
  aiConfig: { model: 'claude-opus-4-6', maxTokens: 2000, temperature: 0.7 },
}));

describe('[UNIT] WellbeingAgent - Logica pura (sin API)', () => {
  let agent: WellbeingAgent;

  beforeEach(() => {
    agent = new WellbeingAgent();
  });

  describe('validateInput', () => {
    it('accepts projectId + noteText', () => {
      const input = { projectId: 1, projectName: 'Ana', noteText: 'Todo bien' } as AgentInput;
      expect(agent.validateInput(input)).toBe(true);
    });

    it('rejects missing noteText', () => {
      expect(agent.validateInput({ projectId: 1, projectName: 'Ana' } as AgentInput)).toBe(false);
    });

    it('rejects an empty/whitespace noteText', () => {
      expect(agent.validateInput({ projectId: 1, projectName: 'Ana', noteText: '   ' } as AgentInput)).toBe(false);
    });

    it('rejects missing projectId', () => {
      expect(agent.validateInput({ projectName: 'Ana', noteText: 'Todo bien' } as unknown as AgentInput)).toBe(false);
    });
  });

  describe('buildPrompt', () => {
    it('includes the note text', () => {
      const input = { projectId: 1, projectName: 'Ana', noteText: 'Frustrado con las specs de la API' } as AgentInput;
      const prompt = agent.buildPrompt(input);
      expect(prompt).toContain('Frustrado con las specs de la API');
    });

    it('requests JSON output', () => {
      const input = { projectId: 1, projectName: 'Ana', noteText: 'Todo bien' } as AgentInput;
      expect(agent.buildPrompt(input)).toContain('JSON');
    });
  });

  describe('parseResponse', () => {
    it('parses a clean JSON response and clamps the score', () => {
      const response = JSON.stringify({ wellbeingScore: 0.8, sentiment: 'positive', reasoning: 'Motivado' });
      const result = agent.parseResponse(response);
      expect(result).toEqual({ wellbeingScore: 0.8, sentiment: 'positive', reasoning: 'Motivado' });
    });

    it('clamps out-of-range scores to [0,1]', () => {
      expect(agent.parseResponse(JSON.stringify({ wellbeingScore: 1.5 })).wellbeingScore).toBe(1);
      expect(agent.parseResponse(JSON.stringify({ wellbeingScore: -0.5 })).wellbeingScore).toBe(0);
    });

    it('falls back to neutral sentiment when invalid', () => {
      const result = agent.parseResponse(JSON.stringify({ wellbeingScore: 0.5, sentiment: 'ecstatic' }));
      expect(result.sentiment).toBe('neutral');
    });

    it('parses JSON wrapped in markdown code fences', () => {
      const response = '```json\n{ "wellbeingScore": 0.6, "sentiment": "mixed", "reasoning": "x" }\n```';
      const result = agent.parseResponse(response);
      expect(result.wellbeingScore).toBe(0.6);
    });

    it('returns a neutral fallback for invalid JSON', () => {
      const result = agent.parseResponse('Not JSON at all');
      expect(result).toEqual({
        wellbeingScore: 0.5,
        sentiment: 'neutral',
        reasoning: 'No se pudo analizar el feedback',
      });
    });
  });
});
