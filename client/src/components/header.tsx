import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";
import { getAuthState, clearAuthState } from "@/lib/auth";
import { useState, useEffect } from "react";
import { User } from "@shared/schema";
import logoImage from "@assets/groove-garden-logo.jpeg";
import { queryClient } from "@/lib/queryClient";

interface HeaderProps {
  onLogout?: () => void;
}

export function Header({ onLogout }: HeaderProps) {
  const [location, setLocation] = useLocation();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const { user: authUser } = getAuthState();
    setUser(authUser);
  }, [location]);

  const handleLogout = () => {
    clearAuthState();
    queryClient.clear(); // Clear all cached data to prevent cross-user data exposure
    setUser(null);
    onLogout?.();
    setLocation("/login");
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(part => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const isActive = (path: string) => {
    return location === path;
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <img 
                src={logoImage} 
                alt="Groove Garden Studios" 
                className="h-10 w-10 rounded-full object-cover"
              />
              <h1 className="text-sm sm:text-lg font-bold text-music-purple">Groove Garden Studios</h1>
            </div>
            {user && (
              <nav className="hidden md:flex space-x-8 ml-8">
                <Link
                  href="/"
                  className={`transition-colors ${
                    isActive("/")
                      ? "text-music-purple font-medium border-b-2 border-music-purple pb-1"
                      : "text-gray-600 hover:text-music-purple"
                  }`}
                >
                  Book Now
                </Link>
                <Link
                  href="/bookings"
                  className={`transition-colors ${
                    isActive("/bookings")
                      ? "text-music-purple font-medium border-b-2 border-music-purple pb-1"
                      : "text-gray-600 hover:text-music-purple"
                  }`}
                >
                  My Bookings
                </Link>
                {(user.email === "groovegardenltd@gmail.com" || user.email === "tomearl1508@gmail.com") && (
                  <Link
                    href="/admin"
                    className={`transition-colors ${
                      isActive("/admin")
                        ? "text-music-purple font-medium border-b-2 border-music-purple pb-1"
                        : "text-gray-600 hover:text-music-purple"
                    }`}
                  >
                    Admin
                  </Link>
                )}
              </nav>
            )}
          </div>
          <div className="flex items-center space-x-4">
            {user ? (
              <>
                <Button variant="ghost" size="sm" className="text-gray-600 hover:text-music-purple">
                  <Bell className="h-5 w-5" />
                </Button>
                <div className="flex items-center space-x-3">
                  <span className="text-sm text-gray-700">{user.name}</span>
                  <div className="w-8 h-8 bg-music-indigo rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-medium">
                      {getInitials(user.name)}
                    </span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleLogout}
                    className="text-gray-600 hover:text-music-purple"
                  >
                    Logout
                  </Button>
                </div>
              </>
            ) : (
              <Link href="/login">
                <Button className="bg-music-purple hover:bg-music-purple/90">
                  Login
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
