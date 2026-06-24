/**
 * pathValidator.ts
 * Security utility to prevent path traversal attacks
 * Ensures all file paths stay within designated upload directory
 */

import path from 'path';
import fs from 'fs';

const UPLOADS_DIR = path.resolve(process.env.UPLOADS_DIR || './uploads');

/**
 * Validates that a filename is safe and exists within the uploads directory
 * @param filename - The filename to validate
 * @returns The absolute safe path if valid
 * @throws Error if path traversal detected or file doesn't exist
 */
export function validateUploadPath(filename: string): string {
  // Sanitize: remove any null bytes and normalize path separators
  const cleanFilename = filename.replace(/\0/g, '').replace(/\\/g, '/');

  // Ensure no path traversal patterns
  if (
    cleanFilename.includes('..') ||
    cleanFilename.includes('~') ||
    cleanFilename.startsWith('/')
  ) {
    throw new Error('Invalid filename: path traversal attempt detected');
  }

  // Resolve the full path
  const fullPath = path.resolve(UPLOADS_DIR, cleanFilename);

  // Ensure the resolved path is still within UPLOADS_DIR
  if (!fullPath.startsWith(UPLOADS_DIR)) {
    throw new Error('Invalid filename: path outside uploads directory');
  }

  // Verify file exists
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not found: ${cleanFilename}`);
  }

  return fullPath;
}

/**
 * Validates a temporary mapping filename format (temp_mapping_[UUID].xlsx)
 * @param filename - The filename to validate
 * @returns true if valid temporary mapping file
 */
export function isValidTempMappingFilename(filename: string): boolean {
  const tempPattern = /^temp_mapping_[a-f0-9\-]+\.xlsx$/i;
  return tempPattern.test(filename);
}

/**
 * Gets the upload directory path
 * @returns Absolute path to uploads directory
 */
export function getUploadsDir(): string {
  return UPLOADS_DIR;
}