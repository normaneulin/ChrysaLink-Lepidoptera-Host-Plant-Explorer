/**
 * Authentication related type definitions
 */

export interface SignUpData {
  email: string;
  password: string;
  name: string;
}

export interface SignInData {
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser | null;
  error?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  created_at?: string;
}

export interface JWTPayload {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}
