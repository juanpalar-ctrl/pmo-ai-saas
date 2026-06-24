/**
 * src/services/jwtService.ts
 * JWT signing and verification with role claim.
 */

import jwt from "jsonwebtoken";

interface TokenPayload {
  id: number;
  email: string;
  role: string;
}

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const TOKEN_EXPIRY = process.env.JWT_EXPIRY || "10m";

/**
 * Signs a JWT token with user identity and role.
 * @param userId User database ID
 * @param email User email
 * @param role User role (e.g., 'user', 'admin')
 * @returns Signed JWT token string
 */
export function signToken(userId: number, email: string, role: string): string {
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

/**
 * Verifies a JWT token and returns the payload.
 * @param token JWT token string
 * @returns Decoded payload or null if invalid
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET as string) as TokenPayload;
    return decoded;
  } catch (error) {
    console.error("JWT verification failed:", error);
    return null;
  }
}

/**
 * Decodes a JWT token without verification (for reading claims on the client side).
 * Use only for non-critical claims reading.
 * @param token JWT token string
 * @returns Decoded payload or null if invalid
 */
export function decodeToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.decode(token) as TokenPayload | null;
    return decoded;
  } catch (error) {
    console.error("JWT decode failed:", error);
    return null;
  }
}
