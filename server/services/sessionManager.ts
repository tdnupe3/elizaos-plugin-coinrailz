import { storage } from '../storage.js';

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

const sessionCache = new Map<string, { userId: string; userEmail: string; createdAt: number }>();

export { sessionCache as sessionStore };

export function createSession(userId: string, userEmail: string): string {
  const sessionToken = `cr_session_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const createdAt = Date.now();

  sessionCache.set(sessionToken, { userId, userEmail, createdAt });

  persistSessionToDB(sessionToken, userId, userEmail, createdAt).catch((err) =>
    console.warn('Session DB persist failed (will use in-memory):', err.message)
  );

  return sessionToken;
}

export async function getSession(token: string): Promise<{ userId: string; userEmail: string; createdAt: number } | undefined> {
  const cached = sessionCache.get(token);
  if (cached) return cached;

  try {
    const dbSession = await loadSessionFromDB(token);
    if (dbSession) {
      sessionCache.set(token, dbSession);
      return dbSession;
    }
  } catch (err: any) {
    console.warn('Session DB lookup failed:', err.message);
  }
  return undefined;
}

export function getSessionSync(token: string): { userId: string; userEmail: string; createdAt: number } | undefined {
  return sessionCache.get(token);
}

export function deleteSession(token: string) {
  sessionCache.delete(token);
  deleteSessionFromDB(token).catch(() => {});
}

export async function isSessionValid(token: string): Promise<boolean> {
  const session = await getSession(token);
  if (!session) return false;

  const sessionAge = Date.now() - session.createdAt;
  if (sessionAge > SESSION_TTL_MS) {
    deleteSession(token);
    return false;
  }
  return true;
}

export function isSessionValidSync(token: string): boolean {
  const session = sessionCache.get(token);
  if (!session) return false;

  const sessionAge = Date.now() - session.createdAt;
  if (sessionAge > SESSION_TTL_MS) {
    sessionCache.delete(token);
    deleteSessionFromDB(token).catch(() => {});
    return false;
  }
  return true;
}

async function persistSessionToDB(token: string, userId: string, userEmail: string, createdAt: number) {
  const expiresAt = new Date(createdAt + SESSION_TTL_MS);
  try {
    await storage.createAuthSession({ token, userId, userEmail, expiresAt });
  } catch (err: any) {
    if (err.message?.includes('duplicate')) return;
    throw err;
  }
}

async function loadSessionFromDB(token: string): Promise<{ userId: string; userEmail: string; createdAt: number } | null> {
  try {
    const row = await storage.getAuthSessionByToken(token);
    if (!row) return null;
    const expiresAt = new Date(row.expiresAt).getTime();
    if (Date.now() > expiresAt) {
      deleteSessionFromDB(token).catch(() => {});
      return null;
    }
    return {
      userId: row.userId,
      userEmail: row.userEmail,
      createdAt: new Date(row.createdAt).getTime(),
    };
  } catch {
    return null;
  }
}

async function deleteSessionFromDB(token: string) {
  try {
    await storage.deleteAuthSession(token);
  } catch {}
}

export async function loadSessionsFromDB() {
  try {
    const sessions = await storage.getActiveAuthSessions();
    let loaded = 0;
    for (const row of sessions) {
      const expiresAt = new Date(row.expiresAt).getTime();
      if (Date.now() < expiresAt) {
        sessionCache.set(row.token, {
          userId: row.userId,
          userEmail: row.userEmail,
          createdAt: new Date(row.createdAt).getTime(),
        });
        loaded++;
      }
    }
    if (loaded > 0) {
      console.log(`✅ Restored ${loaded} active user sessions from database`);
    }
  } catch (err: any) {
    console.warn('Session restore from DB failed:', err.message);
  }
}

export async function cleanExpiredSessions() {
  try {
    await storage.deleteExpiredAuthSessions();
  } catch {}
}
