import { Context } from "https://esm.sh/hono";
import { AuthService } from "../services/auth.service.ts";
import { SignUpData, SignInData } from "../types/auth.types.ts";
import { formatErrorResponse } from "../utils/error-handler.ts";

/**
 * Authentication Controller
 * Handles signup, login, and logout endpoints
 */

export const authController = {
  /**
   * POST /auth/signup
   * Create a new user account
   */
  async signup(c: Context) {
    try {
      const body = await c.req.json();
      const { email, password, name } = body as SignUpData;

      const user = await AuthService.signUp({ email, password, name });

      return c.json(
        {
          success: true,
          data: user,
          message: "User created successfully",
        },
        201
      );
    } catch (error: any) {
      const errorResponse = formatErrorResponse(error);
      return c.json(errorResponse, errorResponse.statusCode || 400);
    }
  },

  /**
   * POST /auth/login
   * Authenticate user and return access token
   */
  async login(c: Context) {
    try {
      const body = await c.req.json();
      const { email, password } = body as SignInData;

      const result = await AuthService.signIn({ email, password });

      return c.json({
        success: true,
        data: {
          user: result.user,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        },
      });
    } catch (error: any) {
      const errorResponse = formatErrorResponse(error);
      return c.json(errorResponse, errorResponse.statusCode || 400);
    }
  },

  /**
   * POST /auth/logout
   * Logout current user
   */
  async logout(c: Context) {
    try {
      const userId = c.get("userId");

      if (!userId) {
        return c.json(
          { success: false, error: "Unauthorized" },
          401
        );
      }

      await AuthService.signOut(userId);

      return c.json({
        success: true,
        message: "Logged out successfully",
      });
    } catch (error: any) {
      const errorResponse = formatErrorResponse(error);
      return c.json(errorResponse, errorResponse.statusCode || 400);
    }
  },

  /**
   * GET /auth/me
   * Get current user info
   */
  async getCurrentUser(c: Context) {
    try {
      const userId = c.get("userId");

      if (!userId) {
        return c.json(
          { success: false, error: "Unauthorized" },
          401
        );
      }

      const user = await AuthService.getUserById(userId);

      if (!user) {
        return c.json(
          { success: false, error: "User not found" },
          404
        );
      }

      return c.json({
        success: true,
        data: user,
      });
    } catch (error: any) {
      const errorResponse = formatErrorResponse(error);
      return c.json(errorResponse, errorResponse.statusCode || 400);
    }
  },
};
