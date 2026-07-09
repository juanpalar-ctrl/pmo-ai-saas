/**
 * normalizationAgent.ts
 * AI-powered column detection and semantic mapping
 * Uses Claude API to intelligently map Excel columns to standard fields
 * Implements retry logic and token optimization
 */

import { anthropicClient, aiConfig } from '../config/anthropic';
import { ColumnSuggestion, ColumnSuggestionSchema } from '../config/validation';
import { agentLogger } from '../core/logger';

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff: 1s, 2s, 4s

interface NormalizationInput {
  headers: string[];
  sampleRows: Record<string, any>[];
}

interface NormalizationOutput {
  suggestions: ColumnSuggestion[];
  rawResponse: string;
}

/**
 * Create a focused system prompt that guides Claude to map columns
 * Optimized for token efficiency: concise instructions, no fluff
 */
function createSystemPrompt(): string {
  return `You are a data normalization expert. Analyze Excel column headers and sample data.

Map each column to one of these standard fields, or suggest NULL if unmappable:
- project_name: Project/task name (required if present)
- status: Project status (Not Started, In Progress, On Hold, Completed, etc.)
- estimated_cost: Planned/budgeted cost (PV, Story Points as cost, Estimate, Budget, etc.)
- actual_cost: Real/actual cost spent (AC, Spent, Cost, Effort Hours, etc.)
- progress_percent: Task completion percentage (0-100, Progress, Status, Completion %, etc.)
- start_date: Task start date
- end_date: Task deadline or end date
- risks: Identified risks or risk description
- assignee: Person assigned/responsible for the task (Asignado a, Responsable, Owner, Assignee, etc.)

Respond ONLY with valid JSON (no markdown, no extra text). Example:
{
  "suggestions": [
    { "originalHeader": "Project ID", "suggestedField": null, "confidence": 0.95, "reasoning": "ID field, not needed" },
    { "originalHeader": "Project Name", "suggestedField": "project_name", "confidence": 0.99, "reasoning": "Clear project identifier" }
  ]
}

Be confident but realistic about ambiguous headers (e.g., "Points" could be story points as cost metric).`;
}

/**
 * Format headers and sample data for Claude with token optimization
 * Limits to necessary information to reduce input tokens
 */
function formatDataForAnalysis(headers: string[], sampleRows: Record<string, any>[]): string {
  // Create a table-like representation
  let formatted = 'Excel Headers and Sample Data:\n';
  formatted += '---\n';
  formatted += 'Headers: ' + headers.map((h) => `"${h}"`).join(', ') + '\n';
  formatted += '\nSample Rows (first 3):\n';

  sampleRows.forEach((row, idx) => {
    formatted += `Row ${idx + 1}: `;
    const values = headers.map((h) => {
      const val = row[h];
      return `${h}="${val}"`;
    });
    formatted += values.join(', ') + '\n';
  });

  return formatted;
}

/**
 * Call Claude API with retry logic and token optimization
 * @param input - Headers and sample rows
 * @returns Parsed column suggestions
 * @throws Error if all retries exhausted
 */
export async function detectColumns(input: NormalizationInput): Promise<NormalizationOutput> {
  const systemPrompt = createSystemPrompt();
  const dataForAnalysis = formatDataForAnalysis(input.headers, input.sampleRows);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      // Implement backoff delay before retry
      if (attempt > 0) {
        const delayMs = RETRY_DELAYS[attempt - 1];
        agentLogger.warn({ attempt: attempt + 1, maxRetries: MAX_RETRIES, delayMs }, 'normalizationAgent retry');
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      // Call Claude API (shared client + centralized model from config/anthropic)
      const response = await anthropicClient.messages.create({
        model: aiConfig.model,
        max_tokens: 1000, // Sufficient for JSON response with ~20 columns
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: dataForAnalysis,
          },
        ],
      });

      // Extract text response
      const textContent = response.content.find((block) => block.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        throw new Error('No text content in API response');
      }

      const rawResponse = textContent.text;

      // Parse JSON response
      let parsed: { suggestions: ColumnSuggestion[] };
      try {
        // Remove markdown code blocks if present
        let cleanedText = rawResponse.replace(/```json\s*|```/g, '').trim();
        // Some models prefix the JSON with a stray "json" tag without a code fence
        cleanedText = cleanedText.replace(/^json\s*/i, '').trim();
        parsed = JSON.parse(cleanedText);
      } catch (parseErr) {
        throw new Error(
          `Failed to parse JSON response: ${(parseErr as Error).message}. Response: ${rawResponse.substring(0, 200)}`
        );
      }

      // Validate against schema
      const suggestionsArray = parsed.suggestions || [];
      const validatedSuggestions: ColumnSuggestion[] = [];

      for (const suggestion of suggestionsArray) {
        try {
          const validated = ColumnSuggestionSchema.parse(suggestion);
          validatedSuggestions.push(validated);
        } catch (validationErr) {
          agentLogger.warn({ err: (validationErr as Error).message }, 'normalizationAgent: skipping invalid suggestion');
        }
      }

      if (validatedSuggestions.length === 0) {
        throw new Error('No valid suggestions extracted from API response');
      }

      agentLogger.info({ count: validatedSuggestions.length }, 'normalizationAgent: columns detected');

      return {
        suggestions: validatedSuggestions,
        rawResponse,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      agentLogger.error({ attempt: attempt + 1, maxRetries: MAX_RETRIES, err: lastError.message }, 'normalizationAgent attempt failed');

      // If this was the last attempt, throw
      if (attempt === MAX_RETRIES - 1) {
        throw new Error(
          `Failed to detect columns after ${MAX_RETRIES} attempts: ${lastError.message}`
        );
      }
    }
  }

  // Should never reach here, but safety check
  throw lastError || new Error('Unknown error in column detection');
}

/**
 * Create a user-friendly mapping suggestion from detected columns
 * Used to populate the frontend modal with pre-filled dropdown selections
 * @param suggestions - Raw suggestions from detectColumns
 * @returns Record mapping original header to suggested field (or null)
 */
export function buildMappingRecord(suggestions: ColumnSuggestion[]): Record<string, string | null> {
  const mapping: Record<string, string | null> = {};

  for (const suggestion of suggestions) {
    mapping[suggestion.originalHeader] = suggestion.suggestedField || null;
  }

  return mapping;
}