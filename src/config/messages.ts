/**
 * src/config/messages.ts
 * Centralized message configuration for the application.
 * Exported as constants for easy maintenance and i18n readiness.
 */

export const AUTH_MESSAGES = {
  PENDING_APPROVAL:
    "Tu registro se completó con éxito. Tu cuenta está en espera de aprobación por el Administrador.",
  REJECTED:
    "Tu cuenta fue rechazada por el administrador. Contacta a soporte si crees que es un error.",
  LOGIN_SUCCESS: "Inicio de sesión exitoso.",
  INVALID_CREDENTIALS: "Credenciales inválidas.",
  USER_NOT_FOUND: "Usuario no encontrado.",
  EMAIL_ALREADY_EXISTS: "El correo electrónico ya está registrado.",
  REGISTRATION_SUCCESS: "Registro completado. Por favor, espera la aprobación del administrador.",
};

export const ADMIN_MESSAGES = {
  USER_APPROVED: "Usuario aprobado exitosamente.",
  USER_REJECTED: "Usuario rechazado.",
  UNAUTHORIZED_ADMIN: "No tienes permisos de administrador.",
  NO_PENDING_USERS: "No hay usuarios pendientes de aprobación.",
};

export const UPLOAD_MESSAGES = {
  UPLOAD_SUCCESS: "Datos cargados exitosamente.",
  ROWS_LOADED: (count: number) => `Se cargaron ${count} fila(s).`,
  ROWS_REJECTED: (count: number, reasons: string[]) =>
    `Se cargaron correctamente. Sin embargo, ${count} fila(s) fue(ron) omitida(s): ${reasons.join(", ")}`,
  INVALID_FORMAT: "Formato de archivo inválido. Por favor, usa un archivo Excel (.xlsx).",
};

export const METRICS_MESSAGES = {
  ZERO_VALUE_WARNING: "Valor cero detectado en PV o AC. Se utilizará 1.00 por defecto en cálculos.",
};

export const TIMEOUT_MESSAGES = {
  TIMEOUT_TITLE: "Agentes Saturados",
  TIMEOUT_MESSAGE: "El análisis está tomando más tiempo de lo esperado. Por favor, intenta nuevamente.",
  RETRY_BUTTON: "Reintentar",
  CANCEL_BUTTON: "Cancelar",
};
