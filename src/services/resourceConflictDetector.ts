import { resourceRepository, ResourceAssignment } from '../repositories/resourceRepository';
import { routeLogger } from '../core/logger';

export interface ResourceConflict {
  person_id: number;
  person_name: string;
  person_role?: string;
  week_start: string; // YYYY-MM-DD
  total_allocation_percent: number;
  projects: {
    projectid: number;
    projectname: string;
    allocation: number; // allocation_percent
    task_name?: string;
  }[];
  risk_level: 'high' | 'critical';
}

export interface Bottleneck {
  person_id: number;
  person_name: string;
  person_role?: string;
  project_count: number;
  weeks_overbooked: number;
  projects: {
    projectid: number;
    projectname: string;
    project_count_concurrent: number;
  }[];
  risk_level: 'high' | 'critical';
}

export interface SharedResourcePair {
  project_a_id: number;
  project_a_name: string;
  project_b_id: number;
  project_b_name: string;
  shared_people: {
    person_id: number;
    person_name: string;
    allocation_a: number;
    allocation_b: number;
    is_conflicted: boolean; // true if overbooked in overlap
  }[];
  shared_count: number;
  timeline_overlap_weeks: number;
  risk_level: 'low' | 'medium' | 'high';
}

export interface ResourceValidationWarning {
  level: 'critical' | 'high' | 'medium' | 'info';
  message: string;
  field?: string;
  assignmentId?: number;
}

export interface ResourceConflictReport {
  summary: {
    total_people: number;
    people_overbooked: number;
    project_pairs_sharing: number;
    critical_bottlenecks: number;
  };
  conflicts: ResourceConflict[];
  bottlenecks: Bottleneck[];
  cross_project_dependencies: SharedResourcePair[];
  warnings?: ResourceValidationWarning[];
}

/**
 * Helper: Convert date to start of week (Monday)
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

/**
 * Helper: Get all week-start dates in a date range
 */
function getWeeksInRange(startStr: string, endStr: string): string[] {
  const start = new Date(startStr);
  const end = new Date(endStr);
  const weeks: Set<string> = new Set();

  let current = getWeekStart(start);
  while (current <= end) {
    const weekStr = current.toISOString().split('T')[0];
    weeks.add(weekStr);
    current.setDate(current.getDate() + 7);
  }

  return Array.from(weeks).sort();
}

/**
 * Validate and normalize a resource assignment (handle missing/incomplete data)
 */
export function validateAndNormalizeAssignment(
  assignment: Partial<ResourceAssignment>,
  context?: { otherAssignments?: ResourceAssignment[]; projectDefaultEndDate?: string }
): { valid: ResourceAssignment; warnings: ResourceValidationWarning[] } | { valid: null; errors: string[] } {
  const warnings: ResourceValidationWarning[] = [];
  const errors: string[] = [];

  // Critical validations
  if (!assignment.person_id) errors.push('person_id is required');
  if (!assignment.project_id) errors.push('project_id is required');
  if (!assignment.start_date) errors.push('start_date is required');

  if (errors.length > 0) {
    return { valid: null, errors };
  }

  let normalized: ResourceAssignment = {
    person_id: assignment.person_id!,
    project_id: assignment.project_id!,
    user_id: assignment.user_id || 'unknown',
    start_date: assignment.start_date!,
    end_date: assignment.end_date || '',
    hours_per_week: assignment.hours_per_week || 0,
    task_name: assignment.task_name,
  };

  // Infer end_date if missing
  if (!normalized.end_date) {
    if (context?.projectDefaultEndDate) {
      normalized.end_date = context.projectDefaultEndDate;
      warnings.push({
        level: 'info',
        message: `End date inferred from project timeline`,
        field: 'end_date',
      });
    } else {
      // Default to 90 days from start
      const endDate = new Date(normalized.start_date);
      endDate.setDate(endDate.getDate() + 90);
      normalized.end_date = endDate.toISOString().split('T')[0];
      warnings.push({
        level: 'medium',
        message: `End date missing, defaulted to 90 days from start`,
        field: 'end_date',
      });
    }
  }

  // Validate date range
  if (normalized.start_date > normalized.end_date) {
    return {
      valid: null,
      errors: [`Invalid date range: start (${normalized.start_date}) > end (${normalized.end_date})`],
    };
  }

  // Infer hours_per_week if missing
  if (!normalized.hours_per_week || normalized.hours_per_week <= 0) {
    // Check if person has other overlapping assignments
    if (context?.otherAssignments) {
      const overlapping = context.otherAssignments.filter(
        a =>
          a.person_id === normalized.person_id &&
          datesOverlap(a.start_date, a.end_date, normalized.start_date, normalized.end_date)
      );

      if (overlapping.length > 0) {
        // Split time evenly among projects
        const projectCount = overlapping.length + 1; // +1 for current
        normalized.hours_per_week = 40 / projectCount;
        warnings.push({
          level: 'high',
          message: `Person assigned to ${projectCount} projects, split evenly (${normalized.hours_per_week.toFixed(1)}h/week each)`,
          field: 'hours_per_week',
          assignmentId: assignment.id,
        });
      } else {
        // Single project, assume full-time
        normalized.hours_per_week = 40;
        warnings.push({
          level: 'medium',
          message: `Hours per week not specified, defaulted to 40h/week (100%)`,
          field: 'hours_per_week',
          assignmentId: assignment.id,
        });
      }
    } else {
      // No context, assume full-time
      normalized.hours_per_week = 40;
      warnings.push({
        level: 'medium',
        message: `Hours per week not specified, defaulted to 40h/week (100%)`,
        field: 'hours_per_week',
        assignmentId: assignment.id,
      });
    }
  }

  // Compute allocation_percent
  normalized.allocation_percent = Math.round((normalized.hours_per_week / 40) * 100);

  // Cap hours at reasonable limits (0.5h min, 168h max per week)
  if (normalized.hours_per_week < 0.5 || normalized.hours_per_week > 168) {
    warnings.push({
      level: 'high',
      message: `Hours per week (${normalized.hours_per_week}) out of reasonable range, capped`,
      field: 'hours_per_week',
      assignmentId: assignment.id,
    });
    normalized.hours_per_week = Math.max(0.5, Math.min(168, normalized.hours_per_week));
    normalized.allocation_percent = Math.round((normalized.hours_per_week / 40) * 100);
  }

  return { valid: normalized, warnings };
}

/**
 * Helper: Check if date ranges overlap
 */
function datesOverlap(
  start1Str: string,
  end1Str: string,
  start2Str: string,
  end2Str: string
): boolean {
  const start1 = new Date(start1Str);
  const end1 = new Date(end1Str);
  const start2 = new Date(start2Str);
  const end2 = new Date(end2Str);

  return start1 <= end2 && start2 <= end1;
}

/**
 * Helper: Count overlapping weeks between two date ranges
 */
function countOverlappingWeeks(
  start1Str: string,
  end1Str: string,
  start2Str: string,
  end2Str: string
): number {
  const start1 = new Date(start1Str);
  const end1 = new Date(end1Str);
  const start2 = new Date(start2Str);
  const end2 = new Date(end2Str);

  const overlapStart = start1 > start2 ? start1 : start2;
  const overlapEnd = end1 < end2 ? end1 : end2;

  if (overlapStart > overlapEnd) return 0;

  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const diffMs = overlapEnd.getTime() - overlapStart.getTime();
  return Math.ceil(diffMs / msPerWeek);
}

/**
 * Main detector: Find all resource conflicts, bottlenecks, and dependencies
 * Handles missing/incomplete data gracefully with intelligent inference
 */
export async function detectResourceConflicts(projectId: number, userId: string): Promise<ResourceConflictReport> {
  try {
    // Fetch assignments for this project
    let rawAssignments = await resourceRepository.getAssignmentsForProject(projectId, userId);
    const warnings: ResourceValidationWarning[] = [];

    // Normalize and validate assignments (handle missing data)
    const assignments: ResourceAssignment[] = [];
    for (const raw of rawAssignments) {
      const result = validateAndNormalizeAssignment(raw, { otherAssignments: rawAssignments });
      if (result.valid) {
        assignments.push(result.valid);
        warnings.push(...result.warnings);
      } else if ('errors' in result) {
        warnings.push({
          level: 'high',
          message: `Skipped invalid assignment: ${result.errors.join('; ')}`,
          assignmentId: raw.id,
        });
      }
    }

    if (assignments.length === 0) {
      return {
        summary: { total_people: 0, people_overbooked: 0, project_pairs_sharing: 0, critical_bottlenecks: 0 },
        conflicts: [],
        bottlenecks: [],
        cross_project_dependencies: []
      };
    }

    // Fetch project names and person names from database
    const allProjectIds = new Set(assignments.map(a => a.project_id));
    const allPersonIds = new Set(assignments.map(a => a.person_id));

    const projectNameMap = new Map<number, string>();
    const personNameMap = new Map<number, string>();

    // Get project names
    if (allProjectIds.size > 0) {
      const { pool } = require('../db');
      const projectIds = Array.from(allProjectIds);
      const projectResult = await pool.query(
        `SELECT projectid, projectname FROM project_data WHERE projectid = ANY($1)`,
        [projectIds]
      );
      projectResult.rows.forEach((row: any) => {
        projectNameMap.set(row.projectid, row.projectname);
      });
    }

    // Get person names
    if (allPersonIds.size > 0) {
      const { pool } = require('../db');
      const personIds = Array.from(allPersonIds);
      const personResult = await pool.query(
        `SELECT id, name FROM team_members WHERE id = ANY($1)`,
        [personIds]
      );
      personResult.rows.forEach((row: any) => {
        personNameMap.set(row.id, row.name);
      });
    }

    // Build person lookup
    const personMap = new Map<number, any>();
    assignments.forEach(a => {
      if (!personMap.has(a.person_id)) {
        personMap.set(a.person_id, {
          id: a.person_id,
          name: personNameMap.get(a.person_id) || `Person ${a.person_id}`
        });
      }
    });

    // ============ DETECT CONFLICTS (Overbooked weeks) ============
    const conflicts: ResourceConflict[] = [];
    const conflictedPeople = new Set<number>();

    for (const personId of personMap.keys()) {
      const personAssignments = assignments.filter(a => a.person_id === personId);
      const weeks = new Set<string>();

      // Collect all weeks
      personAssignments.forEach(a => {
        getWeeksInRange(a.start_date, a.end_date).forEach(w => weeks.add(w));
      });

      // Check each week for overbooking
      for (const weekStart of Array.from(weeks).sort()) {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const weekEndStr = weekEnd.toISOString().split('T')[0];

        const weekAssignments = personAssignments.filter(a =>
          datesOverlap(a.start_date, a.end_date, weekStart, weekEndStr)
        );

        const totalAllocation = weekAssignments.reduce((sum, a) => sum + (a.allocation_percent || 0), 0);

        if (totalAllocation > 100) {
          conflictedPeople.add(personId);
          conflicts.push({
            person_id: personId,
            person_name: personNameMap.get(personId) || `Person ${personId}`,
            week_start: weekStart,
            total_allocation_percent: totalAllocation,
            projects: weekAssignments.map(a => ({
              projectid: a.project_id,
              projectname: projectNameMap.get(a.project_id) || `Project ${a.project_id}`,
              allocation: a.allocation_percent || 0,
              task_name: a.task_name
            })),
            risk_level: totalAllocation > 150 ? 'critical' : 'high'
          });
        }
      }
    }

    // ============ DETECT BOTTLENECKS (Person in 3+ projects) ============
    const bottlenecks: Bottleneck[] = [];
    for (const personId of personMap.keys()) {
      const personAssignments = assignments.filter(a => a.person_id === personId);
      const projectIds = new Set(personAssignments.map(a => a.project_id));

      if (projectIds.size >= 3) {
        const overbooked = Array.from(
          conflicts
            .filter(c => c.person_id === personId)
            .reduce((weeks, c) => weeks.add(c.week_start), new Set<string>())
        ).length;

        bottlenecks.push({
          person_id: personId,
          person_name: personNameMap.get(personId) || `Person ${personId}`,
          project_count: projectIds.size,
          weeks_overbooked: overbooked,
          projects: Array.from(projectIds).map(pid => ({
            projectid: pid,
            projectname: projectNameMap.get(pid) || `Project ${pid}`,
            project_count_concurrent: 0 // To be computed if needed
          })),
          risk_level: overbooked > 0 ? 'critical' : 'high'
        });
      }
    }

    // ============ DETECT SHARED RESOURCES ACROSS PROJECTS ============
    const sharedResources: SharedResourcePair[] = [];
    const projectIds = new Set(assignments.map(a => a.project_id));
    const projectArray = Array.from(projectIds).sort((a, b) => a - b);

    for (let i = 0; i < projectArray.length; i++) {
      for (let j = i + 1; j < projectArray.length; j++) {
        const projA = projectArray[i];
        const projB = projectArray[j];

        const assignmentsA = assignments.filter(a => a.project_id === projA);
        const assignmentsB = assignments.filter(a => a.project_id === projB);

        const peopleA = new Set(assignmentsA.map(a => a.person_id));
        const peopleB = new Set(assignmentsB.map(a => a.person_id));

        const shared = Array.from(peopleA).filter(id => peopleB.has(id));

        if (shared.length > 0) {
          // Calculate timeline overlap
          const startA = assignmentsA.map(a => new Date(a.start_date));
          const endA = assignmentsA.map(a => new Date(a.end_date));
          const startB = assignmentsB.map(a => new Date(a.start_date));
          const endB = assignmentsB.map(a => new Date(a.end_date));

          const projAStart = new Date(Math.min(...startA.map(d => d.getTime())));
          const projAEnd = new Date(Math.max(...endA.map(d => d.getTime())));
          const projBStart = new Date(Math.min(...startB.map(d => d.getTime())));
          const projBEnd = new Date(Math.max(...endB.map(d => d.getTime())));

          const overlapWeeks = countOverlappingWeeks(
            projAStart.toISOString().split('T')[0],
            projAEnd.toISOString().split('T')[0],
            projBStart.toISOString().split('T')[0],
            projBEnd.toISOString().split('T')[0]
          );

          const sharedPeopleDetails = shared.map(personId => {
            const assignA = assignmentsA.find(a => a.person_id === personId);
            const assignB = assignmentsB.find(a => a.person_id === personId);
            const isConflicted = conflicts.some(
              c => c.person_id === personId &&
                   c.projects.some(p => p.projectid === projA || p.projectid === projB)
            );
            return {
              person_id: personId,
              person_name: personNameMap.get(personId) || `Person ${personId}`,
              allocation_a: assignA?.allocation_percent || 0,
              allocation_b: assignB?.allocation_percent || 0,
              is_conflicted: isConflicted
            };
          });

          const hasConflicts = sharedPeopleDetails.some(p => p.is_conflicted);
          const riskLevel: 'low' | 'medium' | 'high' =
            hasConflicts ? 'high' : shared.length >= 3 ? 'medium' : 'low';

          sharedResources.push({
            project_a_id: projA,
            project_a_name: projectNameMap.get(projA) || `Project ${projA}`,
            project_b_id: projB,
            project_b_name: projectNameMap.get(projB) || `Project ${projB}`,
            shared_people: sharedPeopleDetails,
            shared_count: shared.length,
            timeline_overlap_weeks: overlapWeeks,
            risk_level: riskLevel
          });
        }
      }
    }

    return {
      summary: {
        total_people: personMap.size,
        people_overbooked: conflictedPeople.size,
        project_pairs_sharing: sharedResources.length,
        critical_bottlenecks: bottlenecks.filter(b => b.risk_level === 'critical').length
      },
      conflicts: conflicts.sort((a, b) => b.total_allocation_percent - a.total_allocation_percent),
      bottlenecks: bottlenecks.sort((a, b) => b.weeks_overbooked - a.weeks_overbooked),
      cross_project_dependencies: sharedResources.sort((a, b) => {
        const riskOrder = { high: 0, medium: 1, low: 2 };
        return riskOrder[a.risk_level] - riskOrder[b.risk_level];
      }),
      warnings: warnings.length > 0 ? warnings : undefined
    };
  } catch (error) {
    routeLogger.error({ err: error, projectId, userId }, 'detectResourceConflicts failed');
    throw error;
  }
}

/**
 * Detect conflicts across all projects for a user (portfolio level)
 */
export async function detectPortfolioResourceConflicts(userId: string): Promise<ResourceConflictReport> {
  try {
    const allAssignments = await resourceRepository.getAssignmentsForUser(userId);

    if (allAssignments.length === 0) {
      return {
        summary: { total_people: 0, people_overbooked: 0, project_pairs_sharing: 0, critical_bottlenecks: 0 },
        conflicts: [],
        bottlenecks: [],
        cross_project_dependencies: []
      };
    }

    // Fetch project names and person names for enrichment
    const allProjectIds = new Set(allAssignments.map(a => a.project_id));
    const allPersonIds = new Set(allAssignments.map(a => a.person_id));

    const { pool } = require('../db');
    const projectNameMap = new Map<number, string>();
    const personNameMap = new Map<number, string>();

    if (allProjectIds.size > 0) {
      const projectIds = Array.from(allProjectIds);
      const projectResult = await pool.query(
        `SELECT projectid, projectname FROM project_data WHERE projectid = ANY($1)`,
        [projectIds]
      );
      projectResult.rows.forEach((row: any) => {
        projectNameMap.set(row.projectid, row.projectname);
      });
    }

    if (allPersonIds.size > 0) {
      const personIds = Array.from(allPersonIds);
      const personResult = await pool.query(
        `SELECT id, name FROM team_members WHERE id = ANY($1)`,
        [personIds]
      );
      personResult.rows.forEach((row: any) => {
        personNameMap.set(row.id, row.name);
      });
    }

    // Group assignments by (person_id, start_date) to detect cross-project overbooking
    const personWeekMap = new Map<string, ResourceAssignment[]>();
    for (const assignment of allAssignments) {
      const key = `${assignment.person_id}-${assignment.start_date}`;
      if (!personWeekMap.has(key)) {
        personWeekMap.set(key, []);
      }
      personWeekMap.get(key)!.push(assignment);
    }

    // Detect overbooking at portfolio level (person-week granularity)
    const conflicts: ResourceConflict[] = [];
    const conflictedPeople = new Set<number>();

    for (const [key, weekAssignments] of personWeekMap.entries()) {
      const totalAllocation = weekAssignments.reduce((sum, a) => sum + (a.allocation_percent || 0), 0);

      if (totalAllocation > 100) {
        const [personIdStr] = key.split('-');
        const personId = parseInt(personIdStr, 10);
        conflictedPeople.add(personId);

        conflicts.push({
          person_id: personId,
          person_name: personNameMap.get(personId) || `Person ${personId}`,
          week_start: weekAssignments[0].start_date,
          total_allocation_percent: totalAllocation,
          projects: weekAssignments.map(a => ({
            projectid: a.project_id,
            projectname: projectNameMap.get(a.project_id) || `Project ${a.project_id}`,
            allocation: a.allocation_percent || 0,
            task_name: a.task_name
          })),
          risk_level: totalAllocation > 150 ? 'critical' : 'high'
        });
      }
    }

    // Detect bottlenecks: people in 3+ projects during the same period
    const personProjectMap = new Map<number, Set<number>>();
    for (const assignment of allAssignments) {
      if (!personProjectMap.has(assignment.person_id)) {
        personProjectMap.set(assignment.person_id, new Set());
      }
      personProjectMap.get(assignment.person_id)!.add(assignment.project_id);
    }

    const bottlenecks: Bottleneck[] = [];
    for (const [personId, projectIds] of personProjectMap.entries()) {
      if (projectIds.size >= 3) {
        const overbooked = conflicts.filter(c => c.person_id === personId).length;
        bottlenecks.push({
          person_id: personId,
          person_name: personNameMap.get(personId) || `Person ${personId}`,
          project_count: projectIds.size,
          weeks_overbooked: overbooked,
          projects: Array.from(projectIds).map(pid => ({
            projectid: pid,
            projectname: projectNameMap.get(pid) || `Project ${pid}`,
            project_count_concurrent: 0
          })),
          risk_level: overbooked > 0 ? 'critical' : 'high'
        });
      }
    }

    // Detect shared resources between project pairs
    const sharedResources: SharedResourcePair[] = [];
    const projectArray = Array.from(allProjectIds).sort((a, b) => a - b);

    for (let i = 0; i < projectArray.length; i++) {
      for (let j = i + 1; j < projectArray.length; j++) {
        const projA = projectArray[i];
        const projB = projectArray[j];

        const assignmentsA = allAssignments.filter(a => a.project_id === projA);
        const assignmentsB = allAssignments.filter(a => a.project_id === projB);

        const peopleA = new Set(assignmentsA.map(a => a.person_id));
        const peopleB = new Set(assignmentsB.map(a => a.person_id));

        const shared = Array.from(peopleA).filter(id => peopleB.has(id));

        if (shared.length > 0) {
          const startA = assignmentsA.map(a => new Date(a.start_date));
          const endA = assignmentsA.map(a => new Date(a.end_date));
          const startB = assignmentsB.map(a => new Date(a.start_date));
          const endB = assignmentsB.map(a => new Date(a.end_date));

          const projAStart = new Date(Math.min(...startA.map(d => d.getTime())));
          const projAEnd = new Date(Math.max(...endA.map(d => d.getTime())));
          const projBStart = new Date(Math.min(...startB.map(d => d.getTime())));
          const projBEnd = new Date(Math.max(...endB.map(d => d.getTime())));

          const overlapWeeks = countOverlappingWeeks(
            projAStart.toISOString().split('T')[0],
            projAEnd.toISOString().split('T')[0],
            projBStart.toISOString().split('T')[0],
            projBEnd.toISOString().split('T')[0]
          );

          const sharedPeopleDetails = shared.map(personId => {
            const assignA = assignmentsA.find(a => a.person_id === personId);
            const assignB = assignmentsB.find(a => a.person_id === personId);
            const isConflicted = conflicts.some(
              c => c.person_id === personId &&
                   c.projects.some(p => p.projectid === projA || p.projectid === projB)
            );
            return {
              person_id: personId,
              person_name: personNameMap.get(personId) || `Person ${personId}`,
              allocation_a: assignA?.allocation_percent || 0,
              allocation_b: assignB?.allocation_percent || 0,
              is_conflicted: isConflicted
            };
          });

          const hasConflicts = sharedPeopleDetails.some(p => p.is_conflicted);
          const riskLevel: 'low' | 'medium' | 'high' =
            hasConflicts ? 'high' : shared.length >= 3 ? 'medium' : 'low';

          sharedResources.push({
            project_a_id: projA,
            project_a_name: projectNameMap.get(projA) || `Project ${projA}`,
            project_b_id: projB,
            project_b_name: projectNameMap.get(projB) || `Project ${projB}`,
            shared_people: sharedPeopleDetails,
            shared_count: shared.length,
            timeline_overlap_weeks: overlapWeeks,
            risk_level: riskLevel
          });
        }
      }
    }

    const uniquePeople = new Set(conflicts.map(c => c.person_id));
    return {
      summary: {
        total_people: uniquePeople.size,
        people_overbooked: uniquePeople.size,
        project_pairs_sharing: sharedResources.length,
        critical_bottlenecks: bottlenecks.filter(b => b.risk_level === 'critical').length
      },
      conflicts,
      bottlenecks,
      cross_project_dependencies: sharedResources
    };
  } catch (error) {
    routeLogger.error({ err: error, userId }, 'detectPortfolioResourceConflicts failed');
    throw error;
  }
}
