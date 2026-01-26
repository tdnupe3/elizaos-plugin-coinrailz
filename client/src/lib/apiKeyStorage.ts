const API_KEY_STORAGE_KEY = 'coinrailz_api_key';
const API_KEY_PREFIX_STORAGE_KEY = 'coinrailz_api_key_prefix';

export interface StoredApiKey {
  apiKey: string;
  keyPrefix: string;
  createdAt: string;
  userId?: string;
}

export function storeApiKey(apiKey: string, keyPrefix: string, userId?: string): void {
  try {
    const data: StoredApiKey = {
      apiKey,
      keyPrefix,
      createdAt: new Date().toISOString(),
      userId
    };
    localStorage.setItem(API_KEY_STORAGE_KEY, JSON.stringify(data));
    console.log('🔑 API key stored for automatic use');
  } catch (error) {
    console.warn('Failed to store API key:', error);
  }
}

export function getStoredApiKey(): StoredApiKey | null {
  try {
    const stored = localStorage.getItem(API_KEY_STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function getApiKeyValue(): string | null {
  const stored = getStoredApiKey();
  return stored?.apiKey || null;
}

export function clearStoredApiKey(): void {
  try {
    localStorage.removeItem(API_KEY_STORAGE_KEY);
    console.log('🔑 API key cleared');
  } catch {
    // Ignore storage errors
  }
}

export function hasStoredApiKey(): boolean {
  return getStoredApiKey() !== null;
}
