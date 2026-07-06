import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import XLSX from 'xlsx';
import { ExcelAdapter } from '../../../services/adapters/ExcelAdapter';

jest.mock('../../../core/logger', () => ({
  serviceLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

function writeXlsx(rows: Record<string, any>[]): string {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  const filePath = path.join(os.tmpdir(), `excel-adapter-${Date.now()}-${Math.random().toString(36).slice(2)}.xlsx`);
  XLSX.writeFile(wb, filePath);
  return filePath;
}

const validRow = {
  projectId: 1,
  projectName: 'Proyecto Alpha',
  status: 'In Progress',
  timeline: JSON.stringify({
    startDate: '2026-01-01T00:00:00.000Z',
    endDate: '2026-06-01T00:00:00.000Z',
    daysElapsed: 30,
    daysRemaining: 120,
    percentageComplete: 40,
  }),
  teamVelocity: JSON.stringify([30, 32, 35]),
  workPending: JSON.stringify({ epicsRemaining: 2, tasksRemaining: 10, totalStoryPoints: 40 }),
  budget: JSON.stringify({ totalBudget: 10000, spent: 4000, remaining: 6000, percentageSpent: 40 }),
  resources: JSON.stringify([{ role: 'Dev', count: 3, costPerMonth: 5000 }]),
  risks: JSON.stringify([{ description: 'Scope creep', severity: 'medium', probability: 0.3 }]),
};

describe('ExcelAdapter.read', () => {
  const filesToClean: string[] = [];
  afterAll(() => filesToClean.forEach(f => fs.existsSync(f) && fs.unlinkSync(f)));

  it('throws when the file does not exist', async () => {
    const adapter = new ExcelAdapter('/nonexistent/file.xlsx');
    await expect(adapter.read()).rejects.toThrow(/no encontrado/);
  });

  it('parses JSON-stringified nested fields and returns valid rows', async () => {
    const filePath = writeXlsx([validRow]);
    filesToClean.push(filePath);

    const adapter = new ExcelAdapter(filePath);
    const result = await adapter.read();

    expect(result).toHaveLength(1);
    expect(result[0].projectName).toBe('Proyecto Alpha');
    expect(result[0].timeline.percentageComplete).toBe(40);
    expect(result[0].budget.totalBudget).toBe(10000);
  });

  it('silently drops rows that fail schema validation', async () => {
    const invalidRow = { ...validRow, projectId: 2, status: 'Not A Real Status' };
    const filePath = writeXlsx([validRow, invalidRow]);
    filesToClean.push(filePath);

    const adapter = new ExcelAdapter(filePath);
    const result = await adapter.read();

    expect(result).toHaveLength(1);
    expect(result[0].projectId).toBe(1);
  });
});

describe('ExcelAdapter.readWithDetails', () => {
  const filesToClean: string[] = [];
  afterAll(() => filesToClean.forEach(f => fs.existsSync(f) && fs.unlinkSync(f)));

  it('throws when the file does not exist', async () => {
    const adapter = new ExcelAdapter('/nonexistent/file.xlsx');
    await expect(adapter.readWithDetails()).rejects.toThrow(/no encontrado/);
  });

  it('separates valid projects from rejected rows with field-level Zod errors', async () => {
    const invalidRow = { ...validRow, projectId: 2, status: 'Not A Real Status' };
    const filePath = writeXlsx([validRow, invalidRow]);
    filesToClean.push(filePath);

    const adapter = new ExcelAdapter(filePath);
    const result = await adapter.readWithDetails();

    expect(result.validProjects).toHaveLength(1);
    expect(result.rejectedRows).toHaveLength(1);
    expect(result.rejectedRows[0].rowIndex).toBe(3); // row 2 in the sheet = index 1 + 2
    expect(result.rejectedRows[0].errors.some(e => e.startsWith('status:'))).toBe(true);
  });

  it('reports a rejected row when a required field is completely missing', async () => {
    const { budget, ...rowWithoutBudget } = validRow;
    const filePath = writeXlsx([rowWithoutBudget]);
    filesToClean.push(filePath);

    const adapter = new ExcelAdapter(filePath);
    const result = await adapter.readWithDetails();

    expect(result.validProjects).toHaveLength(0);
    expect(result.rejectedRows).toHaveLength(1);
    expect(result.rejectedRows[0].errors.some(e => e.startsWith('budget'))).toBe(true);
  });

  it('leaves a malformed JSON field as a raw string, which then fails schema validation', async () => {
    const malformedRow = { ...validRow, projectId: 3, teamVelocity: '{not valid json' };
    const filePath = writeXlsx([malformedRow]);
    filesToClean.push(filePath);

    const adapter = new ExcelAdapter(filePath);
    const result = await adapter.readWithDetails();

    expect(result.validProjects).toHaveLength(0);
    expect(result.rejectedRows[0].errors.some(e => e.startsWith('teamVelocity'))).toBe(true);
  });
});

describe('ExcelAdapter.validate', () => {
  it('returns true for a valid ProjectData object', async () => {
    const adapter = new ExcelAdapter('irrelevant.xlsx');
    const parsed = {
      ...validRow,
      timeline: JSON.parse(validRow.timeline),
      teamVelocity: JSON.parse(validRow.teamVelocity),
      workPending: JSON.parse(validRow.workPending),
      budget: JSON.parse(validRow.budget),
      resources: JSON.parse(validRow.resources),
      risks: JSON.parse(validRow.risks),
    };
    expect(await adapter.validate(parsed)).toBe(true);
  });

  it('returns false for an object missing required fields', async () => {
    const adapter = new ExcelAdapter('irrelevant.xlsx');
    expect(await adapter.validate({ projectId: 1 })).toBe(false);
  });
});
