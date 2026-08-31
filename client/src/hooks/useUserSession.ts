import { useState, useEffect } from 'react';

interface UserSession {
  email: string;
  id: string;
  isAuthenticated: boolean;
  name?: string;
}

export function useUserSession() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session in localStorage
    const savedSession = localStorage.getItem('coinrailz_user_session');
    if (savedSession) {
      try {
        const parsedSession = JSON.parse(savedSession);
        setSession(parsedSession);
      } catch (error) {
        console.error('Failed to parse saved session:', error);
        localStorage.removeItem('coinrailz_user_session');
      }
    }
    setIsLoading(false);
  }, []);

  const login = (userEmail: string, userId: string) => {
    const newSession: UserSession = {
      email: userEmail,
      id: userId,
      isAuthenticated: true
    };
    setSession(newSession);
    localStorage.setItem('coinrailz_user_session', JSON.stringify(newSession));
  };

  const logout = () => {
    setSession(null);
    localStorage.removeItem('coinrailz_user_session');
  };

  const switchUser = (userEmail: string, userId: string) => {
    login(userEmail, userId);
  };

  return {
    session,
    isLoading,
    login,
    logout,
    switchUser,
    isAuthenticated: !!session?.isAuthenticated
  };
}