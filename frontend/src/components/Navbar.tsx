import { Link } from 'wouter';
import { Bell, User, LogOut, Menu, X } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { useState } from 'react';

interface NavbarProps {
  isLoggedIn: boolean;
  onLogout?: () => void;
  notificationCount?: number;
}

export function Navbar({ isLoggedIn, onLogout, notificationCount = 0 }: NavbarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <nav className="border-b bg-white">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4 md:gap-8">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 flex-shrink-0">
            <img src="/navbar/logo.png" alt="ChrysaLink logo" className="w-8 h-8 rounded-lg" />
            <span className="font-semibold hidden sm:inline">ChrysaLink</span>
          </Link>
          
          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-6">
            <Link href="/explore" className="hover:text-green-600 transition-colors text-sm">
              Explore
            </Link>
            {isLoggedIn && (
              <Link href="/your-observations" className="hover:text-green-600 transition-colors text-sm">
                Your Observations
              </Link>
            )}
            <Link href="/relationships" className="hover:text-green-600 transition-colors text-sm">
              See Relationship
            </Link>
          </div>
        </div>
        
        <div className="flex items-center gap-2 md:gap-4">
          {isLoggedIn ? (
            <>
              <Link href="/notifications" className="relative hidden sm:block">
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Bell className="h-4 w-4" />
                </Button>
                {notificationCount > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
                    {notificationCount}
                  </Badge>
                )}
              </Link>
              <Link href="/profile" className="hidden sm:block">
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <User className="h-4 w-4" />
                </Button>
              </Link>
              <Button variant="ghost" size="icon" onClick={onLogout} className="hidden sm:flex h-9 w-9">
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Link href="/auth" className="hidden sm:block">
              <Button className="text-sm">Log In</Button>
            </Link>
          )}
          
          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2"
          >
            {isMobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t bg-white">
          <div className="container mx-auto px-4 py-4 space-y-3">
            <Link href="/explore" className="block py-2 hover:text-green-600">
              Explore
            </Link>
            {isLoggedIn && (
              <Link href="/your-observations" className="block py-2 hover:text-green-600">
                Your Observations
              </Link>
            )}
            <Link href="/relationships" className="block py-2 hover:text-green-600">
              See Relationship
            </Link>
            {isLoggedIn && (
              <>
                <Link href="/notifications" className="block py-2 hover:text-green-600">
                  Notifications {notificationCount > 0 && `(${notificationCount})`}
                </Link>
                <Link href="/profile" className="block py-2 hover:text-green-600">
                  Profile
                </Link>
                <Button 
                  variant="ghost" 
                  onClick={onLogout} 
                  className="w-full justify-start text-red-600 hover:text-red-700"
                >
                  Log Out
                </Button>
              </>
            )}
            {!isLoggedIn && (
              <Link href="/auth">
                <Button className="w-full">Log In or Sign Up</Button>
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
