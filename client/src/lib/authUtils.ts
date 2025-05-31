export function isUnauthorizedError(error: Error): boolean {
  return /^401: .*Unauthorized/.test(error.message);
}

export function handleAuthError(error: Error): boolean {
  if (isUnauthorizedError(error)) {
    // Clear any cached user data
    localStorage.removeItem('user');
    return true;
  }
  return false;
}

export function getStoredUser() {
  try {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function storeUser(user: any) {
  try {
    localStorage.setItem('user', JSON.stringify(user));
  } catch {
    // Ignore storage errors
  }
}

export function clearStoredUser() {
  try {
    localStorage.removeItem('user');
  } catch {
    // Ignore storage errors
  }
}