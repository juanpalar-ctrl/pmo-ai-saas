/**
 * src/utils/fileParser.ts
 * Utilities for parsing PDF and DOCX files to extract text
 */

const pdfParse = require('pdf-parse');
import mammoth from 'mammoth';
import fs from 'fs';
import { serviceLogger } from '../core/logger';

/**
 * Extract text from PDF file
 * @param filePath - Full path to PDF file
 * @returns Extracted text content
 */
export async function extractTextFromPDF(filePath: string): Promise<string> {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);

    if (!data.text || data.text.trim().length === 0) {
      throw new Error('No text found in PDF. File might be scanned without OCR.');
    }

    return data.text;
  } catch (error) {
    serviceLogger.error({ err: error, filePath }, 'PDF extraction failed');
    throw new Error(`Failed to extract text from PDF: ${(error as Error).message}`);
  }
}

/**
 * Extract text from DOCX file
 * @param filePath - Full path to DOCX file
 * @returns Extracted text content
 */
export async function extractTextFromDocx(filePath: string): Promise<string> {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const result = await mammoth.extractRawText({ path: filePath });

    if (!result.value || result.value.trim().length === 0) {
      throw new Error('No text found in DOCX file.');
    }

    // Log warnings if any
    if (result.messages && result.messages.length > 0) {
      serviceLogger.warn(
        { messages: result.messages },
        'DOCX extraction completed with warnings'
      );
    }

    return result.value;
  } catch (error) {
    serviceLogger.error({ err: error, filePath }, 'DOCX extraction failed');
    throw new Error(`Failed to extract text from DOCX: ${(error as Error).message}`);
  }
}

/**
 * Parse file based on extension
 * @param filePath - Full path to file
 * @param fileType - File type ('pdf' or 'docx')
 * @returns Extracted text content
 */
export async function extractTextFromFile(filePath: string, fileType: string): Promise<string> {
  const normalizedType = fileType.toLowerCase();

  if (normalizedType === 'pdf') {
    return extractTextFromPDF(filePath);
  } else if (normalizedType === 'docx') {
    return extractTextFromDocx(filePath);
  } else {
    throw new Error(`Unsupported file type: ${fileType}`);
  }
}

/**
 * Validate file type and extension
 * @param filename - Original filename
 * @param mimeType - MIME type from file upload
 * @returns Valid file type or throws error
 */
export function validateFileType(filename: string, mimeType: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const validExtensions = ['pdf', 'docx'];

  if (!validExtensions.includes(ext)) {
    throw new Error(
      `Invalid file extension: ${ext}. Allowed: ${validExtensions.join(', ')}`
    );
  }

  // Additional MIME type validation
  const validMimeTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  if (!validMimeTypes.includes(mimeType)) {
    serviceLogger.warn(
      { filename, mimeType },
      'Unexpected MIME type for file'
    );
  }

  return ext;
}

/**
 * Sanitize filename for storage
 * @param filename - Original filename
 * @returns Sanitized filename with timestamp
 */
export function sanitizeFilename(filename: string): string {
  const timestamp = Date.now();
  const parts = filename.split('.');
  const ext = parts.pop() || 'bin';
  const nameWithoutExt = parts.join('');
  const cleanName = nameWithoutExt.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
  return `${timestamp}_${cleanName}.${ext}`;
}
