import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// UPLOADS_DIR is resolved once at module load — point it at a scratch dir
// instead of the real project ./uploads so this test never touches real data.
process.env.UPLOADS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'pathValidator-test-'));

import { validateUploadPath, isValidTempMappingFilename, getUploadsDir } from '../../utils/pathValidator';

describe('getUploadsDir', () => {
  it('resolves to an absolute path', () => {
    expect(path.isAbsolute(getUploadsDir())).toBe(true);
  });
});

describe('validateUploadPath', () => {
  const uploadsDir = getUploadsDir();
  const existingFile = 'test-path-validator-file.xlsx';
  const existingFilePath = path.join(uploadsDir, existingFile);

  beforeAll(() => {
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    fs.writeFileSync(existingFilePath, 'dummy content');
  });

  afterAll(() => {
    fs.rmSync(uploadsDir, { recursive: true, force: true });
  });

  it('returns the resolved absolute path for a valid, existing filename', () => {
    const result = validateUploadPath(existingFile);
    expect(result).toBe(path.resolve(uploadsDir, existingFile));
  });

  it('rejects filenames containing ".." (path traversal)', () => {
    expect(() => validateUploadPath('../../etc/passwd')).toThrow(/path traversal/i);
  });

  it('rejects filenames containing "~"', () => {
    expect(() => validateUploadPath('~/secrets.xlsx')).toThrow(/path traversal/i);
  });

  it('rejects absolute paths', () => {
    expect(() => validateUploadPath('/etc/passwd')).toThrow(/path traversal/i);
  });

  it('rejects backslash-based traversal attempts on the resolved path', () => {
    expect(() => validateUploadPath('..\\..\\etc\\passwd')).toThrow(/path traversal|outside uploads/i);
  });

  it('throws when the file does not exist', () => {
    expect(() => validateUploadPath('does-not-exist-at-all.xlsx')).toThrow(/File not found/);
  });

  it('strips null bytes before validating', () => {
    expect(() => validateUploadPath(`${existingFile}\0.evil`)).toThrow(/File not found/);
  });
});

describe('isValidTempMappingFilename', () => {
  it('accepts the expected temp_mapping_<uuid>.xlsx format', () => {
    expect(isValidTempMappingFilename('temp_mapping_abc12345-6789-4abc-8def-123456789abc.xlsx')).toBe(true);
  });

  it('rejects filenames without the temp_mapping_ prefix', () => {
    expect(isValidTempMappingFilename('mapping_abc123.xlsx')).toBe(false);
  });

  it('rejects filenames with the wrong extension', () => {
    expect(isValidTempMappingFilename('temp_mapping_abc123.csv')).toBe(false);
  });

  it('rejects filenames with path traversal characters', () => {
    expect(isValidTempMappingFilename('temp_mapping_../../../etc/passwd.xlsx')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isValidTempMappingFilename('')).toBe(false);
  });
});
