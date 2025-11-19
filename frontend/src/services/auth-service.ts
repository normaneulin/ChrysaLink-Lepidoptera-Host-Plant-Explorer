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
  username?: string;
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
   * Check if email already exists in profiles table
   * @param email - Email to check
   * @returns true if email exists, false otherwise
   */
  async checkEmailExists(email: string): Promise<boolean> {
    try {
      console.log('Checking if email exists:', email);
      const { data, error, count } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('email', email);

      console.log('Email check response:', { data, error, count });

      if (error) {
        console.error('Error checking email:', error);
        // If there's a permissions error, log it but still return false to allow signup
        if (error.code === 'PGRST116') {
          console.warn('RLS policy issue - cannot read profiles table');
        }
        return false;
      }

      const exists = (count ?? 0) > 0;
      console.log('Email exists result:', exists);
      return exists;
    } catch (error: any) {
      console.error('Exception checking email:', error);
      return false;
    }
  }

  /**
   * Check if username already exists in profiles table
   * @param username - Username to check
   * @returns true if username exists, false otherwise
   */
  async checkUsernameExists(username: string): Promise<boolean> {
    try {
      console.log('Checking if username exists:', username);
      const { data, error, count } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('username', username);

      console.log('Username check response:', { data, error, count });

      if (error) {
        console.error('Error checking username:', error);
        // If there's a permissions error, log it but still return false to allow signup
        if (error.code === 'PGRST116') {
          console.warn('RLS policy issue - cannot read profiles table');
        }
        return false;
      }

      const exists = (count ?? 0) > 0;
      console.log('Username exists result:', exists);
      return exists;
    } catch (error: any) {
      console.error('Exception checking username:', error);
      return false;
    }
  }

  /**
   * Validate signup data before attempting signup
   * @param data - User registration data
   * @returns Object with validation results { emailExists, usernameExists }
   */
  async validateSignUp(data: SignUpData): Promise<{ emailExists: boolean; usernameExists: boolean }> {
    const [emailExists, usernameExists] = await Promise.all([
      this.checkEmailExists(data.email),
      data.username ? this.checkUsernameExists(data.username) : Promise.resolve(false),
    ]);

    return { emailExists, usernameExists };
  }


  /**
   * Sign up a new user using Supabase Auth
   * @param data - User registration data
   * @returns Auth response with access token and user info
   */
  async signUp(data: SignUpData): Promise<AuthResponse> {
    try {
      console.log('SignUp called with:', { email: data.email, username: data.username });
      
      const { data: authData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            username: data.username,
          },
        },
      });

      console.log('Signup response:', { authData, error });

      if (error) {
        console.error('Auth signup error:', error);
        
        // Even if there's an error, try to create the profile if user was created
        // This handles rate limiting scenarios where signup succeeds but we get an error
        if (error.message?.toLowerCase().includes('retry') || error.message?.toLowerCase().includes('after')) {
          // This is a rate limit error - the user was likely created
          // Try to get the user from local metadata or return what we have
          return {
            accessToken: '',
            user: null, // Can't determine user on rate limit
            error: error.message,
          };
        }
        
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
      console.error('Sign up exception:', error);
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
      // Clear any stale session data before signing in fresh
      await supabase.auth.signOut();
      
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
   * Sign in with Google using Supabase Auth
   * @returns Promise that resolves when auth flow completes
   */
  async signInWithGoogle(): Promise<void> {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });

      if (error) {
        throw new Error(error.message);
      }
    } catch (error: any) {
      throw new Error(error.message || 'Google sign in failed');
    }
  }

  /**
   * Handle email confirmation from URL token
   * Called when user clicks confirmation link in email
   * @returns Auth response with access token and user info
   */
  async handleEmailConfirmation(): Promise<AuthResponse> {
    try {
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        return {
          accessToken: '',
          user: null,
          error: error.message,
        };
      }

      if (data.session) {
        return {
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token,
          user: data.session.user,
          error: undefined,
        };
      }

      return {
        accessToken: '',
        user: null,
        error: undefined,
      };
    } catch (error: any) {
      return {
        accessToken: '',
        user: null,
        error: error.message || 'Failed to confirm email',
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
