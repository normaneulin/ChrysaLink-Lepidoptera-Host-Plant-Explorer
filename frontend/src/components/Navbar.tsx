import { Link } from 'wouter';
import { useEffect, useRef, useState } from 'react';
import { Bell, LogOut, Upload, Info } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import { apiClient } from '../api/client';
import { supabase } from '../lib/supabase';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

interface NavbarProps {
  isLoggedIn: boolean;
  onLogout?: () => void;
  notificationCount?: number;
  isLoggingOut?: boolean;
  setIsUploadModalOpen?: (open: boolean) => void;
  user?: {
    avatar?: string | null;
    avatar_url?: string | null;
    username?: string | null;
    name?: string | null;
    fullName?: string | null;
    observationCount?: number | null;
  };
  userId?: string;
}

export function Navbar({ isLoggedIn, onLogout, notificationCount = 0, isLoggingOut = false, setIsUploadModalOpen, user, userId }: NavbarProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [profile, setProfile] = useState<any | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  const fetchProfile = async (userId?: string) => {
    if (!userId) {
      console.log('[Navbar] fetchProfile: no userId provided');
      return null;
    }
    console.log('[Navbar] fetchProfile called with userId:', userId);
    try {
      const res = await apiClient.getProfile(userId);
      console.log('[Navbar] getProfile API response:', res);
      if (res.success && res.data) {
        const profileData = {
          ...res.data,
          observationCount: res.data?.observation_count || res.data?.observationCount || 0,
        };
        console.log('[Navbar] Setting profile state:', profileData);
        setProfile(profileData);
        return res.data;
      }
    } catch (err) {
      console.error('[Navbar] Failed to fetch profile:', err);
    }
    // Fallback: try fetching by username directly via Supabase (if userId appears to be a username)
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('username', userId).single();
      if (!error && data) {
        setProfile({
          ...data,
          observationCount: data?.observation_count || data?.observationCount || 0,
        });
        return data;
      }
    } catch (e) {
      // swallow fallback errors
    }
    return null;
  };

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        profileRef.current &&
        !profileRef.current.contains(e.target as Node)
      ) {
        setProfileOpen(false);
      }
    }

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  async function toggleProfile(e: React.MouseEvent) {
    e.stopPropagation();
    const willOpen = !profileOpen;
    if (willOpen) {
      // try to fetch profile using userId prop or user.username/name as fallback id
      const id = userId || (user as any)?.id || (user as any)?.userId || (user as any)?.username || (user as any)?.name;
      console.log('[Navbar] toggleProfile - userId from props:', userId);
      console.log('[Navbar] toggleProfile - user from props:', user);
      console.log('[Navbar] toggleProfile - computed id:', id);
      if (id) {
        await fetchProfile(id as string);
      }
      setProfileOpen(true);
    } else {
      setProfileOpen(false);
    }
  }

  function handleLogoutClick() {
    const ok = window.confirm('Are you sure you want to log out?');
    if (ok && onLogout) onLogout();
    setProfileOpen(false);
  }

  return (
    <nav className="border-b bg-white w-full">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between relative">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80">
            <img src="/navbar/logo.png" alt="ChrysaLink logo" className="w-8 h-8 rounded-lg" />
            <span className="font-semibold">ChrysaLink</span>
          </Link>

          <>
            <Link href="/explore" className="hover:text-green-600 transition-colors">
              Explore
            </Link>
            {isLoggedIn && (
              <Link href="/your-observations" className="hover:text-green-600 transition-colors">
                Your Observations
              </Link>
            )}
            <Link href="/relationships" className="hover:text-green-600 transition-colors">
              See Relationship
            </Link>
          </>
        </div>

        <div className="flex items-center gap-4 relative">
          {isLoggedIn ? (
            <>
              {/* Upload button (leftmost) */}
              <button
                onClick={() => setIsUploadModalOpen?.(true)}
                className="flex items-center gap-2 bg-transparent border border-gray-200 rounded-full px-3 py-1"
                aria-label="Upload"
                title="Upload"
              >
                <span className="font-bold">+</span>
                <span className="ml-1">Upload</span>
              </button>

              {/* Notifications */}
              <Link href="/notifications" className="relative">
                <Button variant="ghost" size="icon">
                  <Bell className="h-5 w-5" />
                </Button>
                {notificationCount > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
                    {notificationCount}
                  </Badge>
                )}
              </Link>

              {/* Profile avatar + dropdown */}
              <div className="inline-block" ref={profileRef}>
                <button onClick={toggleProfile} aria-label="Account menu" className="p-0 bg-transparent border-0">
                    <Avatar className="h-12 w-12 border-2 border-white shadow-sm mr-3">
                      <AvatarImage src={profile?.avatar_url || profile?.avatar || user?.avatar || user?.avatar_url || '/navbar/profile.png'} />
                      <AvatarFallback>{(profile?.username?.[0]?.toUpperCase()) || (profile?.name?.[0]?.toUpperCase()) || (user?.name?.[0]?.toUpperCase()) || (user?.username?.[0]?.toUpperCase()) || 'U'}</AvatarFallback>
                    </Avatar>
                </button>

                {profileOpen && (
                  <div className="absolute top-full right-4 mt-2 min-w-[280px] max-w-[360px] bg-white border rounded-md shadow-md z-50 text-sm text-gray-700 overflow-hidden origin-top-right">
                    <Link href="/profile" className="block">
                      <div className="flex items-center p-3 border-b" onClick={() => setProfileOpen(false)}>
                        <Avatar className="h-12 w-12 border-2 border-white shadow-sm mr-3 flex-shrink-0">
                          <AvatarImage src={profile?.avatar_url || profile?.avatar || user?.avatar || user?.avatar_url || '/navbar/profile.png'} />
                          <AvatarFallback className="uppercase">{(profile?.username?.[0]) || (profile?.name?.[0]) || (user?.username?.[0]) || (user?.name?.[0]) || 'U'}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col ml-2 items-start min-w-0">
                          <span className="font-bold text-base text-gray-900 text-left max-w-[200px] truncate">{profile?.username || profile?.name || user?.username || user?.name || user?.fullName || 'Unknown User'}</span>
                          <span className="text-sm text-gray-500 font-medium text-left">{profile?.observation_count ?? profile?.observationCount ?? user?.observationCount ?? 0} observations</span>
                        </div>
                      </div>
                    </Link>

                    <div className="divide-y">
                      <Link href="/about" className="block px-3 py-2 hover:bg-gray-100">
                        <div className="flex items-center gap-2">
                          <Info className="h-4 w-4 ml-2" />
                          <span>About</span>
                        </div>
                      </Link>

                      <div className="border-t" />

                      <button onClick={handleLogoutClick} className="w-full text-left px-3 py-2 hover:bg-gray-100">
                        <div className="flex items-center gap-2">
                          <LogOut className="h-4 w-4" />
                          <span>Logout</span>
                        </div>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <Link href="/auth">
              <Button>Log In or Sign Up</Button>
            </Link>
          )}
        </div>
      </div>
      {/* Overlay to close menu when clicking outside */}
      {profileOpen && (
        <div
          ref={overlayRef}
          className="fixed inset-0 z-40"
          onClick={() => setProfileOpen(false)}
        />
      )}
    </nav>
  );
}
