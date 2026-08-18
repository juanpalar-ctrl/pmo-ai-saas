/**
 * Resource Assignment Ingestion Service
 * Extracts person + project + hours/week from Excel data
 * Handles missing/incomplete data with intelligent inference
 */

import { resourceRepository, ResourceAssignment } from '../repositories/resourceRepository';
import { teamService } from './teamService';
import { validateAndNormalizeAssignment, ResourceValidationWarning } from './resourceConflictDetector';
import { serviceLogger } from '../core/logger';

export interface ResourceAssignmentIngestResult {
  assigned_count: number;
  warnings: ResourceValidationWarning[];
  skipped_rows: string[];
}

/**
 * Extract resource assignments from normalized project rows
 * Each row may have an "assignee" column; we extract person → project mapping
 */
export async function extractResourceAssignments(
  normalizedRows: any[],
  projectId: number,
  userId: string,
  projectEndDate?: string
): Promise<ResourceAssignmentIngestResult> {
  const warnings: ResourceValidationWarning[] = [];
  const skipped: string[] = [];
  const assignments: ResourceAssignment[] = [];

  if (!normalizedRows || normalizedRows.length === 0) {
    return { assigned_count: 0, warnings, skipped_rows: skipped };
  }

  // Detect if there are resource-related columns (Hours/Week, Allocation%, etc)
  const headerSample = normalizedRows[0];
  const hasResourceColumns = headerSample &&
    Object.keys(headerSample).some(k =>
      /hours|week|allocation|percent|effort|assignment/i.test(k)
    );

  if (!hasResourceColumns) {
    serviceLogger.info('No resource columns detected in Excel data');
    return { assigned_count: 0, warnings, skipped_rows: skipped };
  }

  // Extract column names for resource data
  const hoursCol = Object.keys(headerSample).find(k => /^(hours|effort|horas)/i.test(k));
  const allocCol = Object.keys(headerSample).find(k => /^(allocation|asignacion|percent)/i.test(k));
  const assigneeCol = Object.keys(headerSample).find(k =>
    /^(assignee|asignado|responsible|owner|person|team.member)/i.test(k) ||
    /^team.member$/i.test(k)
  );

  if (!assigneeCol) {
    serviceLogger.warn('No assignee/person column found');
    return { assigned_count: 0, warnings, skipped_rows: skipped };
  }

  // Get all team members for this project to link person_id
  let projectMembers: any[] = [];
  try {
    const teamResult = await teamService.getTeamBoard(projectId, userId, normalizedRows);
    projectMembers = teamResult?.members || [];
  } catch (err) {
    serviceLogger.warn({ err }, 'Could not fetch team members for linking');
  }

  // Process each row
  for (let i = 0; i < normalizedRows.length; i++) {
    const row = normalizedRows[i];
    const personName = row[assigneeCol]?.toString().trim();

    if (!personName) {
      skipped.push(`Row ${i}: No person name`);
      continue;
    }

    // Find matching team member
    const member = projectMembers.find(m =>
      m.name.toLowerCase() === personName.toLowerCase()
    );

    if (!member) {
      warnings.push({
        level: 'info',
        message: `Person "${personName}" not found in team members, will skip assignment`,
        field: assigneeCol,
      });
      skipped.push(`Row ${i}: Person not in team`);
      continue;
    }

    // Extract hours or allocation
    let hoursPerWeek = hoursCol ? parseFloat(row[hoursCol]) : undefined;
    let allocationPercent = allocCol ? parseFloat(row[allocCol]) : undefined;

    // Convert allocation% to hours if needed
    if (allocationPercent && !hoursPerWeek) {
      hoursPerWeek = (allocationPercent / 100) * 40;
    }

    // Create assignment object for validation
    const rawAssignment: Partial<ResourceAssignment> = {
      project_id: projectId,
      user_id: userId,
      person_id: member.id,
      task_name: row['task_name'] || row['Task'] || row['task'],
      start_date: row['start_date'] || row['Start Date'] || new Date().toISOString().split('T')[0],
      end_date: row['end_date'] || row['End Date'] || projectEndDate,
      hours_per_week: hoursPerWeek,
    };

    // Validate and normalize
    const validResult = validateAndNormalizeAssignment(rawAssignment, {
      otherAssignments: assignments,
      projectDefaultEndDate: projectEndDate,
    });

    if (!validResult.valid) {
      if ('errors' in validResult) {
        warnings.push({
          level: 'high',
          message: `Row ${i}: ${validResult.errors.join('; ')}`,
        });
      }
      skipped.push(`Row ${i}: Validation failed`);
      continue;
    }

    // Add validated assignment
    assignments.push(validResult.valid);
    warnings.push(...validResult.warnings);
  }

  // Batch insert assignments
  if (assignments.length > 0) {
    try {
      await resourceRepository.createAssignmentsBatch(assignments);
      serviceLogger.info({ count: assignments.length }, 'Resource assignments created');
    } catch (err) {
      serviceLogger.error({ err }, 'Failed to save resource assignments');
      warnings.push({
        level: 'high',
        message: `Failed to save ${assignments.length} assignments: ${(err as Error).message}`,
      });
    }
  }

  return {
    assigned_count: assignments.length,
    warnings,
    skipped_rows: skipped,
  };
}

/**
 * Main ingestion: called after project data is saved
 * Extracts and saves resource assignments from the parsed Excel
 */
export async function ingestResourceAssignments(
  allNormalizedRows: any[],
  projectId: number,
  userId: string,
  projectEndDate?: string
): Promise<ResourceAssignmentIngestResult> {
  try {
    serviceLogger.info({ projectId, userId }, 'Ingesting resource assignments');

    const result = await extractResourceAssignments(
      allNormalizedRows,
      projectId,
      userId,
      projectEndDate
    );

    if (result.warnings.length > 0) {
      serviceLogger.info(
        { warningCount: result.warnings.length },
        'Resource ingest completed with warnings'
      );
    } else {
      serviceLogger.info({ assigned_count: result.assigned_count }, 'Resource ingest completed');
    }

    return result;
  } catch (error) {
    serviceLogger.error({ err: error, projectId }, 'Resource ingest failed');
    throw error;
  }
}

export const resourceAssignmentIngestService = {
  ingestResourceAssignments,
  extractResourceAssignments,
};
