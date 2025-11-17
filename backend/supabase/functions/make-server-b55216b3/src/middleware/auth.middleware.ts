import { Context, Next } from "https://esm.sh/hono";
import { supabase } from "../config/supabase.ts";
import { UnauthorizedError } from "../utils/error-handler.ts";

/**
 * Authentication Middleware
 * Verifies JWT token from Authorization header
 */

export const authMiddleware = async (c: Context, next: Next) => {
  try {
    const authHeader = c.req.header("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedError("Missing or invalid Authorization header");
    }

    const token = authHeader.substring(7); // Remove "Bearer "

    // Verify token with Supabase
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      throw new UnauthorizedError("Invalid or expired token");
    }

    // Attach user to context
    c.set("user", data.user);
    c.set("userId", data.user.id);

    await next();
  } catch (error: any) {
    const statusCode = error.statusCode || 401;
    const message = error.message || "Unauthorized";

    return c.json(
      {
        success: false,
        error: message,
        statusCode,
      },
      statusCode
    );
  }
};

/**
 * Optional auth middleware - doesn't throw if token is missing
 */
export const optionalAuthMiddleware = async (c: Context, next: Next) => {
  try {
    const authHeader = c.req.header("Authorization");

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const { data } = await supabase.auth.getUser(token);

      if (data.user) {
        c.set("user", data.user);
        c.set("userId", data.user.id);
      }
    }

    await next();
  } catch (error) {
    // Silently fail for optional auth
    await next();
  }
};
