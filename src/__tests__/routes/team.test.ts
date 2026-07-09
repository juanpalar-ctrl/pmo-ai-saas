import express from 'express';
import request from 'supertest';
import teamRouter from '../../routes/team';
import { AuthRequest } from '../../middleware/requireAuth';

jest.mock('../../db', () => ({ pool: { query: jest.fn() } }));
jest.mock('../../services/teamService', () => ({
  teamService: {
    getTeamBoard: jest.fn(),
    getTeamBoardsForUser: jest.fn(),
    addFeedbackNote: jest.fn(),
    updateMemberRole: jest.fn(),
    getFeedbackNotes: jest.fn(),
  },
}));
jest.mock('../../core/logger', () => ({
  routeLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { pool } from '../../db';
import { teamService } from '../../services/teamService';

const mockQuery = pool.query as jest.Mock;
const mockGetTeamBoard = teamService.getTeamBoard as jest.Mock;
const mockGetTeamBoardsForUser = teamService.getTeamBoardsForUser as jest.Mock;
const mockAddFeedbackNote = teamService.addFeedbackNote as jest.Mock;
const mockUpdateMemberRole = teamService.updateMemberRole as jest.Mock;
const mockGetFeedbackNotes = teamService.getFeedbackNotes as jest.Mock;

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  (req as AuthRequest).user = { id: 'user-1', email: 'me@b.com', role: 'analyst' };
  next();
});
app.use('/api/team', teamRouter);

beforeEach(() => {
  mockQuery.mockReset();
  mockGetTeamBoard.mockReset();
  mockGetTeamBoardsForUser.mockReset();
  mockAddFeedbackNote.mockReset();
  mockUpdateMemberRole.mockReset();
  mockGetFeedbackNotes.mockReset();
});

// ─── GET / (aggregate) ────────────────────────────────────────────────────────

describe('GET /api/team', () => {
  it('returns the aggregate team board for the authenticated user', async () => {
    mockGetTeamBoardsForUser.mockResolvedValueOnce({
      groupSatisfactionScore: 75,
      projects: [{ projectId: 10, projectName: 'Proyecto X', groupSatisfactionScore: 75, members: [{ id: 1, name: 'Ana' }] }],
    });

    const res = await request(app).get('/api/team');

    expect(res.status).toBe(200);
    expect(res.body.data.groupSatisfactionScore).toBe(75);
    expect(res.body.data.projects).toHaveLength(1);
    expect(mockGetTeamBoardsForUser).toHaveBeenCalledWith('user-1');
  });

  it('returns 500 when the service throws', async () => {
    mockGetTeamBoardsForUser.mockRejectedValueOnce(new Error('db down'));

    const res = await request(app).get('/api/team');

    expect(res.status).toBe(500);
  });
});

// ─── GET /:projectId ──────────────────────────────────────────────────────────

describe('GET /api/team/:projectId', () => {
  it('returns 400 for a non-numeric projectId', async () => {
    const res = await request(app).get('/api/team/abc');
    expect(res.status).toBe(400);
  });

  it('returns 404 when the project is not owned by the user', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/team/1');
    expect(res.status).toBe(404);
  });

  it('returns the team board for an owned project', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ projectid: 5, projectname: 'Proyecto X' }] }) // ownership
      .mockResolvedValueOnce({ rows: [{ output: { projects: [{ project_name: 'X', assignee: 'Ana' }] } }] }); // task rows
    mockGetTeamBoard.mockResolvedValueOnce({ members: [{ id: 1, name: 'Ana' }], groupSatisfactionScore: 80 });

    const res = await request(app).get('/api/team/1');

    expect(res.status).toBe(200);
    expect(res.body.data.groupSatisfactionScore).toBe(80);
    expect(res.body.data.projectName).toBe('Proyecto X');
    expect(mockGetTeamBoard).toHaveBeenCalledWith(5, [{ project_name: 'X', assignee: 'Ana' }]);
  });
});

// ─── POST /:projectId/members/:memberId/feedback ─────────────────────────────

describe('POST /api/team/:projectId/members/:memberId/feedback', () => {
  it('returns 400 when noteText is missing', async () => {
    const res = await request(app).post('/api/team/1/members/2/feedback').send({});
    expect(res.status).toBe(400);
  });

  it('returns 404 when the project is not owned by the user', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).post('/api/team/1/members/2/feedback').send({ noteText: 'Todo bien' });
    expect(res.status).toBe(404);
  });

  it('returns the wellbeing analysis on success', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ projectid: 5 }] });
    mockAddFeedbackNote.mockResolvedValueOnce({ wellbeingScore: 0.7, sentiment: 'positive', reasoning: 'Bien' });

    const res = await request(app).post('/api/team/1/members/2/feedback').send({ noteText: 'Todo bien' });

    expect(res.status).toBe(200);
    expect(res.body.data.wellbeingScore).toBe(0.7);
    expect(mockAddFeedbackNote).toHaveBeenCalledWith(2, 5, 'user-1', 'Todo bien', undefined);
  });

  it('returns 404 when the member does not belong to the project', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ projectid: 5 }] });
    mockAddFeedbackNote.mockRejectedValueOnce(new Error('Miembro de equipo no encontrado'));

    const res = await request(app).post('/api/team/1/members/2/feedback').send({ noteText: 'x' });

    expect(res.status).toBe(404);
  });
});

// ─── PATCH /:projectId/members/:memberId ──────────────────────────────────────

describe('PATCH /api/team/:projectId/members/:memberId', () => {
  it('returns 400 when role is missing', async () => {
    const res = await request(app).patch('/api/team/1/members/2').send({});
    expect(res.status).toBe(400);
  });

  it('updates the role on success', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ projectid: 5 }] });
    mockUpdateMemberRole.mockResolvedValueOnce(undefined);

    const res = await request(app).patch('/api/team/1/members/2').send({ role: 'QA Lead' });

    expect(res.status).toBe(200);
    expect(mockUpdateMemberRole).toHaveBeenCalledWith(2, 5, 'user-1', 'QA Lead');
  });
});

// ─── GET /:projectId/members/:memberId/notes ──────────────────────────────────

describe('GET /api/team/:projectId/members/:memberId/notes', () => {
  it('returns the feedback history', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ projectid: 5 }] });
    mockGetFeedbackNotes.mockResolvedValueOnce([{ id: 1, noteText: 'x', wellbeingScore: 0.5 }]);

    const res = await request(app).get('/api/team/1/members/2/notes');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});
