import { useState, useEffect } from 'react';
import { Route, Switch, useLocation } from 'wouter';
import { createClient } from '@supabase/supabase-js';
import { Navbar } from './components/Navbar';
import { LandingPage } from './components/LandingPage';
import HomePage from './components/HomePage';
import { AuthPage } from './components/AuthPage';
import { ExplorePage } from './components/ExplorePage';
import { RelationshipPage } from './components/RelationshipPage';
import { ProfilePage } from './components/ProfilePage';
import { NotificationsPage } from './components/NotificationsPage';
import { UploadObservationModal } from './components/UploadObservationModal';
import { Button } from './components/ui/button';
import { Plus } from 'lucide-react';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner';
import { apiClient } from './api/client';
import { authService } from './services/auth-service';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co`,
  import.meta.env.VITE_SUPABASE_ANON_KEY || ''
);

export default function App() {
  const [location, setLocation] = useLocation();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);

  useEffect(() => {
    // Check for existing session
    checkSession();

    // Listen for auth state changes (including OAuth redirects and email confirmation)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          setAccessToken(session.access_token);
          setUserId(session.user.id);
          localStorage.setItem('accessToken', session.access_token);
          localStorage.setItem('userId', session.user.id);
          
          // Show confirmation message for email-confirmed sign-ups
          if (session.user.email_confirmed_at) {
            toast.success('Email confirmed! Welcome to ChrysaLink!');
          }
          
          // Create or update profile with complete user data
          if (session.user.email) {
            try {
              const { data: existingProfile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single();
              
              if (existingProfile) {
                // Update profile if username or email is missing
                if (!existingProfile.username || !existingProfile.email) {
                  await supabase.from('profiles').update({
                    username: existingProfile.username || session.user.email.split('@')[0],
                    email: session.user.email,
                  }).eq('id', session.user.id);
                }
              } else {
                // Create new profile
                await supabase.from('profiles').insert({
                  id: session.user.id,
                  name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
                  username: session.user.user_metadata?.username || session.user.email.split('@')[0],
                  email: session.user.email,
                });
              }
            } catch (error) {
              console.error('Profile creation error:', error);
            }
          }
          
          // Redirect to home after successful sign-in
          setTimeout(() => setLocation('/home'), 100);
        } else if (event === 'SIGNED_OUT') {
          setAccessToken(null);
          setUserId(null);
          localStorage.removeItem('accessToken');
          localStorage.removeItem('userId');
          setLocation('/');
        }
      }
    );

    return () => {
      subscription?.unsubscribe();
    };
  }, [setLocation]);

  useEffect(() => {
    // Fetch notification count when logged in
    if (accessToken) {
      fetchNotificationCount();
      // Poll for new notifications every 30 seconds
      const interval = setInterval(fetchNotificationCount, 30000);
      return () => clearInterval(interval);
    }
  }, [accessToken]);

  const checkSession = async () => {
    try {
      // Get the current session from Supabase (validates token)
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error || !session?.user) {
        // No valid session, clear stored auth data
        setAccessToken(null);
        setUserId(null);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('userId');
        return;
      }

      // Session exists and is valid
      if (session.access_token && session.user.id) {
        setAccessToken(session.access_token);
        setUserId(session.user.id);
        localStorage.setItem('accessToken', session.access_token);
        localStorage.setItem('userId', session.user.id);
      }
    } catch (error) {
      console.error('Session check error:', error);
      // On error, clear auth state to be safe
      setAccessToken(null);
      setUserId(null);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('userId');
    }
  };

  const fetchNotificationCount = async () => {
    if (!accessToken) return;

    try {
      const response = await apiClient.get('/notifications', accessToken);

      if (response.success) {
        const unreadCount = response.data?.filter((n: any) => !n.read).length || 0;
        setNotificationCount(unreadCount);
      }
    } catch (error) {
      console.error('Error fetching notification count:', error);
    }
  };

  const handleAuthSuccess = (token: string, userId: string) => {
    setAccessToken(token);
    setUserId(userId);
    localStorage.setItem('accessToken', token);
    localStorage.setItem('userId', userId);
    setLocation('/home');
  };

  const handleLogout = async () => {
    try {
      if (accessToken) {
        await authService.signOut(accessToken);
      }
      setAccessToken(null);
      setUserId(null);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('userId');
      setLocation('/');
      toast.success('Logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Failed to logout');
    }
  };

  const handleUploadSuccess = () => {
    setIsUploadModalOpen(false);
    // Refresh the current page if we're on explore
    if (location === '/explore' || location === '/your-observations') {
      window.location.reload();
    }
  };

  const isLoggedIn = !!accessToken;
  const allowedFabRoutes = ['/', '/explore', '/your-observations', '/relationships'];
  const showUploadButton = isLoggedIn && allowedFabRoutes.includes(location);

  return (
    <>
      <Navbar 
        isLoggedIn={isLoggedIn} 
        onLogout={handleLogout}
        notificationCount={notificationCount}
      />
      
      <main className="min-h-screen bg-gray-50">
        <Switch>
          <Route path="/">
            {isLoggedIn ? (
              <HomePage accessToken={accessToken} userId={userId} />
            ) : (
              <LandingPage />
            )}
          </Route>

          <Route path="/auth">
            {isLoggedIn ? (
              // If the user somehow lands on /auth while already logged in,
              // render the HomePage instead of ExplorePage so Home is the default.
              <HomePage accessToken={accessToken} userId={userId} />
            ) : (
              <AuthPage onAuthSuccess={handleAuthSuccess} />
            )}
          </Route>

          <Route path="/explore">
            <ExplorePage accessToken={accessToken} userId={userId} />
          </Route>

          <Route path="/your-observations">
            {isLoggedIn ? (
              <ExplorePage 
                accessToken={accessToken} 
                userId={userId} 
                showOnlyUserObservations={true}
              />
            ) : (
              <AuthPage onAuthSuccess={handleAuthSuccess} />
            )}
          </Route>

          <Route path="/relationships">
            <RelationshipPage />
          </Route>

          <Route path="/profile">
            {isLoggedIn && accessToken ? (
              <ProfilePage accessToken={accessToken} userId={userId || ''} />
            ) : (
              <AuthPage onAuthSuccess={handleAuthSuccess} />
            )}
          </Route>

          <Route path="/notifications">
            {isLoggedIn && accessToken ? (
              <NotificationsPage accessToken={accessToken} />
            ) : (
              <AuthPage onAuthSuccess={handleAuthSuccess} />
            )}
          </Route>

          {/* Fallback route */}
          <Route>
            <div className="container mx-auto px-4 py-20 text-center">
              <h1 className="text-4xl mb-4">404 - Page Not Found</h1>
              <p className="text-gray-600 mb-8">The page you're looking for doesn't exist.</p>
              <Button onClick={() => setLocation('/')}>
                Go Home
              </Button>
            </div>
          </Route>
        </Switch>
      </main>

      {/* Upload FAB */}
      {showUploadButton && (
        <Button
          size="lg"
          className="fixed bottom-8 right-8 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow"
          onClick={() => setIsUploadModalOpen(true)}
        >
          <Plus className="h-6 w-6" />
        </Button>
      )}

      {/* Upload Modal */}
      {accessToken && (
        <UploadObservationModal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          accessToken={accessToken}
          onSuccess={handleUploadSuccess}
        />
      )}

      <Toaster />
    </>
  );
}
