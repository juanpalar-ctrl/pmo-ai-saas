// ============================================
// CLASES DE ERROR CENTRALES
// Para uso futuro en refactorización
// ============================================

/**
 * Narrows an unknown caught value to a message string. Centralizes the
 * `err instanceof Error ? err.message : String(err)` idiom repeated across
 * the codebase so catch blocks can stay `unknown`-typed instead of `any`.
 */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export class AppError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super('VALIDATION_ERROR', 400, message, details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Autenticación requerida') {
    super('AUTH_ERROR', 401, message);
    this.name = 'AuthenticationError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Recurso no encontrado') {
    super('NOT_FOUND', 404, message);
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Límite de solicitudes excedido') {
    super('RATE_LIMIT', 429, message);
    this.name = 'RateLimitError';
  }
}

export class BusinessLogicError extends AppError {
  constructor(message: string, details?: any) {
    super('BUSINESS_ERROR', 422, message, details);
    this.name = 'BusinessLogicError';
  }
}
