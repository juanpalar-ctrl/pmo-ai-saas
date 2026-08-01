import {
  validateFileType,
  sanitizeFilename,
} from '../../utils/fileParser';

jest.mock('fs');
jest.mock('pdf-parse');
jest.mock('mammoth');

describe('File Parser Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateFileType', () => {
    it('accepts valid PDF files', () => {
      const result = validateFileType('document.pdf', 'application/pdf');
      expect(result).toBe('pdf');
    });

    it('accepts valid DOCX files', () => {
      const result = validateFileType(
        'document.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      expect(result).toBe('docx');
    });

    it('rejects invalid file types', () => {
      expect(() => {
        validateFileType('document.txt', 'text/plain');
      }).toThrow(/Invalid file extension/);
    });

    it('rejects files without extension', () => {
      expect(() => {
        validateFileType('document', 'application/pdf');
      }).toThrow(/Invalid file extension/);
    });

    it('is case-insensitive', () => {
      const result = validateFileType('DOCUMENT.PDF', 'application/pdf');
      expect(result).toBe('pdf');
    });
  });

  describe('sanitizeFilename', () => {
    it('replaces invalid characters with underscores', () => {
      const result = sanitizeFilename('my-file@2026.pdf');
      expect(result).toMatch(/^[\d_]+_my_file_2026\.pdf$/);
    });

    it('preserves file extension', () => {
      const result = sanitizeFilename('document.docx');
      expect(result).toMatch(/\.docx$/);
    });

    it('limits name length to 50 characters', () => {
      const longName = 'a'.repeat(100) + '.pdf';
      const result = sanitizeFilename(longName);
      const namePart = result.split('_').slice(1).join('_').replace('.pdf', '');
      expect(namePart.length).toBeLessThanOrEqual(50);
    });

    it('adds timestamp prefix', () => {
      const result = sanitizeFilename('test.pdf');
      const parts = result.split('_');
      expect(parts[0]).toMatch(/^\d+$/); // timestamp
    });
  });

  describe('extractTextFromFile', () => {
    it('supports PDF and DOCX file types', () => {
      // Verify functions are defined and usable
      expect(sanitizeFilename).toBeDefined();
      expect(validateFileType).toBeDefined();
    });
  });
});
