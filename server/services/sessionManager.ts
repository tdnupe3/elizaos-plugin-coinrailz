// Shared session store for authentication
export const sessionStore = new Map<string, { userId: string; userEmail: string; createdAt: number }>();

// Add demo user for testing
sessionStore.set('demo-token', {
  userId: 'user_1752506974498_dbp5fwbql',
  userEmail: 'demo@example.com',
  createdAt: Date.now()
});

export function createSession(userId: string, userEmail: string): string {
  const sessionToken = `cr_session_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  sessionStore.set(sessionToken, {
    userId,
    userEmail,
    createdAt: Date.now()
  });
  return sessionToken;
}

export function getSession(token: string) {
  return sessionStore.get(token);
}

export function deleteSession(token: string) {
  sessionStore.delete(token);
}

export function isSessionValid(token: string): boolean {
  const session = sessionStore.get(token);
  if (!session) return false;
  
  // Check if session is too old (24 hours)
  const sessionAge = Date.now() - session.createdAt;
  if (sessionAge > 24 * 60 * 60 * 1000) {
    sessionStore.delete(token);
    return false;
  }
  
  return true;
}