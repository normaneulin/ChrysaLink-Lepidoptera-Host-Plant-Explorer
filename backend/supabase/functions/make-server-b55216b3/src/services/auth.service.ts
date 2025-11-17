import { supabase, ensureProfileForUser } from "../config/supabase.ts";
import { SignUpData, SignInData, AuthResponse, AuthUser } from "../types/auth.types.ts";
import { ValidationError, UnauthorizedError } from "../utils/error-handler.ts";
import { validateEmail, validatePassword } from "../utils/validators.ts";

/**
 * Authentication Service
 * Handles user signup, login, logout, and session management
 * This is BACKEND logic - handles Supabase Auth and database interactions
 */

export const AuthService = {
  /**
   * Sign up a new user
   * Creates user in Supabase Auth and ensures profile exists in database
   */
  async signUp(data: SignUpData): Promise<AuthUser> {
    // Validate input
    if (!validateEmail(data.email)) {
      throw new ValidationError("Invalid email format");
    }

    if (!validatePassword(data.password)) {
      throw new ValidationError(
        "Password must be at least 8 characters with uppercase, lowercase, and numbers"
      );
    }

    if (!data.name || data.name.trim().length === 0) {
      throw new ValidationError("Name is required");
    }

    try {
      // Create user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.admin
        .createUser({
          email: data.email,
          password: data.password,
          user_metadata: { name: data.name },
          email_confirm: false,
        });

      if (authError || !authData.user) {
        throw new Error(authError?.message || "Failed to create user");
      }

      // Ensure profile exists in database
      await ensureProfileForUser(authData.user);

      return {
        id: authData.user.id,
        email: authData.user.email || "",
        name: data.name,
        created_at: authData.user.created_at,
      };
    } catch (error: any) {
      throw new Error(error.message || "Signup failed");
    }
  },

  /**
   * Sign in a user
   * Verifies credentials via Supabase Auth
   */
  async signIn(data: SignInData): Promise<{
    user: AuthUser;
    accessToken: string;
    refreshToken: string;
  }> {
    if (!validateEmail(data.email)) {
      throw new ValidationError("Invalid email format");
    }

    try {
      const { data: authData, error } = await supabase.auth
        .signInWithPassword({
          email: data.email,
          password: data.password,
        });

      if (error || !authData.session || !authData.user) {
        if (error?.message.includes("Invalid login credentials")) {
          throw new UnauthorizedError(
            "Invalid email or password. Please check your credentials or sign up for a new account."
          );
        }
        throw new UnauthorizedError(error?.message || "Failed to sign in");
      }

      // Ensure profile exists
      if (authData.user) {
        await ensureProfileForUser(authData.user);
      }

      return {
        user: {
          id: authData.user.id,
          email: authData.user.email || "",
          name: authData.user.user_metadata?.name,
          created_at: authData.user.created_at,
        },
        accessToken: authData.session.access_token,
        refreshToken: authData.session.refresh_token || "",
      };
    } catch (error: any) {
      if (error instanceof UnauthorizedError || error instanceof ValidationError) {
        throw error;
      }
      throw new Error(error.message || "Sign in failed");
    }
  },

  /**
   * Sign out a user
   * Invalidates session in Supabase Auth
   */
  async signOut(userId: string): Promise<void> {
    try {
      // Supabase doesn't require userId for signout in edge functions context
      // This is a placeholder for any custom logout logic
      console.log(`User ${userId} signed out`);
    } catch (error: any) {
      throw new Error(error.message || "Sign out failed");
    }
  },

  /**
   * Verify a user's access token
   * Used for validating authentication in requests
   */
  async verifyToken(token: string): Promise<AuthUser> {
    try {
      const { data, error } = await supabase.auth.getUser(token);

      if (error || !data.user) {
        throw new UnauthorizedError("Invalid or expired token");
      }

      return {
        id: data.user.id,
        email: data.user.email || "",
        name: data.user.user_metadata?.name,
        created_at: data.user.created_at,
      };
    } catch (error: any) {
      throw new UnauthorizedError(error.message || "Token verification failed");
    }
  },

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<AuthUser | null> {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, name, created_at")
        .eq("id", userId)
        .single();

      if (error || !data) {
        return null;
      }

      return data as AuthUser;
    } catch (error) {
      console.error("Error fetching user:", error);
      return null;
    }
  },

  /**
   * Update user profile
   */
  async updateUserProfile(
    userId: string,
    updates: Partial<AuthUser>
  ): Promise<AuthUser> {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", userId)
        .select()
        .single();

      if (error || !data) {
        throw new Error(error?.message || "Failed to update profile");
      }

      return data as AuthUser;
    } catch (error: any) {
      throw new Error(error.message || "Profile update failed");
    }
  },
};
