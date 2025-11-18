import { Link } from 'wouter';
import { Bell, User, LogOut } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

interface NavbarProps {
  isLoggedIn: boolean;
  onLogout?: () => void;
  notificationCount?: number;
  isLoggingOut?: boolean;
}

export function Navbar({ isLoggedIn, onLogout, notificationCount = 0, isLoggingOut = false }: NavbarProps) {
  return (
    <nav className="border-b bg-white">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
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
        
        <div className="flex items-center gap-4">
          {isLoggedIn ? (
            <>
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
              <Link href="/profile">
                <Button variant="ghost" size="icon">
                  <User className="h-5 w-5" />
                </Button>
              </Link>
              <Button variant="ghost" size="icon" onClick={onLogout} disabled={isLoggingOut}>
                <LogOut className="h-5 w-5" />
              </Button>
            </>
          ) : (
            <Link href="/auth">
              <Button>Log In or Sign Up</Button>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
