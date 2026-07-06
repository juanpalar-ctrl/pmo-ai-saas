const mockCreate = jest.fn();

jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  }));
});
jest.mock('../../core/logger', () => ({
  agentLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { detectColumns, buildMappingRecord } from '../../agents/normalizationAgent';

function textResponse(text: string) {
  return { content: [{ type: 'text', text }] };
}

describe('detectColumns', () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it('returns validated suggestions parsed from a clean JSON response', async () => {
    mockCreate.mockResolvedValueOnce(textResponse(JSON.stringify({
      suggestions: [
        { originalHeader: 'Nombre', suggestedField: 'project_name', confidence: 0.95, reasoning: 'clear' },
        { originalHeader: 'Presupuesto', suggestedField: 'estimated_cost', confidence: 0.8, reasoning: 'budget' },
      ],
    })));

    const result = await detectColumns({ headers: ['Nombre', 'Presupuesto'], sampleRows: [] });

    expect(result.suggestions).toHaveLength(2);
    expect(result.suggestions[0].originalHeader).toBe('Nombre');
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('strips markdown code fences before parsing', async () => {
    mockCreate.mockResolvedValueOnce(textResponse(
      '```json\n{"suggestions":[{"originalHeader":"A","suggestedField":null,"confidence":0.5,"reasoning":"x"}]}\n```'
    ));

    const result = await detectColumns({ headers: ['A'], sampleRows: [] });
    expect(result.suggestions[0].originalHeader).toBe('A');
    expect(result.suggestions[0].suggestedField).toBeNull();
  });

  it('drops suggestions that fail schema validation but keeps the valid ones', async () => {
    mockCreate.mockResolvedValueOnce(textResponse(JSON.stringify({
      suggestions: [
        { originalHeader: 'Good', suggestedField: 'project_name', confidence: 0.9, reasoning: 'ok' },
        { originalHeader: 'Bad', suggestedField: 'not_a_real_field', confidence: 0.9, reasoning: 'bad' },
      ],
    })));

    const result = await detectColumns({ headers: ['Good', 'Bad'], sampleRows: [] });
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0].originalHeader).toBe('Good');
  });

  it('retries on malformed JSON and succeeds on a later attempt', async () => {
    mockCreate
      .mockResolvedValueOnce(textResponse('not json at all'))
      .mockResolvedValueOnce(textResponse(JSON.stringify({
        suggestions: [{ originalHeader: 'A', suggestedField: 'project_name', confidence: 0.9, reasoning: 'ok' }],
      })));

    const promise = detectColumns({ headers: ['A'], sampleRows: [] });
    // Let the 1s backoff delay before the retry elapse.
    await jest.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(result.suggestions).toHaveLength(1);
  }, 10000);

  it('throws after exhausting all retries on persistent failure', async () => {
    mockCreate.mockResolvedValue(textResponse('still not json'));

    const promise = detectColumns({ headers: ['A'], sampleRows: [] });
    const expectation = expect(promise).rejects.toThrow(/Failed to detect columns after 3 attempts/);

    await jest.advanceTimersByTimeAsync(1000);
    await jest.advanceTimersByTimeAsync(2000);
    await expectation;

    expect(mockCreate).toHaveBeenCalledTimes(3);
  }, 10000);

  beforeAll(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick'] });
  });

  afterAll(() => {
    jest.useRealTimers();
  });
});

describe('buildMappingRecord', () => {
  it('maps original headers to their suggested field', () => {
    const record = buildMappingRecord([
      { originalHeader: 'Nombre', suggestedField: 'project_name', confidence: 0.9, reasoning: 'x' },
      { originalHeader: 'Extra', suggestedField: null, confidence: 0.1, reasoning: 'y' },
    ] as any);

    expect(record).toEqual({ Nombre: 'project_name', Extra: null });
  });

  it('returns an empty object for an empty suggestions array', () => {
    expect(buildMappingRecord([])).toEqual({});
  });
});
