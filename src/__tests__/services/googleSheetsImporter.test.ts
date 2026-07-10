import { buildExportUrl, fetchGoogleSheetCsv } from '../../services/googleSheetsImporter';

describe('buildExportUrl', () => {
  it('builds the CSV export URL from a standard edit link (defaults gid to 0)', () => {
    const url = buildExportUrl('https://docs.google.com/spreadsheets/d/ABC123_id-x/edit#gid=0');
    expect(url).toBe('https://docs.google.com/spreadsheets/d/ABC123_id-x/export?format=csv&gid=0');
  });

  it('preserves a non-zero gid from the fragment', () => {
    const url = buildExportUrl('https://docs.google.com/spreadsheets/d/SHEETID/edit#gid=987654');
    expect(url).toBe('https://docs.google.com/spreadsheets/d/SHEETID/export?format=csv&gid=987654');
  });

  it('preserves a gid passed as a query param', () => {
    const url = buildExportUrl('https://docs.google.com/spreadsheets/d/SHEETID/edit?gid=42');
    expect(url).toBe('https://docs.google.com/spreadsheets/d/SHEETID/export?format=csv&gid=42');
  });

  it('throws on a URL that is not a Google Sheet', () => {
    expect(() => buildExportUrl('https://example.com/not-a-sheet')).toThrow(/inválida/);
  });
});

describe('fetchGoogleSheetCsv', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  const mockFetch = (impl: any) => { global.fetch = jest.fn(impl) as any; };
  const resp = (opts: { ok?: boolean; status?: number; contentType?: string; body?: string }) => ({
    ok: opts.ok ?? true,
    status: opts.status ?? 200,
    headers: { get: (h: string) => (h.toLowerCase() === 'content-type' ? (opts.contentType ?? 'text/csv') : null) },
    arrayBuffer: async () => new TextEncoder().encode(opts.body ?? '').buffer,
  });

  it('only fetches the constructed docs.google.com export URL (SSRF-safe)', async () => {
    const spy = jest.fn(async () => resp({ body: 'a,b\n1,2' }));
    global.fetch = spy as any;
    await fetchGoogleSheetCsv('https://docs.google.com/spreadsheets/d/XYZ/edit#gid=0');
    expect(spy).toHaveBeenCalledWith('https://docs.google.com/spreadsheets/d/XYZ/export?format=csv&gid=0', expect.any(Object));
  });

  it('returns the CSV bytes on success', async () => {
    mockFetch(async () => resp({ body: 'Nombre,Costo\nP1,100' }));
    const buf = await fetchGoogleSheetCsv('https://docs.google.com/spreadsheets/d/XYZ/edit');
    expect(buf.toString('utf8')).toBe('Nombre,Costo\nP1,100');
  });

  it('rejects with a friendly message when the sheet returns an HTML sign-in page', async () => {
    mockFetch(async () => resp({ contentType: 'text/html', body: '<!DOCTYPE html><html>Sign in</html>' }));
    await expect(fetchGoogleSheetCsv('https://docs.google.com/spreadsheets/d/XYZ/edit')).rejects.toThrow(/no es accesible/);
  });

  it('rejects on a non-OK response', async () => {
    mockFetch(async () => resp({ ok: false, status: 404 }));
    await expect(fetchGoogleSheetCsv('https://docs.google.com/spreadsheets/d/XYZ/edit')).rejects.toThrow(/404/);
  });

  it('rejects when the sheet exports empty', async () => {
    mockFetch(async () => resp({ body: '' }));
    await expect(fetchGoogleSheetCsv('https://docs.google.com/spreadsheets/d/XYZ/edit')).rejects.toThrow(/vacía/);
  });
});
