/**
 * dataTransformer.ts
 * Flexible data transformation and cleaning
 * Converts various input formats to standardized types with automatic fallbacks
 */

import { TransformedProjectRow } from '../config/validation';

interface TransformationContext {
  originalRowIndex: number;
  projectNameField: string;
  statusField?: string;
  estimatedCostField?: string;
  actualCostField?: string;
  progressField?: string;
  startDateField?: string;
  endDateField?: string;
  risksField?: string;
}

/**
 * Parse cost value from various formats
 * Supports: "1234", "$1,234.50", "1234.50", "USD 1234", "1.234,50" (European)
 * @param value - Input value (string, number, or unknown)
 * @param defaultValue - Fallback if unable to parse
 * @returns Numeric cost value
 */
function parseCost(value: any, defaultValue: number = 0): number {
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }

  if (typeof value === 'number') {
    return isFinite(value) ? Math.max(0, value) : defaultValue;
  }

  if (typeof value !== 'string') {
    return defaultValue;
  }

  try {
    // Remove currency symbols and letters
    let cleaned = value
      .replace(/[$€£¥₹₽]/g, '')
      .replace(/[A-Z]{3}/g, '') // Remove currency codes like USD
      .trim();

    // Detect decimal separator: if last dot/comma is followed by 1-2 digits, it's the decimal separator
    const decimalMatch = cleaned.match(/[.,](\d{1,2})$/);
    const decimalSeparator = decimalMatch ? cleaned[cleaned.lastIndexOf(decimalMatch[0])] : null;

    // Remove thousand separators (the OTHER separator)
    if (decimalSeparator === ',') {
      // European format: use comma as decimal, remove dots
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else if (decimalSeparator === '.') {
      // US format: use dot as decimal, remove commas
      cleaned = cleaned.replace(/,/g, '');
    } else {
      // No clear decimal separator, just remove both
      cleaned = cleaned.replace(/[.,]/g, '');
    }

    const parsed = parseFloat(cleaned);
    return isFinite(parsed) ? Math.max(0, parsed) : defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * Parse progress value to 0-100 range
 * If max value in dataset <= 1.0, assume decimal notation (0.85 = 85%)
 * @param value - Input value
 * @param isDecimalFormat - If true, multiply by 100
 * @param defaultValue - Fallback
 * @returns Clamped progress 0-100
 */
function parseProgress(value: any, isDecimalFormat: boolean = false, defaultValue: number = 0): number {
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }

  let numeric = 0;

  if (typeof value === 'number') {
    numeric = value;
  } else if (typeof value === 'string') {
    try {
      const cleaned = value.replace('%', '').trim();
      numeric = parseFloat(cleaned);
    } catch {
      return defaultValue;
    }
  } else {
    return defaultValue;
  }

  if (!isFinite(numeric)) {
    return defaultValue;
  }

  // If decimal format (0.85), convert to percentage
  let result = isDecimalFormat && numeric <= 1.0 ? numeric * 100 : numeric;

  // Clamp to 0-100
  return Math.max(0, Math.min(100, result));
}

/**
 * Parse date from multiple formats
 * Supports: ISO (2024-06-24), DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD
 * @param value - Input value
 * @param defaultDate - Fallback date
 * @returns ISO datetime string
 */
function parseDate(value: any, defaultDate: Date = new Date()): string {
  if (value === null || value === undefined || value === '') {
    return defaultDate.toISOString();
  }

  let dateObj: Date | null = null;

  if (typeof value === 'number') {
    // Excel serial date (numeric)
    const excelEpoch = new Date(1900, 0, 1);
    dateObj = new Date(excelEpoch.getTime() + (value - 1) * 24 * 60 * 60 * 1000);
  } else if (typeof value === 'string') {
    const trimmed = value.trim();

    // Try ISO format first (most reliable)
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      dateObj = new Date(trimmed);
    }
    // DD/MM/YYYY or MM/DD/YYYY
    else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
      const parts = trimmed.split('/');
      const [part1, part2, year] = parts;
      const day = parseInt(part1, 10);
      const month = parseInt(part2, 10);

      // Heuristic: if first part > 12, it's DD/MM, else try MM/DD (ambiguous, prefer MM/DD for compatibility)
      if (day > 12) {
        dateObj = new Date(parseInt(year, 10), month - 1, day);
      } else {
        // Assume MM/DD/YYYY (US format)
        dateObj = new Date(parseInt(year, 10), parseInt(part1, 10) - 1, parseInt(part2, 10));
      }
    }
  }

  // Validate parsed date
  if (dateObj && !isNaN(dateObj.getTime())) {
    return dateObj.toISOString();
  }

  return defaultDate.toISOString();
}

/**
 * Detect if a numeric column is in decimal format (0.0-1.0) vs percentage (0-100)
 * @param sampleValues - Array of sample values
 * @returns true if all non-null values are <= 1.0
 */
function isDecimalProgressFormat(sampleValues: any[]): boolean {
  const numericValues = sampleValues
    .filter((v) => v !== null && v !== undefined && v !== '')
    .map((v) => (typeof v === 'number' ? v : parseFloat(String(v))))
    .filter((v) => isFinite(v));

  if (numericValues.length === 0) return false;

  return numericValues.every((v) => v <= 1.0);
}

/**
 * Transform a single row from raw Excel data to standardized format
 * @param row - Raw data row
 * @param context - Mapping context with field locations
 * @param allRowData - All rows for format detection (progress decimal vs percentage)
 * @returns Transformed row or null if required fields missing
 */
export function transformRow(
  row: Record<string, any>,
  context: TransformationContext,
  allRowData?: Record<string, any>[]
): TransformedProjectRow | null {
  // Required field: project_name
  const projectName = row[context.projectNameField];
  if (!projectName || String(projectName).trim() === '') {
    return null; // Skip rows without project name
  }

  // Detect progress format if we have all data
  let progressIsDecimal = false;
  if (context.progressField && allRowData) {
    const progressValues = allRowData.map((r) => r[context.progressField!]);
    progressIsDecimal = isDecimalProgressFormat(progressValues);
  }

  // Default dates
  const today = new Date();
  const thirtyDaysLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Transform all fields with fallbacks
  return {
    project_name: String(projectName).trim(),
    status: context.statusField ? String(row[context.statusField] || '').trim() || null : null,
    estimated_cost: parseCost(context.estimatedCostField ? row[context.estimatedCostField] : undefined),
    actual_cost: parseCost(context.actualCostField ? row[context.actualCostField] : undefined),
    progress_percent: parseProgress(
      context.progressField ? row[context.progressField] : undefined,
      progressIsDecimal
    ),
    start_date: parseDate(context.startDateField ? row[context.startDateField] : undefined, today),
    end_date: parseDate(context.endDateField ? row[context.endDateField] : undefined, thirtyDaysLater),
    risks: context.risksField ? String(row[context.risksField] || '').trim() || null : null,
  } as TransformedProjectRow;
}

/**
 * Transform entire dataset according to mapping
 * @param rawData - Array of raw rows from Excel
 * @param mapping - Field mapping (original header -> standard field)
 * @returns Array of transformed rows (invalid rows skipped)
 */
export function transformDataset(
  rawData: Record<string, any>[],
  mapping: Record<string, string | null>
): TransformedProjectRow[] {
  if (rawData.length === 0) {
    throw new Error('No data to transform');
  }

  // Build context from mapping
  const context: TransformationContext = {
    originalRowIndex: 0,
    projectNameField: '',
    statusField: undefined,
    estimatedCostField: undefined,
    actualCostField: undefined,
    progressField: undefined,
    startDateField: undefined,
    endDateField: undefined,
    risksField: undefined,
  };

  // Find which Excel column maps to each standard field
  for (const [originalHeader, standardField] of Object.entries(mapping)) {
    if (!standardField) continue; // Null mapping = skip this field

    switch (standardField) {
      case 'project_name':
        context.projectNameField = originalHeader;
        break;
      case 'status':
        context.statusField = originalHeader;
        break;
      case 'estimated_cost':
        context.estimatedCostField = originalHeader;
        break;
      case 'actual_cost':
        context.actualCostField = originalHeader;
        break;
      case 'progress_percent':
        context.progressField = originalHeader;
        break;
      case 'start_date':
        context.startDateField = originalHeader;
        break;
      case 'end_date':
        context.endDateField = originalHeader;
        break;
      case 'risks':
        context.risksField = originalHeader;
        break;
    }
  }

  // Validate project_name field is defined
  if (!context.projectNameField) {
    throw new Error('Mapping must include project_name field');
  }

  // Transform each row
  const transformed: TransformedProjectRow[] = [];
  for (let i = 0; i < rawData.length; i++) {
    context.originalRowIndex = i;
    const transformed_row = transformRow(rawData[i], context, rawData);
    if (transformed_row) {
      transformed.push(transformed_row);
    }
  }

  if (transformed.length === 0) {
    throw new Error('No valid rows found after transformation (check project_name field)');
  }

  return transformed;
}

export interface DISResult {
  score: number;        // 0–100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  label: string;
  fieldCoverage: Record<string, number>; // field → % rows with real data
  totalRows: number;
  mappedFields: number;
}

export function calculateDIS(
  rows: TransformedProjectRow[],
  mapping: Record<string, string | null>
): DISResult {
  const optionalFields: (keyof TransformedProjectRow)[] = [
    'status', 'estimated_cost', 'actual_cost', 'progress_percent',
    'start_date', 'end_date', 'risks',
  ];

  const mappedFieldNames = new Set(Object.values(mapping).filter(Boolean));
  const mappedOptional = optionalFields.filter(f => mappedFieldNames.has(f));
  const totalRows = rows.length;

  const fieldCoverage: Record<string, number> = {};
  let totalScore = 0;

  for (const field of optionalFields) {
    const filledCount = rows.filter(row => {
      const val = row[field];
      if (val === null || val === undefined) return false;
      if (typeof val === 'number') return val > 0;
      if (typeof val === 'string') return val.trim() !== '';
      return false;
    }).length;

    const coverage = totalRows > 0 ? (filledCount / totalRows) * 100 : 0;
    fieldCoverage[field] = Math.round(coverage);

    // Mapped fields weigh double
    const weight = mappedFieldNames.has(field) ? 2 : 1;
    totalScore += coverage * weight;
  }

  const totalWeight = optionalFields.reduce((acc, f) => acc + (mappedFieldNames.has(f) ? 2 : 1), 0);
  const score = Math.round(totalScore / totalWeight);

  const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F';
  const label =
    grade === 'A' ? 'Excelente' :
    grade === 'B' ? 'Buena' :
    grade === 'C' ? 'Aceptable' :
    grade === 'D' ? 'Deficiente' : 'Crítica';

  return { score, grade, label, fieldCoverage, totalRows, mappedFields: mappedOptional.length };
}