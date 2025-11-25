import { useState, useEffect } from 'react';
import { Route, Switch, useLocation } from 'wouter';
import { supabase } from './lib/supabase';
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

export default function App() {
  const [location, setLocation] = useLocation();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);

  useEffect(() => {
    // Check for existing session first
    const initializeAuth = async () => {
      await checkSession();
    };

    initializeAuth();

    // Listen for auth state changes (including OAuth redirects and email confirmation)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          setAccessToken(session.access_token);
          setUserId(session.user.id);
          localStorage.setItem('accessToken', session.access_token);
          localStorage.setItem('userId', session.user.id);
          
          // Redirect to home after successful sign-in
          setTimeout(() => setLocation('/'), 100);
        } else if (event === 'SIGNED_OUT') {
          setAccessToken(null);
          setUserId(null);
          localStorage.removeItem('accessToken');
          localStorage.removeItem('userId');
          setLocation('/');
        }
      }
    );

    // Cleanup subscription on unmount
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
    setLocation('/');
  };

  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (isLoggingOut) return; // Prevent double-click
    
    setIsLoggingOut(true);
    try {
      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.warn('Supabase signOut warning:', error);
        // Continue with local logout even if Supabase signOut has issues
      }
    } catch (error) {
      console.error('Supabase signOut error:', error);
      // Continue with local logout even on error
    } finally {
      // Always clear local state and storage
      setAccessToken(null);
      setUserId(null);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('userId');
      setLocation('/');
      toast.success('Logged out successfully');
      setIsLoggingOut(false);
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
        isLoggingOut={isLoggingOut}
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
