import { verifyJWT } from "./crypto";
import type { Env, JWTPayload } from "./types";

export async function requireAuth(request: Request, env: Env): Promise<JWTPayload> {
  const auth = request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    throw new AuthError("Missing authorization token");
  }
  const token = auth.slice(7);
  try {
    return await verifyJWT(token, env.JWT_SECRET);
  } catch {
    throw new AuthError("Invalid or expired token");
  }
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}
