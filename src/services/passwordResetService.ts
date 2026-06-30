import { serviceLogger } from '../core/logger';
/**
 * src/services/passwordResetService.ts
 * Forgot Password flow with token-based reset.
 */

import crypto from "crypto";
import { pool } from "../db";

const TOKEN_EXPIRY_MINUTES = 60; // 1 hour

/**
 * Generar un token de reset seguro
 */
function generateResetToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Crear un reset token para un usuario
 * Retorna el token y el reset link
 */
export async function createPasswordResetToken(
  email: string
): Promise<{ token: string; resetLink: string } | null> {
  try {
    // 1. Buscar usuario por email
    const userResult = await pool.query("SELECT id FROM users WHERE email = $1", [email]);

    if (userResult.rows.length === 0) {
      // No retornar que no existe (por seguridad)
      return null;
    }

    const userId = userResult.rows[0].id;

    // 2. Generar token
    const token = generateResetToken();
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000);

    // 3. Guardar en BD (eliminar anteriores primero)
    await pool.query("DELETE FROM password_resets WHERE user_id = $1", [userId]);

    await pool.query(
      "INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1, $2, $3)",
      [userId, token, expiresAt]
    );

    // 4. Generar reset link (para mock, usamos localhost)
    const resetLink = `http://localhost:3001/reset-password?token=${token}`;

    serviceLogger.info({ email, expiresAt: expiresAt.toISOString() }, 'FORGOT PASSWORD mock email sent');

    return { token, resetLink };
  } catch (error) {
    serviceLogger.error({ err: (error as Error).message }, "Error creating password reset token");
    throw error;
  }
}

/**
 * Validar y usar un reset token
 * Retorna userId si es válido, null si no
 */
export async function validateResetToken(token: string): Promise<number | null> {
  try {
    const result = await pool.query(
      "SELECT user_id, expires_at FROM password_resets WHERE token = $1",
      [token]
    );

    if (result.rows.length === 0) {
      return null; // Token no existe
    }

    const { user_id, expires_at } = result.rows[0];

    // Verificar que no esté expirado
    if (new Date() > new Date(expires_at)) {
      // Token expirado, eliminar
      await pool.query("DELETE FROM password_resets WHERE token = $1", [token]);
      return null;
    }

    return user_id;
  } catch (error) {
    serviceLogger.error({ err: (error as Error).message }, "Error validating reset token");
    throw error;
  }
}

/**
 * Resetear contraseña usando token válido
 */
export async function resetPasswordWithToken(
  token: string,
  newPassword: string
): Promise<boolean> {
  try {
    // 1. Validar token
    const userId = await validateResetToken(token);
    if (!userId) {
      return false;
    }

    // 2. Hash nueva contraseña
    const bcrypt = require("bcryptjs");
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // 3. Actualizar contraseña
    await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [
      passwordHash,
      userId,
    ]);

    // 4. Eliminar token usado
    await pool.query("DELETE FROM password_resets WHERE token = $1", [token]);

    serviceLogger.info(`✅ Password reset exitoso para user_id: ${userId}`);
    return true;
  } catch (error) {
    serviceLogger.error({ err: (error as Error).message }, "Error resetting password");
    throw error;
  }
}
