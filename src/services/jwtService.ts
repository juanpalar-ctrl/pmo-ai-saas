/**
 * src/services/jwtService.ts
 * JWT signing and verification with role claim.
 */

import jwt from "jsonwebtoken";
import { authLogger } from "../core/logger";

interface TokenPayload {
  id: string;
  email: string;
  role: string;
}

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET no está definido en las variables de entorno');
}
const TOKEN_EXPIRY = process.env.JWT_EXPIRY || "8h";

export function signToken(userId: string, email: string, role: string): string {
  const payload: TokenPayload = {
    id: userId,
    email,
    role,
  };

  const token = jwt.sign(payload, JWT_SECRET as string, {
    expiresIn: TOKEN_EXPIRY,
  } as jwt.SignOptions);

  return token;
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET as string) as TokenPayload;
    return decoded;
  } catch (error) {
    authLogger.debug({ err: (error as Error).message }, "JWT verification failed");
    return null;
  }
}

export function decodeToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.decode(token) as TokenPayload | null;
    return decoded;
  } catch (error) {
    authLogger.debug({ err: (error as Error).message }, "JWT decode failed");
    return null;
  }
}
