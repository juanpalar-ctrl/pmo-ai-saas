/**
 * validation.ts
 * Centralized Zod schemas for data integrity validation
 * Ensures all incoming data conforms to expected types and constraints
 */

import { z } from 'zod';

/**
 * Schema for individual column mapping suggestion from normalization agent
 */
export const ColumnSuggestionSchema = z.object({
  originalHeader: z.string(),
  suggestedField: z.enum([
    'project_name',
    'status',
    'estimated_cost',
    'actual_cost',
    'progress_percent',
    'start_date',
    'end_date',
    'risks',
  ]).nullable(),
  framework: z.enum(['scrum', 'kanban', 'waterfall', 'safe']).default('scrum')
});

/**
 * Schema for the response from /api/data/detect-columns
 */
export const DetectColumnsResponseSchema = z.object({
  headers: z.array(z.string().min(1)),
  sampleRows: z.array(z.record(z.string(), z.any())),
  suggestions: z.array(ColumnSuggestionSchema),
  tempFilename: z.string().regex(/^temp_mapping_[a-f0-9\-]+\.xlsx$/i),
});

/**
 * Schema for confirmed mapping from frontend
 * Maps original header names to our standard field names
 */
export const ConfirmedMappingSchema = z.record(
  z.string(),
  z.enum(['task_name', 'estimated_cost', 'actual_cost', 'progress_percent', 'start_date', 'end_date']).nullable()
);

/**
 * Schema for a single transformed project row
 * All fields must comply with these types after cleaning
 */
export const TransformedProjectRowSchema = z.object({
  project_name: z.string().min(1, 'Project name is required'),
  status: z.string().optional().nullable(),
  estimated_cost: z.number().nonnegative().finite().default(0),
  actual_cost: z.number().nonnegative().finite().default(0),
  progress_percent: z.number().min(0).max(100).default(0),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  risks: z.string().optional().nullable(),
});


/**
 * Schema for save-mapping endpoint request
 */
export const SaveMappingRequestSchema = z.object({
  tempFilename: z.string(),
  confirmedMapping: z.record(
    z.string(),
    z.enum([
      'project_name',
      'status',
      'estimated_cost',
      'actual_cost',
      'progress_percent',
      'start_date',
      'end_date',
      'risks',
    ]).nullable()
  ),
  framework: z.enum(['scrum', 'kanban', 'waterfall', 'safe']).default('scrum'),
  org: z.string().optional().default('Sin especificar')
});

/**
 * Schema for the final normalized data batch
 * Used before inserting into project_data table
 */
export const NormalizedProjectBatchSchema = z.object({
  projects: z.array(TransformedProjectRowSchema),
  sourceFilename: z.string(),
  normalizedAt: z.string().datetime(),
});

// ─── Route param / query schemas ──────────────────────────────────────────────

export const ProjectIdParamSchema = z.object({
  projectId: z.string().regex(/^\d+$/, 'projectId must be a positive integer').transform(Number),
});

export const PaginationQuerySchema = z.object({
  page:  z.string().optional().transform(v => Math.max(1, parseInt(v || '1') || 1)),
  limit: z.string().optional().transform(v => Math.min(100, Math.max(1, parseInt(v || '50') || 50))),
});

export const AnalysisBodySchema = z.object({
  framework:    z.enum(['scrum', 'kanban', 'waterfall', 'safe']).default('scrum'),
  forceRefresh: z.boolean().optional().default(false),
});

export const ChatMessageSchema = z.object({
  message:        z.string().min(1).max(2000),
  history:        z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() })).max(20).optional().default([]),
  projectContext: z.any().optional(),
});

export const OrgQuerySchema = z.object({
  org: z.string().max(200).optional().default('Sin especificar'),
});

export const DraftMessageSchema = z.object({
  audience:     z.enum(['team', 'clevel']),
  alertContext: z.string().min(1).max(4000),
  projectName:  z.string().max(200).optional().default('el proyecto'),
});

// ─── Types ────────────────────────────────────────────────────────────────────

export type ColumnSuggestion = z.infer<typeof ColumnSuggestionSchema>;
export type DetectColumnsResponse = z.infer<typeof DetectColumnsResponseSchema>;
export type ConfirmedMapping = z.infer<typeof ConfirmedMappingSchema>;
export type TransformedProjectRow = z.infer<typeof TransformedProjectRowSchema>;
export type SaveMappingRequest = z.infer<typeof SaveMappingRequestSchema>;
export type NormalizedProjectBatch = z.infer<typeof NormalizedProjectBatchSchema>;