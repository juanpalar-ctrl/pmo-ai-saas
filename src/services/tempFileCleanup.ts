import { serviceLogger } from '../core/logger';
/**
 * tempFileCleanup.ts
 * Scheduled cleanup job for temporary mapping files
 * Removes files older than 1 hour to prevent disk space bloat
 */

import fs from 'fs';
import path from 'path';
import { getUploadsDir } from '../utils/pathValidator';

const TEMP_FILE_PATTERN = /^temp_mapping_[a-f0-9\-]+\.xlsx$/i;
const MAX_AGE_MS = 60 * 60 * 1000; // 1 hour in milliseconds

/**
 * Check if a file matches the temporary mapping file pattern
 */
function isTempMappingFile(filename: string): boolean {
  return TEMP_FILE_PATTERN.test(filename);
}

/**
 * Get the age of a file in milliseconds
 */
function getFileAgeMs(filePath: string): number {
  try {
    const stats = fs.statSync(filePath);
    return Date.now() - stats.mtimeMs;
  } catch {
    return 0;
  }
}

/**
 * Execute cleanup of old temporary files
 * Logs results and any errors
 */
export function cleanupOldTempFiles(): void {
  const uploadsDir = getUploadsDir();

  try {
    if (!fs.existsSync(uploadsDir)) {
      serviceLogger.info('[tempFileCleanup] Uploads directory does not exist, skipping cleanup');
      return;
    }

    const files = fs.readdirSync(uploadsDir);
    let cleanedCount = 0;
    let skippedCount = 0;

    for (const filename of files) {
      // Only process temp mapping files
      if (!isTempMappingFile(filename)) {
        continue;
      }

      const filePath = path.join(uploadsDir, filename);

      try {
        const ageMs = getFileAgeMs(filePath);

        if (ageMs > MAX_AGE_MS) {
          fs.unlinkSync(filePath);
          cleanedCount++;
          serviceLogger.info(`[tempFileCleanup] Deleted: ${filename} (age: ${Math.round(ageMs / 1000)}s)`);
        } else {
          skippedCount++;
        }
      } catch (err) {
        serviceLogger.warn(`[tempFileCleanup] Failed to process ${filename}: ${(err as Error).message}`);
      }
    }

    if (cleanedCount > 0 || skippedCount > 0) {
      serviceLogger.info(
        `[tempFileCleanup] Cleanup complete: ${cleanedCount} deleted, ${skippedCount} retained`
      );
    }
  } catch (err) {
    serviceLogger.error(`[tempFileCleanup] Cleanup job failed: ${(err as Error).message}`);
  }
}

/**
 * Schedule the cleanup job to run at regular intervals
 * @param intervalMs - How often to run cleanup (default: 1 hour)
 * @returns NodeJS.Timer ID (can be used to cancel with clearInterval)
 */
export function scheduleCleanupJob(intervalMs: number = 60 * 60 * 1000): NodeJS.Timer {
  serviceLogger.info(`[tempFileCleanup] Scheduling cleanup job to run every ${Math.round(intervalMs / 60000)} minutes`);

  // Run immediately on startup
  cleanupOldTempFiles();

  // Then schedule recurring cleanup
  return setInterval(() => {
    cleanupOldTempFiles();
  }, intervalMs);
}