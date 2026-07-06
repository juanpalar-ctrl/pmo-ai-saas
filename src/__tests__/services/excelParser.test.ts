import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import XLSX from 'xlsx';
import { parseExcelSample, parseExcelComplete } from '../../services/excelParser';

function writeXlsx(rows: Record<string, any>[], filename: string): string {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  const filePath = path.join(os.tmpdir(), filename);
  XLSX.writeFile(wb, filePath);
  return filePath;
}

describe('parseExcelSample', () => {
  const filesToClean: string[] = [];

  afterAll(() => {
    for (const f of filesToClean) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
  });

  it('extracts headers, sample rows, and totalRows from a valid file', async () => {
    const filePath = writeXlsx([
      { Name: 'Proyecto A', Budget: 1000 },
      { Name: 'Proyecto B', Budget: 2000 },
      { Name: 'Proyecto C', Budget: 3000 },
      { Name: 'Proyecto D', Budget: 4000 },
    ], `sample-${Date.now()}.xlsx`);
    filesToClean.push(filePath);

    const result = await parseExcelSample(filePath);

    expect(result.headers).toEqual(['Name', 'Budget']);
    expect(result.totalRows).toBe(4);
    expect(result.sampleRows).toHaveLength(3); // capped at SAMPLE_ROWS_COUNT
    expect(result.sampleRows[0].Name).toBe('Proyecto A');
  });

  it('throws when the file does not exist', async () => {
    await expect(parseExcelSample('/nonexistent/path/file.xlsx'))
      .rejects.toThrow(/not found|parsing error/i);
  });

  it('throws when the sheet has no data rows', async () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([]);
    XLSX.utils.book_append_sheet(wb, ws, 'Empty');
    const filePath = path.join(os.tmpdir(), `empty-${Date.now()}.xlsx`);
    XLSX.writeFile(wb, filePath);
    filesToClean.push(filePath);

    await expect(parseExcelSample(filePath)).rejects.toThrow(/no data rows|parsing error/i);
  });

  it('throws when there are more than 50 columns (DoS prevention)', async () => {
    const row: Record<string, any> = {};
    for (let i = 0; i < 51; i++) row[`col_${i}`] = i;
    const filePath = writeXlsx([row], `wide-${Date.now()}.xlsx`);
    filesToClean.push(filePath);

    await expect(parseExcelSample(filePath)).rejects.toThrow(/too many columns/i);
  });
});

describe('parseExcelComplete', () => {
  const filesToClean: string[] = [];

  afterAll(() => {
    for (const f of filesToClean) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
  });

  it('returns every row, not just a sample', async () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ Name: `Proyecto ${i}`, Budget: i * 100 }));
    const filePath = writeXlsx(rows, `complete-${Date.now()}.xlsx`);
    filesToClean.push(filePath);

    const result = await parseExcelComplete(filePath);

    expect(result).toHaveLength(10);
    expect(result[9].Name).toBe('Proyecto 9');
  });

  it('throws when the file does not exist', async () => {
    await expect(parseExcelComplete('/nonexistent/path/file.xlsx'))
      .rejects.toThrow(/not found|parsing error/i);
  });

  it('throws when there are more than 50 columns (DoS prevention)', async () => {
    const row: Record<string, any> = {};
    for (let i = 0; i < 51; i++) row[`col_${i}`] = i;
    const filePath = writeXlsx([row], `wide-complete-${Date.now()}.xlsx`);
    filesToClean.push(filePath);

    await expect(parseExcelComplete(filePath)).rejects.toThrow(/too many columns/i);
  });
});
