export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  POSTMARK_API_KEY: string;
  FRONTEND_ORIGIN: string;
  FROM_EMAIL: string;
}

export interface UserRow {
  id: number;
  email: string;
  password: string;
  salt: string;
  data: string;
  updated_at: string;
  created_at: string;
}

export interface JWTPayload {
  sub: number;
  email: string;
  iat: number;
  exp: number;
}
