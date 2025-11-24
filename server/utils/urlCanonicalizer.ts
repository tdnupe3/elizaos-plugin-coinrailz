/**
 * URL CANONICALIZER UTILITY
 * 
 * Shared normalization logic for discovered agent URLs
 * Ensures consistent canonical form across all insertion paths
 * 
 * Used by:
 * - Discovery adapters (X402Bazaar, A2A, ENS, Discord, etc.)
 * - XMTP scanner service
 * - Database cleanup service
 * - Storage layer helpers
 */

/**
 * Normalize URL to canonical form for duplicate detection
 * 
 * Transformations applied:
 * - Force HTTPS protocol
 * - Remove www prefix
 * - Lowercase hostname
 * - Remove trailing slash
 * - Remove query parameters
 * - Remove URL fragments
 * - Trim whitespace
 * 
 * Returns null for invalid URLs (logs warning)
 * 
 * @param url - Raw URL string to normalize
 * @returns Canonical URL string or null if invalid
 * 
 * @example
 * normalizeURL('HTTP://WWW.Example.COM/path/?foo=bar#section')
 * // Returns: 'https://example.com/path'
 * 
 * normalizeURL('invalid-url')
 * // Returns: null (logs warning)
 */
export function normalizeURL(url: string | null | undefined): string | null {
  // Validate input
  if (!url || typeof url !== 'string') {
    return null;
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }

  try {
    // Attempt to parse as URL
    let urlObj: URL;
    
    try {
      urlObj = new URL(trimmed);
    } catch {
      // If parsing fails, try adding https:// prefix
      if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
        try {
          urlObj = new URL('https://' + trimmed);
        } catch {
          console.warn(`⚠️ Invalid URL cannot be normalized: ${trimmed}`);
          return null;
        }
      } else {
        console.warn(`⚠️ Invalid URL cannot be normalized: ${trimmed}`);
        return null;
      }
    }

    // Force HTTPS protocol (security best practice)
    urlObj.protocol = 'https:';

    // Normalize hostname (lowercase, remove www)
    let hostname = urlObj.hostname.toLowerCase();
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4);
    }
    
    // Validate hostname has at least one dot
    if (!hostname.includes('.')) {
      console.warn(`⚠️ Invalid hostname (no TLD): ${hostname}`);
      return null;
    }
    
    urlObj.hostname = hostname;

    // Normalize pathname (remove trailing slash unless root)
    let pathname = urlObj.pathname;
    if (pathname.endsWith('/') && pathname !== '/') {
      pathname = pathname.slice(0, -1);
    }
    urlObj.pathname = pathname;

    // Remove query parameters and fragments
    urlObj.search = '';
    urlObj.hash = '';

    const canonical = urlObj.toString();
    
    // Final validation: ensure result is not empty
    if (!canonical || canonical === 'https://') {
      console.warn(`⚠️ Normalization resulted in empty URL: ${trimmed}`);
      return null;
    }

    return canonical;

  } catch (error) {
    // Catch-all for any unexpected errors
    console.warn(`⚠️ URL normalization error for "${trimmed}":`, error);
    return null;
  }
}

/**
 * Extract domain from URL (for agent-card.json fetching)
 * 
 * @param url - URL string
 * @returns Domain/hostname or null if invalid
 */
export function extractDomain(url: string | null | undefined): string | null {
  if (!url) return null;

  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    // If URL is already just a domain (no protocol)
    const trimmed = url.trim();
    if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmed)) {
      return trimmed.toLowerCase();
    }
    return null;
  }
}

/**
 * Validate if a string is a valid URL
 * 
 * @param url - String to validate
 * @returns true if valid URL format
 */
export function isValidURL(url: string | null | undefined): boolean {
  return normalizeURL(url) !== null;
}
