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

export default function App() {
  const [location, setLocation] = useLocation();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);

  useEffect(() => {
    // Check for existing session
    checkSession();
  }, []);

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
      // Check if user is logged in with Supabase Auth
      const user = await authService.getCurrentUser();
      if (user) {
        // Get the current session to get the access token
        const { data: { session } } = await createClient(
          import.meta.env.VITE_SUPABASE_URL || `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co`,
          import.meta.env.VITE_SUPABASE_ANON_KEY || ''
        ).auth.getSession();
        
        if (session?.access_token) {
          setAccessToken(session.access_token);
          setUserId(user.id);
          localStorage.setItem('accessToken', session.access_token);
        }
      }
    } catch (error) {
      console.error('Session check error:', error);
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
              <ProfilePage accessToken={accessToken} />
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
