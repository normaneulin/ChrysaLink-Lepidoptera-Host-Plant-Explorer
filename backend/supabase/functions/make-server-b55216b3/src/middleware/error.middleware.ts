import { Context, Next } from "https://esm.sh/hono";
import { AppError, formatErrorResponse } from "../utils/error-handler.ts";
import { logger } from "../utils/logger.ts";

/**
 * Global Error Handling Middleware
 */

export const errorMiddleware = async (c: Context, next: Next) => {
  try {
    await next();
  } catch (error: any) {
    logger.error("Unhandled error:", error);

    if (error instanceof AppError) {
      return c.json(
        {
          success: false,
          error: error.message,
          statusCode: error.statusCode,
        },
        error.statusCode
      );
    }

    const response = formatErrorResponse(error);
    return c.json(response, response.statusCode || 500);
  }
};
