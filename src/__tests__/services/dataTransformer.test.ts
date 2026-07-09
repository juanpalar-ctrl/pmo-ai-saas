import { transformRow, transformDataset } from '../../services/dataTransformer';

const baseContext = {
  originalRowIndex: 0,
  projectNameField: 'Name',
  statusField: 'Status',
  estimatedCostField: 'Budget',
  actualCostField: 'Spent',
  progressField: 'Progress',
  startDateField: 'Start',
  endDateField: 'End',
  risksField: 'Risks',
  assigneeField: 'Assignee',
};

describe('transformRow', () => {
  it('returns null when the project name is missing', () => {
    const row = { Name: '', Budget: '1000' };
    expect(transformRow(row, baseContext)).toBeNull();
  });

  it('returns null when the project name is only whitespace', () => {
    const row = { Name: '   ', Budget: '1000' };
    expect(transformRow(row, baseContext)).toBeNull();
  });

  it('trims the project name', () => {
    const row = { Name: '  Proyecto A  ' };
    const result = transformRow(row, baseContext);
    expect(result?.project_name).toBe('Proyecto A');
  });

  it('parses US-format currency strings', () => {
    const row = { Name: 'P1', Budget: '$1,234.50' };
    const result = transformRow(row, baseContext);
    expect(result?.estimated_cost).toBe(1234.5);
  });

  it('parses European-format currency strings', () => {
    const row = { Name: 'P1', Budget: '1.234,50' };
    const result = transformRow(row, baseContext);
    expect(result?.estimated_cost).toBe(1234.5);
  });

  it('parses plain numeric costs', () => {
    const row = { Name: 'P1', Budget: 5000 };
    const result = transformRow(row, baseContext);
    expect(result?.estimated_cost).toBe(5000);
  });

  it('defaults cost to 0 for unparseable values', () => {
    const row = { Name: 'P1', Budget: 'not a number' };
    const result = transformRow(row, baseContext);
    expect(result?.estimated_cost).toBe(0);
  });

  it('clamps negative costs to 0', () => {
    const row = { Name: 'P1', Budget: -500 };
    const result = transformRow(row, baseContext);
    expect(result?.estimated_cost).toBe(0);
  });

  it('parses percentage progress values directly', () => {
    const row = { Name: 'P1', Progress: '65%' };
    const result = transformRow(row, baseContext);
    expect(result?.progress_percent).toBe(65);
  });

  it('converts decimal-format progress (0-1) to percentage when the whole dataset is decimal', () => {
    const allRows = [{ Name: 'P1', Progress: 0.5 }, { Name: 'P2', Progress: 0.9 }];
    const result = transformRow(allRows[0], baseContext, allRows);
    expect(result?.progress_percent).toBe(50);
  });

  it('does not rescale progress when values already look like percentages', () => {
    const allRows = [{ Name: 'P1', Progress: 50 }, { Name: 'P2', Progress: 90 }];
    const result = transformRow(allRows[0], baseContext, allRows);
    expect(result?.progress_percent).toBe(50);
  });

  it('clamps progress to the 0-100 range', () => {
    const row = { Name: 'P1', Progress: 150 };
    const result = transformRow(row, baseContext);
    expect(result?.progress_percent).toBe(100);
  });

  it('trims the assignee field', () => {
    const row = { Name: 'P1', Assignee: '  Juan Pérez  ' };
    const result = transformRow(row, baseContext);
    expect(result?.assignee).toBe('Juan Pérez');
  });

  it('defaults assignee to null when the column is empty or unmapped', () => {
    const row = { Name: 'P1', Assignee: '' };
    expect(transformRow(row, baseContext)?.assignee).toBeNull();
    expect(transformRow(row, { ...baseContext, assigneeField: undefined })?.assignee).toBeNull();
  });

  it('parses ISO date strings', () => {
    const row = { Name: 'P1', Start: '2026-03-15' };
    const result = transformRow(row, baseContext);
    expect(result?.start_date).toContain('2026-03-15');
  });

  it('falls back to a default date for unparseable date strings', () => {
    const row = { Name: 'P1', Start: 'not a date' };
    const result = transformRow(row, baseContext);
    expect(typeof result?.start_date).toBe('string');
    expect(new Date(result!.start_date!).getTime()).not.toBeNaN();
  });

  it('trims status and risks, converting empty strings to null', () => {
    const row = { Name: 'P1', Status: '  ', Risks: 'budget overrun' };
    const result = transformRow(row, baseContext);
    expect(result?.status).toBeNull();
    expect(result?.risks).toBe('budget overrun');
  });

  it('leaves unmapped optional fields as null', () => {
    const row = { Name: 'P1' };
    const context = { originalRowIndex: 0, projectNameField: 'Name' };
    const result = transformRow(row, context);
    expect(result?.status).toBeNull();
    expect(result?.risks).toBeNull();
  });
});

describe('transformDataset', () => {
  const mapping = {
    Name: 'project_name',
    Budget: 'estimated_cost',
    Spent: 'actual_cost',
    Progress: 'progress_percent',
  };

  it('throws when given an empty dataset', () => {
    expect(() => transformDataset([], mapping)).toThrow(/no data/i);
  });

  it('throws when the mapping has no project_name field', () => {
    expect(() => transformDataset([{ Name: 'P1' }], { Budget: 'estimated_cost' }))
      .toThrow(/project_name/i);
  });

  it('skips rows without a project name and keeps valid ones', () => {
    const rows = [
      { Name: 'Proyecto A', Budget: 1000 },
      { Name: '', Budget: 2000 },
      { Name: 'Proyecto C', Budget: 3000 },
    ];
    const result = transformDataset(rows, mapping);
    expect(result).toHaveLength(2);
    expect(result.map(r => r.project_name)).toEqual(['Proyecto A', 'Proyecto C']);
  });

  it('throws when every row is invalid', () => {
    const rows = [{ Name: '' }, { Name: '   ' }];
    expect(() => transformDataset(rows, mapping)).toThrow(/no valid rows/i);
  });

  it('ignores null-mapped columns', () => {
    const rows = [{ Name: 'P1', Ignored: 'whatever' }];
    const result = transformDataset(rows, { ...mapping, Ignored: null });
    expect(result).toHaveLength(1);
  });

  it('maps an assignee column when present', () => {
    const rows = [{ Name: 'P1', Owner: 'Ana Torres' }];
    const result = transformDataset(rows, { ...mapping, Owner: 'assignee' });
    expect(result[0].assignee).toBe('Ana Torres');
  });
});
