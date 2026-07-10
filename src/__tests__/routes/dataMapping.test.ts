import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import express from 'express';
import request from 'supertest';

const tmpUploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dataMapping-test-'));

jest.mock('../../db', () => ({ pool: { query: jest.fn() } }));
jest.mock('../../agents/normalizationAgent', () => ({ detectColumns: jest.fn() }));
jest.mock('../../services/excelParser', () => ({
  parseExcelSample: jest.fn(),
  parseExcelComplete: jest.fn(),
}));
jest.mock('../../services/dataTransformer', () => ({
  transformDataset: jest.fn(),
  calculateDIS: jest.fn(),
}));
jest.mock('../../utils/pathValidator', () => ({
  validateUploadPath: jest.fn(),
  isValidTempMappingFilename: jest.fn(),
  getUploadsDir: () => tmpUploadsDir,
}));
jest.mock('../../services/multiAgentOrchestrator', () => ({
  orchestrator: { analyzeProject: jest.fn() },
}));
jest.mock('../../services/googleSheetsImporter', () => ({
  fetchGoogleSheetCsv: jest.fn(),
}));
jest.mock('../../core/logger', () => ({
  routeLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
let mockUuidCounter = 0;
jest.mock('uuid', () => ({ v4: () => `abc12345-6789-4abc-8def-${String(++mockUuidCounter).padStart(12, '0')}` }));

import dataMappingRouter from '../../routes/dataMapping';
import { pool } from '../../db';
import { detectColumns } from '../../agents/normalizationAgent';
import { parseExcelSample, parseExcelComplete } from '../../services/excelParser';
import { transformDataset, calculateDIS } from '../../services/dataTransformer';
import { validateUploadPath, isValidTempMappingFilename } from '../../utils/pathValidator';
import { orchestrator } from '../../services/multiAgentOrchestrator';
import { fetchGoogleSheetCsv } from '../../services/googleSheetsImporter';

const mockQuery = pool.query as jest.Mock;
const mockDetectColumns = detectColumns as jest.Mock;
const mockParseExcelSample = parseExcelSample as jest.Mock;
const mockParseExcelComplete = parseExcelComplete as jest.Mock;
const mockTransformDataset = transformDataset as jest.Mock;
const mockCalculateDIS = calculateDIS as jest.Mock;
const mockValidateUploadPath = validateUploadPath as jest.Mock;
const mockIsValidTempMappingFilename = isValidTempMappingFilename as jest.Mock;
const mockAnalyzeProject = orchestrator.analyzeProject as jest.Mock;
const mockFetchGoogleSheetCsv = fetchGoogleSheetCsv as jest.Mock;

const app = express();
app.use(express.json());
app.use((req: any, _res, next) => {
  req.user = { id: 'user-1', email: 'me@b.com', role: 'analyst' };
  next();
});
app.use('/api/data/mapping', dataMappingRouter);

beforeEach(() => {
  mockQuery.mockReset();
  mockDetectColumns.mockReset();
  mockParseExcelSample.mockReset();
  mockParseExcelComplete.mockReset();
  mockTransformDataset.mockReset();
  mockCalculateDIS.mockReset();
  mockValidateUploadPath.mockReset();
  mockIsValidTempMappingFilename.mockReset();
  mockAnalyzeProject.mockReset();
  mockFetchGoogleSheetCsv.mockReset();
});

afterAll(() => {
  fs.rmSync(tmpUploadsDir, { recursive: true, force: true });
});

describe('POST /api/data/mapping/detect-columns', () => {
  it('returns 400 when no file is attached', async () => {
    const res = await request(app).post('/api/data/mapping/detect-columns');
    expect(res.status).toBe(400);
  });

  it('rejects files with a disallowed mimetype', async () => {
    const res = await request(app)
      .post('/api/data/mapping/detect-columns')
      .attach('file', Buffer.from('not an excel file'), { filename: 'evil.xlsx', contentType: 'text/plain' });
    // multer's fileFilter rejects via cb(new Error(...)) — with no dedicated
    // multer error handler, that falls through to Express's default 500 handler.
    expect(res.status).toBe(500);
  });

  it('parses the file and returns header suggestions for a valid upload', async () => {
    mockParseExcelSample.mockResolvedValueOnce({
      headers: ['Nombre', 'Presupuesto'],
      sampleRows: [{ Nombre: 'P1', Presupuesto: 1000 }],
      totalRows: 1,
    });
    mockDetectColumns.mockResolvedValueOnce({
      suggestions: [{ originalHeader: 'Nombre', suggestedField: 'project_name', confidence: 0.9, reasoning: 'x' }],
      rawResponse: '{}',
    });

    const res = await request(app)
      .post('/api/data/mapping/detect-columns')
      .attach('file', Buffer.from('fake xlsx bytes'), {
        filename: 'projects.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.headers).toEqual(['Nombre', 'Presupuesto']);
    expect(res.body.data.tempFilename).toMatch(/^temp_mapping_.*\.xlsx$/);
  });

  it('accepts a .csv upload (text/csv)', async () => {
    mockParseExcelSample.mockResolvedValueOnce({
      headers: ['Nombre'],
      sampleRows: [{ Nombre: 'P1' }],
      totalRows: 1,
    });
    mockDetectColumns.mockResolvedValueOnce({
      suggestions: [{ originalHeader: 'Nombre', suggestedField: 'project_name', confidence: 0.9, reasoning: 'x' }],
      rawResponse: '{}',
    });

    const res = await request(app)
      .post('/api/data/mapping/detect-columns')
      .attach('file', Buffer.from('Nombre\nP1'), { filename: 'projects.csv', contentType: 'text/csv' });

    expect(res.status).toBe(200);
    expect(res.body.data.headers).toEqual(['Nombre']);
  });

  it('returns 400 and cleans up the temp file when parsing fails', async () => {
    mockParseExcelSample.mockRejectedValueOnce(new Error('Excel parsing error: too many columns'));

    const filesBefore = fs.readdirSync(tmpUploadsDir).length;

    const res = await request(app)
      .post('/api/data/mapping/detect-columns')
      .attach('file', Buffer.from('fake xlsx bytes'), {
        filename: 'broken.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/too many columns/);
    // temp file that multer wrote should have been cleaned up on failure
    expect(fs.readdirSync(tmpUploadsDir).length).toBe(filesBefore);
  });
});

describe('POST /api/data/mapping/detect-columns-gsheet', () => {
  it('returns 400 when no url is provided', async () => {
    const res = await request(app).post('/api/data/mapping/detect-columns-gsheet').send({});
    expect(res.status).toBe(400);
    expect(mockFetchGoogleSheetCsv).not.toHaveBeenCalled();
  });

  it('imports the sheet and returns header suggestions', async () => {
    mockFetchGoogleSheetCsv.mockResolvedValueOnce(Buffer.from('Nombre,Costo\nP1,100'));
    mockParseExcelSample.mockResolvedValueOnce({
      headers: ['Nombre', 'Costo'],
      sampleRows: [{ Nombre: 'P1', Costo: 100 }],
      totalRows: 1,
    });
    mockDetectColumns.mockResolvedValueOnce({
      suggestions: [{ originalHeader: 'Nombre', suggestedField: 'project_name', confidence: 0.9, reasoning: 'x' }],
      rawResponse: '{}',
    });

    const res = await request(app)
      .post('/api/data/mapping/detect-columns-gsheet')
      .send({ url: 'https://docs.google.com/spreadsheets/d/XYZ/edit#gid=0' });

    expect(res.status).toBe(200);
    expect(res.body.data.headers).toEqual(['Nombre', 'Costo']);
    expect(res.body.data.tempFilename).toMatch(/^temp_mapping_.*\.xlsx$/);
    expect(mockFetchGoogleSheetCsv).toHaveBeenCalledWith('https://docs.google.com/spreadsheets/d/XYZ/edit#gid=0');
  });

  it('returns 400 with the importer message when the sheet is not accessible', async () => {
    mockFetchGoogleSheetCsv.mockRejectedValueOnce(new Error('La hoja no es accesible.'));

    const res = await request(app)
      .post('/api/data/mapping/detect-columns-gsheet')
      .send({ url: 'https://docs.google.com/spreadsheets/d/XYZ/edit' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no es accesible/);
  });
});

describe('POST /api/data/mapping/save-mapping', () => {
  it('returns 400 when the request body fails schema validation', async () => {
    const res = await request(app).post('/api/data/mapping/save-mapping').send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 when the tempFilename is not a valid temp-mapping filename', async () => {
    mockIsValidTempMappingFilename.mockReturnValueOnce(false);

    const res = await request(app).post('/api/data/mapping/save-mapping').send({
      tempFilename: 'not_a_real_temp_file.xlsx',
      confirmedMapping: { Nombre: 'project_name' },
      framework: 'scrum',
      org: 'Acme',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid temporary filename/);
  });

  it('processes a valid mapping end-to-end and triggers analysis', async () => {
    mockIsValidTempMappingFilename.mockReturnValueOnce(true);
    mockValidateUploadPath.mockReturnValueOnce('/tmp/uploads/temp_mapping_abc.xlsx');
    mockParseExcelComplete.mockResolvedValueOnce([{ Nombre: 'Proyecto A', Presupuesto: 1000 }]);
    mockTransformDataset.mockReturnValueOnce([{
      project_name: 'Proyecto A', estimated_cost: 1000, actual_cost: 0, progress_percent: 0,
      status: null, start_date: null, end_date: null, risks: null,
    }]);
    mockCalculateDIS.mockReturnValueOnce({ score: 80, grade: 'B', label: 'Buena', fieldCoverage: {}, totalRows: 1, mappedFields: 1 });
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 42 }] }) // INSERT project_data
      .mockResolvedValueOnce({ rows: [] }); // INSERT ai_analyses (normalization)
    mockAnalyzeProject.mockResolvedValueOnce({ combined: true });

    const res = await request(app).post('/api/data/mapping/save-mapping').send({
      tempFilename: 'temp_mapping_abc.xlsx',
      confirmedMapping: { Nombre: 'project_name', Presupuesto: 'estimated_cost' },
      framework: 'scrum',
      org: 'Acme',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.rowsProcessed).toBe(1);
    expect(res.body.projectId).toBe(42);
    expect(mockAnalyzeProject).toHaveBeenCalledWith(expect.any(Number), 'scrum', 'user-1', 'Acme', 'es');
  });

  it('returns 400 when every transformed row fails the strict schema', async () => {
    mockIsValidTempMappingFilename.mockReturnValueOnce(true);
    mockValidateUploadPath.mockReturnValueOnce('/tmp/uploads/temp_mapping_abc.xlsx');
    mockParseExcelComplete.mockResolvedValueOnce([{ Nombre: 'Proyecto A' }]);
    // estimated_cost negative fails TransformedProjectRowSchema's nonnegative() check
    mockTransformDataset.mockReturnValueOnce([{
      project_name: 'Proyecto A', estimated_cost: -5, actual_cost: 0, progress_percent: 0,
    }]);
    mockCalculateDIS.mockReturnValueOnce({ score: 10, grade: 'F', label: 'Crítica', fieldCoverage: {}, totalRows: 1, mappedFields: 0 });

    const res = await request(app).post('/api/data/mapping/save-mapping').send({
      tempFilename: 'temp_mapping_abc.xlsx',
      confirmedMapping: { Nombre: 'project_name' },
      framework: 'scrum',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/No valid rows/);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('returns 400 when transformDataset throws (e.g. no valid rows)', async () => {
    mockIsValidTempMappingFilename.mockReturnValueOnce(true);
    mockValidateUploadPath.mockReturnValueOnce('/tmp/uploads/temp_mapping_abc.xlsx');
    mockParseExcelComplete.mockResolvedValueOnce([{ Nombre: '' }]);
    mockTransformDataset.mockImplementationOnce(() => { throw new Error('No valid rows found after transformation'); });

    const res = await request(app).post('/api/data/mapping/save-mapping').send({
      tempFilename: 'temp_mapping_abc.xlsx',
      confirmedMapping: { Nombre: 'project_name' },
      framework: 'scrum',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/No valid rows/);
  });

  it('still returns success if the post-save analysis orchestration throws', async () => {
    mockIsValidTempMappingFilename.mockReturnValueOnce(true);
    mockValidateUploadPath.mockReturnValueOnce('/tmp/uploads/temp_mapping_abc.xlsx');
    mockParseExcelComplete.mockResolvedValueOnce([{ Nombre: 'Proyecto A' }]);
    mockTransformDataset.mockReturnValueOnce([{
      project_name: 'Proyecto A', estimated_cost: 0, actual_cost: 0, progress_percent: 0,
    }]);
    mockCalculateDIS.mockReturnValueOnce({ score: 10, grade: 'F', label: 'Crítica', fieldCoverage: {}, totalRows: 1, mappedFields: 0 });
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 7 }] })
      .mockResolvedValueOnce({ rows: [] });
    mockAnalyzeProject.mockRejectedValueOnce(new Error('AI down'));

    const res = await request(app).post('/api/data/mapping/save-mapping').send({
      tempFilename: 'temp_mapping_abc.xlsx',
      confirmedMapping: { Nombre: 'project_name' },
      framework: 'scrum',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('appends a snapshot to an existing project when targetProjectId is set (Fase 2)', async () => {
    mockIsValidTempMappingFilename.mockReturnValueOnce(true);
    mockValidateUploadPath.mockReturnValueOnce('/tmp/uploads/temp_mapping_abc.xlsx');
    mockParseExcelComplete.mockResolvedValueOnce([{ Nombre: 'Proyecto A' }]);
    mockTransformDataset.mockReturnValueOnce([{
      project_name: 'Proyecto A', estimated_cost: 1000, actual_cost: 0, progress_percent: 0,
    }]);
    mockCalculateDIS.mockReturnValueOnce({ score: 80, grade: 'B', label: 'Buena', fieldCoverage: {}, totalRows: 1, mappedFields: 1 });
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 99, projectid: 12345, projectname: 'Proyecto Alfa' }] }) // SELECT existing
      .mockResolvedValueOnce({ rows: [] }) // UPDATE project_data updatedat
      .mockResolvedValueOnce({ rows: [] }); // INSERT ai_analyses (normalization)
    mockAnalyzeProject.mockResolvedValueOnce({ combined: true });

    const res = await request(app).post('/api/data/mapping/save-mapping').send({
      tempFilename: 'temp_mapping_abc.xlsx',
      confirmedMapping: { Nombre: 'project_name' },
      framework: 'scrum',
      org: 'ignorado',
      targetProjectId: 99,
    });

    expect(res.status).toBe(200);
    expect(res.body.projectId).toBe(99); // returns the existing project_data.id
    // No new project row is created; the existing projectid is reused for analysis.
    const insertedProject = mockQuery.mock.calls.some(c => /INSERT INTO project_data/.test(c[0]));
    expect(insertedProject).toBe(false);
    expect(mockAnalyzeProject).toHaveBeenCalledWith(12345, 'scrum', 'user-1', 'Proyecto Alfa', 'es');
  });

  it('returns 400 when targetProjectId does not belong to the user', async () => {
    mockIsValidTempMappingFilename.mockReturnValueOnce(true);
    mockValidateUploadPath.mockReturnValueOnce('/tmp/uploads/temp_mapping_abc.xlsx');
    mockParseExcelComplete.mockResolvedValueOnce([{ Nombre: 'Proyecto A' }]);
    mockTransformDataset.mockReturnValueOnce([{
      project_name: 'Proyecto A', estimated_cost: 0, actual_cost: 0, progress_percent: 0,
    }]);
    mockCalculateDIS.mockReturnValueOnce({ score: 10, grade: 'F', label: 'Crítica', fieldCoverage: {}, totalRows: 1, mappedFields: 0 });
    mockQuery.mockResolvedValueOnce({ rows: [] }); // SELECT existing -> not found

    const res = await request(app).post('/api/data/mapping/save-mapping').send({
      tempFilename: 'temp_mapping_abc.xlsx',
      confirmedMapping: { Nombre: 'project_name' },
      framework: 'scrum',
      targetProjectId: 999,
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/destino no encontrado/);
  });
});
