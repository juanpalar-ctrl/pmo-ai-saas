import { z } from 'zod';

// Schema para validar datos de proyecto
export const ProjectDataSchema = z.object({
  projectId: z.number().positive(),
  projectName: z.string().min(3),
  status: z.enum(['Not Started', 'In Progress', 'On Hold', 'Completed']),
  
  timeline: z.object({
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    daysElapsed: z.number().min(0),
    daysRemaining: z.number().min(0),
    percentageComplete: z.number().min(0).max(100),
  }),
  
  teamVelocity: z.array(z.number().positive()).min(1),
  
  workPending: z.object({
    epicsRemaining: z.number().min(0),
    tasksRemaining: z.number().min(0),
    totalStoryPoints: z.number().min(0),
  }),
  
  budget: z.object({
    totalBudget: z.number().positive(),
    spent: z.number().min(0),
    remaining: z.number().min(0),
    percentageSpent: z.number().min(0).max(100),
  }),
  
  resources: z.array(z.object({
    role: z.string(),
    count: z.number().positive(),
    costPerMonth: z.number().positive(),
  })),
  
  risks: z.array(z.object({
    description: z.string(),
    severity: z.enum(['critical', 'high', 'medium', 'low']),
    probability: z.number().min(0).max(1),
  })).optional(),
});

export type ProjectData = z.infer<typeof ProjectDataSchema>;

// Resource Allocation Schema (Hito 6)
export const ResourceAssignmentSchema = z.object({
  id: z.number().optional(),
  project_id: z.number().positive(),
  user_id: z.string(),
  person_id: z.number().positive(),
  task_name: z.string().optional(),
  start_date: z.string(), // ISO date YYYY-MM-DD
  end_date: z.string(),
  hours_per_week: z.number().positive().max(168), // max 168 hours in a week
  allocation_percent: z.number().min(0).max(500).optional(), // Allow >100% for detection
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type ResourceAssignment = z.infer<typeof ResourceAssignmentSchema>;

export const ResourceAlertSchema = z.object({
  overbooked: z.array(z.object({
    person_id: z.number(),
    person_name: z.string(),
    week_start: z.string(),
    total_allocation_percent: z.number(),
    projects: z.array(z.object({
      projectid: z.number(),
      projectname: z.string(),
      allocation: z.number(),
      task_name: z.string().optional(),
    })),
    risk_level: z.enum(['high', 'critical']),
  })).optional(),

  bottlenecks: z.array(z.object({
    person_id: z.number(),
    person_name: z.string(),
    project_count: z.number(),
    weeks_overbooked: z.number(),
    risk_level: z.enum(['high', 'critical']),
  })).optional(),

  sharedDependencies: z.array(z.object({
    project_a_id: z.number(),
    project_a_name: z.string(),
    project_b_id: z.number(),
    project_b_name: z.string(),
    shared_count: z.number(),
    timeline_overlap_weeks: z.number(),
    risk_level: z.enum(['low', 'medium', 'high']),
  })).optional(),
});

export type ResourceAlert = z.infer<typeof ResourceAlertSchema>;