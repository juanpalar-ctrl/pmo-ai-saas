/**
 * src/routes/branding.ts
 * Rutas de branding: obtener y actualizar colores y logo
 * 
 * GET /api/branding → Devuelve configuración actual (público)
 * POST /api/branding/:organizationId → Actualiza configuración (admin)
 */

import { routeLogger } from '../core/logger';
import { errorMessage } from '../core/errors';
import express, { Request, Response } from 'express';
import { pool } from '../db';

const router = express.Router();

/**
 * GET /api/branding
 * Obtiene configuración de branding actual (colores y logo)
 * Acceso: Público (sin autenticación)
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "primaryColor": "#17B8A0",
 *     "secondaryColor": "#0B7B8C",
 *     "accentColor": "#9ED900",
 *     "logoUrl": "/uploads/logos/lara-logo.png"
 *   }
 * }
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // Obtener organizationId desde header o usar default
    const organizationId = req.headers['x-organization-id'] as string || 'org_lara_global';

    const defaults = {
      primaryColor: '#17B8A0',
      secondaryColor: '#0B7B8C',
      accentColor: '#9ED900',
      logoUrl: '/uploads/logos/lara-logo.png',
    };

    try {
      const result = await pool.query(
        'SELECT primary_color, secondary_color, accent_color, logo_url FROM branding WHERE organization_id = $1',
        [organizationId]
      );

      if (result.rows.length === 0) {
        return res.status(200).json({ success: true, data: defaults });
      }

      const b = result.rows[0];
      return res.status(200).json({
        success: true,
        data: {
          primaryColor: b.primary_color,
          secondaryColor: b.secondary_color,
          accentColor: b.accent_color,
          logoUrl: b.logo_url,
        },
      });
    } catch {
      // Tabla no existe o DB error — devolver defaults sin crashear
      return res.status(200).json({ success: true, data: defaults });
    }
  } catch (error) {
    res.status(200).json({
      success: true,
      data: { primaryColor: '#17B8A0', secondaryColor: '#0B7B8C', accentColor: '#9ED900', logoUrl: '/uploads/logos/lara-logo.png' },
    });
  }
});

/**
 * POST /api/branding/:organizationId
 * Actualiza configuración de branding (admin only)
 * 
 * Acceso: Requiere middleware de autenticación + admin role
 * (Se agregará en src/index.ts)
 * 
 * Request body (todos los campos opcionales):
 * {
 *   "primaryColor": "#RRGGBB",
 *   "secondaryColor": "#RRGGBB",
 *   "accentColor": "#RRGGBB",
 *   "logoUrl": "/path/to/logo.png"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": { ... branding actualizado ... }
 * }
 */
router.post('/:organizationId', async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.params;
    const { primaryColor, secondaryColor, accentColor, logoUrl } = req.body;

    // Validar que organizationId no esté vacío
    if (!organizationId || typeof organizationId !== 'string' || organizationId.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'organizationId parameter is required',
      });
    }

    // Validar que al menos un campo sea proporcionado
    if (!primaryColor && !secondaryColor && !accentColor && !logoUrl) {
      return res.status(400).json({
        success: false,
        error: 'At least one field must be provided',
      });
    }

    // Validar formato hex de colores si se proporcionan
    const hexPattern = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})$/;
    if (primaryColor && !hexPattern.test(primaryColor)) {
      return res.status(400).json({
        success: false,
        error: `Invalid primaryColor format: ${primaryColor}`,
      });
    }
    if (secondaryColor && !hexPattern.test(secondaryColor)) {
      return res.status(400).json({
        success: false,
        error: `Invalid secondaryColor format: ${secondaryColor}`,
      });
    }
    if (accentColor && !hexPattern.test(accentColor)) {
      return res.status(400).json({
        success: false,
        error: `Invalid accentColor format: ${accentColor}`,
      });
    }

    // Construir UPDATE dinámico (solo campos proporcionados)
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (primaryColor) {
      fields.push(`primary_color = $${paramIndex}`);
      values.push(primaryColor);
      paramIndex++;
    }
    if (secondaryColor) {
      fields.push(`secondary_color = $${paramIndex}`);
      values.push(secondaryColor);
      paramIndex++;
    }
    if (accentColor) {
      fields.push(`accent_color = $${paramIndex}`);
      values.push(accentColor);
      paramIndex++;
    }
    if (logoUrl) {
      fields.push(`logo_url = $${paramIndex}`);
      values.push(logoUrl);
      paramIndex++;
    }

    // Agregar updated_at
    fields.push(`updated_at = CURRENT_TIMESTAMP`);

    // Agregar organizationId como último parámetro
    values.push(organizationId);

    const updateQuery = `
      UPDATE branding 
      SET ${fields.join(', ')} 
      WHERE organization_id = $${paramIndex}
      RETURNING primary_color, secondary_color, accent_color, logo_url
    `;

    const result = await pool.query(updateQuery, values);

    if (result.rows.length === 0) {
      // Si no existe, insertar
      const insertResult = await pool.query(
        `INSERT INTO branding (organization_id, primary_color, secondary_color, accent_color, logo_url)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING primary_color, secondary_color, accent_color, logo_url`,
        [
          organizationId,
          primaryColor || '#17B8A0',
          secondaryColor || '#0B7B8C',
          accentColor || '#9ED900',
          logoUrl || '/uploads/logos/lara-logo.png',
        ]
      );

      const branding = insertResult.rows[0];
      return res.status(201).json({
        success: true,
        data: {
          primaryColor: branding.primary_color,
          secondaryColor: branding.secondary_color,
          accentColor: branding.accent_color,
          logoUrl: branding.logo_url,
        },
        message: `Branding created for organization: ${organizationId}`,
      });
    }

    // Actualización exitosa
    const branding = result.rows[0];
    res.status(200).json({
      success: true,
      data: {
        primaryColor: branding.primary_color,
        secondaryColor: branding.secondary_color,
        accentColor: branding.accent_color,
        logoUrl: branding.logo_url,
      },
      message: `Branding updated for organization: ${organizationId}`,
    });
  } catch (error) {
    routeLogger.error({ err: errorMessage(error) }, 'POST /branding error');
    res.status(500).json({
      success: false,
      error: 'Failed to update branding',
      message: errorMessage(error),
    });
  }
});

export default router;
