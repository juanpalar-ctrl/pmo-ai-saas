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