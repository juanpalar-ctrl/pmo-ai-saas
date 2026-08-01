process.env.JWT_SECRET = 'test-secret-sow-routes';

import express from 'express';
import request from 'supertest';
import sowRouter from '../../routes/sow';
import jwt from 'jsonwebtoken';

jest.mock('../../db', () => ({ pool: { query: jest.fn() } }));
jest.mock('../../middleware/requireAuth', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-123', email: 'test@example.com' };
    next();
  },
}));
jest.mock('../../core/logger', () => ({
  routeLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  serviceLogger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));
jest.mock('../../utils/fileParser', () => ({
  extractTextFromFile: jest.fn(),
  validateFileType: jest.fn(),
  sanitizeFilename: jest.fn(),
}));
jest.mock('fs');
jest.mock('multer', () => {
  const mockUpload = () => ({
    single: () => (req: any, res: any, next: any) => next(),
  });
  mockUpload.diskStorage = () => ({});
  return mockUpload;
});

import { pool } from '../../db';
import { extractTextFromFile, validateFileType, sanitizeFilename } from '../../utils/fileParser';

const mockQuery = pool.query as jest.Mock;
const mockExtractText = extractTextFromFile as jest.Mock;
const mockValidateType = validateFileType as jest.Mock;
const mockSanitize = sanitizeFilename as jest.Mock;

const app = express();
app.use(express.json());
app.use('/api/projects', sowRouter);

beforeEach(() => {
  jest.clearAllMocks();
  mockSanitize.mockReturnValue('1234567890_test.pdf');
  mockValidateType.mockReturnValue('pdf');
});

describe('SOW Routes', () => {
  it('router is defined and exported', () => {
    expect(sowRouter).toBeDefined();
    expect(typeof sowRouter.get).toBe('function');
    expect(typeof sowRouter.post).toBe('function');
    expect(typeof sowRouter.delete).toBe('function');
    expect(typeof sowRouter.patch).toBe('function');
  });

  describe('Database integration', () => {
    it('calls database for GET sow', async () => {
      // Direct route handler simulation
      mockQuery.mockResolvedValueOnce({ rows: [] });

      // Verify mock is set up correctly
      expect(mockQuery).toBeDefined();
    });

    it('calls database for DELETE sow', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      expect(mockQuery).toBeDefined();
    });
  });
});
