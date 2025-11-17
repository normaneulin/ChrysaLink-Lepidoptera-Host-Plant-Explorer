/**
 * Environment configuration and validation
 */

export const projectId = Deno.env.get("SUPABASE_PROJECT_ID") || "";
export const publicAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
export const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
export const supabaseServiceKey =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

export const jwtSecret = Deno.env.get("JWT_SECRET") || "";
export const jwtExpiry = Deno.env.get("JWT_EXPIRY") || "7d";

export const mlModelApiUrl = Deno.env.get("ML_MODEL_API_URL") || "";
export const mlModelApiKey = Deno.env.get("ML_MODEL_API_KEY") || "";

export const sendgridApiKey = Deno.env.get("SENDGRID_API_KEY") || "";

export const nodeEnv = Deno.env.get("NODE_ENV") || "development";
export const logLevel = Deno.env.get("LOG_LEVEL") || "info";

/**
 * Validate required environment variables
 */
export function validateEnvironment(): string[] {
  const errors: string[] = [];

  if (!supabaseUrl) errors.push("SUPABASE_URL is required");
  if (!supabaseServiceKey)
    errors.push("SUPABASE_SERVICE_ROLE_KEY is required");
  if (!jwtSecret) errors.push("JWT_SECRET is required");

  return errors;
}
