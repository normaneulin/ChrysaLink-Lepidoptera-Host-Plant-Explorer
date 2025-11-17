import { createClient } from '@supabase/supabase-js';

/**
 * Frontend Authentication Service
 * Uses Supabase Auth for authentication
 * Will be migrated to backend edge functions later
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 
  `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co`;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
  refreshToken?: string;
  user: any;
  error?: string;
}

class AuthService {
  /**
   * Sign up a new user using Supabase Auth
   * @param data - User registration data
   * @returns Auth response with access token and user info
   */
  async signUp(data: SignUpData): Promise<AuthResponse> {
    try {
      const { data: authData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            name: data.name,
          },
        },
      });

      if (error) {
        return {
          accessToken: '',
          user: null,
          error: error.message,
        };
      }

      // Create user profile
      if (authData.user) {
        await supabase.from('profiles').insert({
          id: authData.user.id,
          email: data.email,
          name: data.name,
          created_at: new Date().toISOString(),
        }).select().single();
      }

      return {
        accessToken: authData.session?.access_token || '',
        refreshToken: authData.session?.refresh_token,
        user: authData.user,
        error: undefined,
      };
    } catch (error: any) {
      return {
        accessToken: '',
        user: null,
        error: error.message || 'Sign up failed',
      };
    }
  }

  /**
   * Sign in using Supabase Auth
   * @param data - User login credentials
   * @returns Auth response with access token and user info
   */
  async signIn(data: SignInData): Promise<AuthResponse> {
    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) {
        return {
          accessToken: '',
          user: null,
          error: error.message,
        };
      }

      return {
        accessToken: authData.session?.access_token || '',
        refreshToken: authData.session?.refresh_token,
        user: authData.user,
        error: undefined,
      };
    } catch (error: any) {
      return {
        accessToken: '',
        user: null,
        error: error.message || 'Sign in failed',
      };
    }
  }

  /**
   * Sign out the current user
   * @param accessToken - User's access token (not used with Supabase Auth)
   * @returns Error if sign out fails
   */
  async signOut(accessToken?: string): Promise<{ error?: string }> {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        return { error: error.message };
      }

      return {};
    } catch (error: any) {
      return { error: error.message || 'Sign out failed' };
    }
  }

  /**
   * Get current user info from Supabase Auth
   * @param accessToken - User's access token (optional)
   * @returns Current user or null
   */
  async getCurrentUser(accessToken?: string) {
    try {
      // Try to get from Supabase session first
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Fetch full profile from database
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        return {
          ...user,
          ...profile,
        };
      }

      return null;
    } catch (error: any) {
      console.error('Failed to get current user:', error.message);
      return null;
    }
  }
}

export const authService = new AuthService();
