const DEFAULT_API_BASE_URL = 'http://localhost:8000';

const isLocalhostHost = (hostname: string) =>
  hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';

const stripTrailingSlashes = (value: string) => value.replace(/\/+$/, '');

export const resolveApiBaseUrl = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) return DEFAULT_API_BASE_URL;

  const inSecureContext = typeof window !== 'undefined' && window.location?.protocol === 'https:';

  const coerceToUrl = (value: string): URL | null => {
    try {
      return new URL(value);
    } catch {
      return null;
    }
  };

  const parsed = coerceToUrl(trimmed) ?? coerceToUrl(`http://${trimmed}`);
  if (!parsed) return stripTrailingSlashes(trimmed);

  if (inSecureContext && parsed.protocol === 'http:' && !isLocalhostHost(parsed.hostname)) {
    parsed.protocol = 'https:';
  }

  return stripTrailingSlashes(parsed.toString());
};

export const API_BASE_URL = resolveApiBaseUrl(process.env.REACT_APP_API_BASE_URL || DEFAULT_API_BASE_URL);

