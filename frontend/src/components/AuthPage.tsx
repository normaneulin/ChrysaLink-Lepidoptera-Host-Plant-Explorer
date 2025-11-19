import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { toast } from 'sonner';
import { authService } from '../services/auth-service';

interface AuthPageProps {
  onAuthSuccess: (accessToken: string, userId: string) => void;
}

interface SignUpErrors {
  email?: string;
  username?: string;
  password?: string;
  passwordConfirm?: string;
}

export function AuthPage({ onAuthSuccess }: AuthPageProps) {
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [signUpForm, setSignUpForm] = useState({
    email: '',
    username: '',
    password: '',
    passwordConfirm: '',
  });
  const [signUpErrors, setSignUpErrors] = useState<SignUpErrors>({});
  const [validationInProgress, setValidationInProgress] = useState(false);

  // Validate email format
  const validateEmail = (email: string): string | undefined => {
    if (!email) return undefined;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return 'Please enter a valid email address';
    }
    return undefined;
  };

  // Validate username format
  const validateUsername = (username: string): string | undefined => {
    if (!username) return undefined;
    if (username.length < 3) return 'Username must be at least 3 characters';
    if (username.length > 20) return 'Username must be at most 20 characters';
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return 'Username can only contain letters, numbers, underscores, and hyphens';
    }
    return undefined;
  };

  // Validate password
  const validatePassword = (password: string): string | undefined => {
    if (!password) return undefined;
    if (password.length < 6) return 'Password must be at least 6 characters';
    return undefined;
  };

  // Validate password confirmation
  const validatePasswordConfirm = (
    password: string,
    passwordConfirm: string
  ): string | undefined => {
    if (!passwordConfirm) return undefined;
    if (password !== passwordConfirm) return 'Passwords do not match';
    return undefined;
  };

  // Validate on form changes with debouncing
  useEffect(() => {
    const validateForm = async () => {
      const newErrors: SignUpErrors = {};

      // Validate email format first
      newErrors.email = validateEmail(signUpForm.email);

      // Validate username format first
      newErrors.username = validateUsername(signUpForm.username);

      // Validate password
      newErrors.password = validatePassword(signUpForm.password);

      // Validate password confirmation
      newErrors.passwordConfirm = validatePasswordConfirm(
        signUpForm.password,
        signUpForm.passwordConfirm
      );

      setSignUpErrors(newErrors);
    };

    const timer = setTimeout(() => {
      validateForm();
    }, 500); // Debounce validation by 500ms

    return () => clearTimeout(timer);
  }, [signUpForm]);

  // Handle signup form input changes
  const handleSignUpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSignUpForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Don't submit if there are validation errors
    if (Object.values(signUpErrors).some((error) => error)) {
      toast.error('Please fix the errors below');
      return;
    }

    // Validate all fields are filled
    if (
      !signUpForm.email ||
      !signUpForm.username ||
      !signUpForm.password ||
      !signUpForm.passwordConfirm
    ) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsLoading(true);

    try {
      // Check if email or username already exist in database
      const { emailExists, usernameExists } = await authService.validateSignUp({
        email: signUpForm.email,
        name: '',
        username: signUpForm.username,
        password: signUpForm.password,
      });

      console.log('Validation results:', { emailExists, usernameExists });

      const newErrors: SignUpErrors = { ...signUpErrors };
      
      if (emailExists) {
        newErrors.email = 'Email has already been taken';
      }
      
      if (usernameExists) {
        newErrors.username = 'Username has already been taken';
      }

      // If either exists, show errors and don't proceed
      if (emailExists || usernameExists) {
        console.log('Email or username already exists, preventing signup');
        setSignUpErrors(newErrors);
        toast.error('Email or username already exists');
        // Clear the email and/or username fields that have duplicates
        setSignUpForm((prev) => ({
          ...prev,
          ...(emailExists && { email: '' }),
          ...(usernameExists && { username: '' }),
        }));
        setIsLoading(false);
        return;
      }

      const response = await authService.signUp({
        email: signUpForm.email,
        name: '', // Not used - name will be edited by user later in profile
        username: signUpForm.username,
        password: signUpForm.password,
      });

      if (response.error) {
        // Check if it's a rate limit error - if so, still show the email confirmation message
        if (response.error.toLowerCase().includes('retry') || response.error.toLowerCase().includes('after')) {
          toast.success('Account creation in progress! Please check your email to confirm your sign up.');
          setSignUpForm({ email: '', username: '', password: '', passwordConfirm: '' });
          setIsLoading(false);
          return;
        }
        toast.error(response.error);
        setIsLoading(false);
        return;
      }

      // If user was created (either with or without accessToken)
      if (response.user) {
        // If we have an access token, user is immediately signed in
        if (response.accessToken) {
          onAuthSuccess(response.accessToken, response.user.id);
          toast.success('Account created successfully!');
          setLocation('/');
        } else {
          // Email confirmation required - show appropriate message
          toast.success('Account created! Please check your email to confirm your sign up.');
          // Clear the form
          setSignUpForm({ email: '', username: '', password: '', passwordConfirm: '' });
          setIsLoading(false);
          setLocation('/')
        }
      } else {
        // No error and no user - shouldn't happen but handle it
        toast.error('Sign up failed. Please try again.');
        setIsLoading(false);
      }
    } catch (error: any) {
      console.error('Sign up error:', error);
      toast.error(error.message || 'Failed to sign up');
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      await authService.signInWithGoogle();
      // The redirect will happen automatically, so we don't need to call onAuthSuccess here
    } catch (error: any) {
      console.error('Google sign in error:', error);
      toast.error(error.message || 'Failed to sign in with Google');
      setIsLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    try {
      const response = await authService.signIn({ email, password });

      if (response.error) {
        throw new Error(response.error);
      }

      if (response.accessToken && response.user) {
        onAuthSuccess(response.accessToken, response.user.id);
        toast.success('Signed in successfully!');
        setLocation('/');
      }
    } catch (error: any) {
      console.error('Sign in error:', error);
      toast.error(error.message || 'Failed to sign in');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome to ChrysaLink</CardTitle>
          <CardDescription>
            Sign in or create an account to start documenting Lepidoptera and host plants
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Log In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    name="email"
                    type="email"
                    required
                    placeholder="you@example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="signin-password">Password</Label>
                  <Input
                    id="signin-password"
                    name="password"
                    type="password"
                    required
                    placeholder="••••••••"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Signing In...' : 'Log In'}
                </Button>
              </form>

              {/* Divider */}
              <div className="my-4 flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-300"></div>
                <span className="text-sm text-gray-500">or</span>
                <div className="flex-1 h-px bg-gray-300"></div>
              </div>

              {/* Google Sign In */}
              <Button
                onClick={handleGoogleSignIn}
                variant="outline"
                className="w-full"
                disabled={isLoading}
              >
                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Sign in with Google
              </Button>

              <p className="text-sm text-gray-600 text-center mt-4">
                Don't have an account? Sign up!
              </p>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div>
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    name="email"
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={signUpForm.email}
                    onChange={handleSignUpChange}
                    className={signUpErrors.email ? 'border-red-500' : ''}
                  />
                  {signUpErrors.email && (
                    <p className="text-red-500 text-sm mt-1">{signUpErrors.email}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="signup-username">Username</Label>
                  <Input
                    id="signup-username"
                    name="username"
                    type="text"
                    required
                    placeholder="Choose a username"
                    minLength={3}
                    maxLength={20}
                    value={signUpForm.username}
                    onChange={handleSignUpChange}
                    className={signUpErrors.username ? 'border-red-500' : ''}
                  />
                  {signUpErrors.username && (
                    <p className="text-red-500 text-sm mt-1">{signUpErrors.username}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    name="password"
                    type="password"
                    required
                    placeholder="••••••••"
                    minLength={6}
                    value={signUpForm.password}
                    onChange={handleSignUpChange}
                    className={signUpErrors.password ? 'border-red-500' : ''}
                  />
                  {signUpErrors.password && (
                    <p className="text-red-500 text-sm mt-1">{signUpErrors.password}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="signup-password-confirm">Confirm Password</Label>
                  <Input
                    id="signup-password-confirm"
                    name="passwordConfirm"
                    type="password"
                    required
                    placeholder="••••••••"
                    minLength={6}
                    value={signUpForm.passwordConfirm}
                    onChange={handleSignUpChange}
                    className={signUpErrors.passwordConfirm ? 'border-red-500' : ''}
                  />
                  {signUpErrors.passwordConfirm && (
                    <p className="text-red-500 text-sm mt-1">{signUpErrors.passwordConfirm}</p>
                  )}
                </div>
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isLoading || Object.values(signUpErrors).some((error) => error)}
                >
                  {isLoading ? 'Creating Account...' : 'Sign Up'}
                </Button>
              </form>

              {/* Divider */}
              <div className="my-4 flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-300"></div>
                <span className="text-sm text-gray-500">or</span>
                <div className="flex-1 h-px bg-gray-300"></div>
              </div>

              {/* Google Sign Up */}
              <Button
                onClick={handleGoogleSignIn}
                variant="outline"
                className="w-full"
                disabled={isLoading}
              >
                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Sign up with Google
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
