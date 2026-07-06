import express from 'express';
import request from 'supertest';
import chatRouter from '../../routes/chat';
import { AuthRequest } from '../../middleware/requireAuth';

jest.mock('../../db', () => ({ pool: { query: jest.fn() } }));
jest.mock('../../config/anthropic', () => ({
  anthropicClient: { messages: { create: jest.fn() } },
  aiConfig: { model: 'claude-opus-4-6', maxTokens: 2000, temperature: 0.7 },
}));
jest.mock('../../core/logger', () => ({
  routeLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { pool } from '../../db';
import { anthropicClient } from '../../config/anthropic';

const mockQuery = pool.query as jest.Mock;
const mockCreate = anthropicClient.messages.create as jest.Mock;

function textResponse(text: string) {
  return { content: [{ type: 'text', text }] };
}

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  (req as AuthRequest).user = { id: 'user-1', email: 'me@b.com', role: 'analyst' };
  next();
});
app.use('/api/chat', chatRouter);

beforeEach(() => {
  mockQuery.mockReset();
  mockCreate.mockReset();
});

describe('POST /api/chat', () => {
  it('returns 400 when the message is missing', async () => {
    const res = await request(app).post('/api/chat').send({});
    expect(res.status).toBe(400);
  });

  it('returns the assistant reply with no actions when there is no <actions> block', async () => {
    mockCreate.mockResolvedValueOnce(textResponse('Claro, aquí está mi respuesta.'));

    const res = await request(app).post('/api/chat').send({ message: '¿Qué es CPI?' });

    expect(res.status).toBe(200);
    expect(res.body.reply).toBe('Claro, aquí está mi respuesta.');
    expect(res.body.actions).toEqual([]);
  });

  it('parses the <actions> block out of the reply', async () => {
    mockCreate.mockResolvedValueOnce(textResponse(
      'Detecté un riesgo de presupuesto.\n<actions>\n[{"id":"draft_team","label":"Redactar","intent":"draft:team"}]\n</actions>'
    ));

    const res = await request(app).post('/api/chat').send({ message: 'Cómo va el presupuesto?' });

    expect(res.status).toBe(200);
    expect(res.body.reply).toBe('Detecté un riesgo de presupuesto.');
    expect(res.body.actions).toEqual([{ id: 'draft_team', label: 'Redactar', intent: 'draft:team' }]);
  });

  it('returns 500 when the Claude API call fails', async () => {
    mockCreate.mockRejectedValueOnce(new Error('API down'));
    const res = await request(app).post('/api/chat').send({ message: 'hola' });
    expect(res.status).toBe(500);
  });
});

describe('POST /api/chat/draft', () => {
  it('returns 400 for an invalid audience', async () => {
    const res = await request(app).post('/api/chat/draft').send({ audience: 'ceo', alertContext: 'x' });
    expect(res.status).toBe(400);
  });

  it('returns a generated draft for a valid request', async () => {
    mockCreate.mockResolvedValueOnce(textResponse('  Mensaje redactado.  '));

    const res = await request(app).post('/api/chat/draft').send({
      audience: 'team',
      alertContext: 'Presupuesto sobrepasado en 10%',
    });

    expect(res.status).toBe(200);
    expect(res.body.draft).toBe('Mensaje redactado.');
    expect(res.body.audience).toBe('team');
  });
});

describe('POST /api/chat/simulate', () => {
  it('returns 400 when the question is missing', async () => {
    const res = await request(app).post('/api/chat/simulate').send({});
    expect(res.status).toBe(400);
  });

  it('parses the scenario, runs the deterministic simulation, and narrates it', async () => {
    mockCreate
      .mockResolvedValueOnce(textResponse('{"type":"schedule_delay","weeks":2,"label":"Retraso de 2 semanas"}'))
      .mockResolvedValueOnce(textResponse('El retraso afecta el cronograma.'));

    const res = await request(app).post('/api/chat/simulate').send({
      question: '¿Qué pasa si nos atrasamos dos semanas?',
      metrics: { cpi: 1, spi: 0.9, bac: 10000, ac: 4000, ev: 4500, pv: 5000 },
      projectName: 'Proyecto X',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.narrative).toBe('El retraso afecta el cronograma.');
    expect(res.body.result.before).toBeDefined();
    expect(res.body.result.after).toBeDefined();
  });

  it('defaults to a 2-week schedule delay when Claude returns unparseable JSON', async () => {
    mockCreate
      .mockResolvedValueOnce(textResponse('not valid json'))
      .mockResolvedValueOnce(textResponse('Narración por defecto.'));

    const res = await request(app).post('/api/chat/simulate').send({
      question: 'texto ambiguo',
      metrics: { cpi: 1, spi: 1, bac: 10000, ac: 5000 },
      projectName: 'Proyecto Y',
    });

    expect(res.status).toBe(200);
    expect(res.body.scenario).toBe('Retraso de 2 semanas');
  });
});

describe('GET /api/chat/context/:projectId', () => {
  it('returns 400 for a non-numeric projectId', async () => {
    const res = await request(app).get('/api/chat/context/abc');
    expect(res.status).toBe(400);
  });

  it('returns context:null when the project has no analysis yet', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/chat/context/1');
    expect(res.status).toBe(200);
    expect(res.body.context).toBeNull();
  });

  it('returns the project context scoped to the authenticated user', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ projectname: 'Proyecto Z', output: { metrics: { cpi: 1.1 }, earlyWarnings: { hasAlerts: true } } }],
    });

    const res = await request(app).get('/api/chat/context/1');

    expect(res.status).toBe(200);
    expect(res.body.context.projectName).toBe('Proyecto Z');
    expect(res.body.context.metrics.cpi).toBe(1.1);
    expect(mockQuery.mock.calls[0][1]).toEqual([1, 'user-1']);
  });
});
