/**
 * excelParser.ts
 * Secure Excel file parsing with DoS prevention
 * Extracts headers and sample rows with strict limits
 */

import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const MAX_COLUMNS = 50;
const SAMPLE_ROWS_COUNT = 3;

interface ExcelParseResult {
  headers: string[];
  sampleRows: Record<string, any>[];
  totalRows: number;
}

/**
 * Safely parse Excel file and extract headers + sample data
 * @param filePath - Absolute path to Excel file
 * @returns Headers array and sample rows
 * @throws Error if file is malformed or exceeds limits
 */
export async function parseExcelSample(filePath: string): Promise<ExcelParseResult> {
  try {
    // Verify file exists and is readable
    if (!fs.existsSync(filePath)) {
      throw new Error(`Excel file not found: ${filePath}`);
    }

    const fileBuffer = fs.readFileSync(filePath);

    // Parse workbook
    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(fileBuffer, {
        type: 'buffer',
        cellFormula: false, // Don't extract formulas to save tokens
        cellNF: false,
      });
    } catch (err) {
      throw new Error(`Failed to parse Excel file: ${(err as Error).message}`);
    }

    if (!workbook.SheetNames.length) {
      throw new Error('Excel file contains no sheets');
    }

    // Use first sheet
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    if (!worksheet) {
      throw new Error('Unable to read first sheet');
    }

    // Parse with header detection
    const data = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
      defval: '', // Default value for empty cells
    });

    if (data.length === 0) {
      throw new Error('Excel sheet contains no data rows');
    }

    // Extract headers from first row keys
    const headers = Object.keys(data[0]);

    // DoS Prevention: Limit columns
    if (headers.length > MAX_COLUMNS) {
      throw new Error(
        `Excel file has too many columns (${headers.length}). Maximum allowed: ${MAX_COLUMNS}`
      );
    }

    // Extract sample rows (first SAMPLE_ROWS_COUNT rows or less)
    const sampleRows = data.slice(0, SAMPLE_ROWS_COUNT);

    return {
      headers,
      sampleRows,
      totalRows: data.length,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    throw new Error(`Excel parsing error: ${errorMessage}`);
  }
}

/**
 * Read all data from Excel file for final processing
 * Used after mapping confirmation
 * @param filePath - Absolute path to Excel file
 * @returns Array of all rows
 */
export async function parseExcelComplete(filePath: string): Promise<Record<string, any>[]> {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Excel file not found: ${filePath}`);
    }

    const fileBuffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellFormula: false });

    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    const data = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
      defval: '',
    });

    // DoS Prevention: Check column count
    if (data.length > 0) {
      const headers = Object.keys(data[0]);
      if (headers.length > MAX_COLUMNS) {
        throw new Error(
          `Excel file has too many columns (${headers.length}). Maximum allowed: ${MAX_COLUMNS}`
        );
      }
    }

    return data;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    throw new Error(`Excel parsing error: ${errorMessage}`);
  }
}