/**
 * googleSheetsImporter.ts
 * Imports a public ("anyone with the link can view") Google Sheet by fetching
 * its CSV export, so it can be fed into the same ingestion pipeline as an
 * uploaded file. No OAuth — private sheets are out of scope for this path.
 *
 * SSRF-safe: the fetched URL is always constructed against a hardcoded
 * docs.google.com host from a validated sheet id; the raw user URL is never
 * fetched directly.
 */

const SHEET_ID_RE = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
const GID_RE = /[#?&]gid=([0-9]+)/;
const MAX_BYTES = 10 * 1024 * 1024; // mirror the 10 MB upload limit

/**
 * Extracts the sheet id (and optional gid) from a Google Sheets URL and builds
 * the CSV export URL. Throws on anything that isn't a recognizable Sheets URL.
 */
export function buildExportUrl(sheetUrl: string): string {
  const idMatch = sheetUrl.match(SHEET_ID_RE);
  if (!idMatch) {
    throw new Error('URL de Google Sheets inválida. Debe verse como https://docs.google.com/spreadsheets/d/...');
  }
  const id = idMatch[1];
  const gid = sheetUrl.match(GID_RE)?.[1] ?? '0';
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
}

/**
 * Fetches the CSV export of a public Google Sheet. Rejects with a friendly
 * message when the sheet isn't link-shared (Google serves an HTML sign-in page
 * in that case) or exceeds the size cap.
 */
export async function fetchGoogleSheetCsv(sheetUrl: string): Promise<Buffer> {
  const exportUrl = buildExportUrl(sheetUrl);

  let resp: Response;
  try {
    resp = await fetch(exportUrl, { redirect: 'follow' });
  } catch {
    throw new Error('No se pudo conectar con Google Sheets. Revisa tu conexión e inténtalo de nuevo.');
  }

  if (!resp.ok) {
    throw new Error(
      `Google Sheets respondió ${resp.status}. Verifica que la hoja esté compartida como "Cualquiera con el enlace puede ver".`
    );
  }

  const contentType = resp.headers.get('content-type') || '';
  const arrayBuf = await resp.arrayBuffer();
  if (arrayBuf.byteLength > MAX_BYTES) {
    throw new Error('La hoja excede el límite de 10 MB.');
  }
  const buf = Buffer.from(arrayBuf);

  // When the sheet isn't accessible, Google returns an HTML login/permission
  // page (200) instead of CSV. Detect it by content-type or a leading HTML tag.
  const head = buf.subarray(0, 200).toString('utf8').trimStart().toLowerCase();
  if (contentType.includes('text/html') || head.startsWith('<!doctype html') || head.startsWith('<html')) {
    throw new Error('La hoja no es accesible. Compártela como "Cualquiera con el enlace puede ver" e inténtalo de nuevo.');
  }

  if (buf.length === 0) {
    throw new Error('La hoja de Google Sheets está vacía.');
  }

  return buf;
}
