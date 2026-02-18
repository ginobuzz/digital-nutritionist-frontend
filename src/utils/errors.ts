export type UserFacingErrorOptions = {
  action?: string;
  fallback?: string;
};

const getRawErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message || '';
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

const isLikelyNetworkError = (error: unknown, rawMessage: string): boolean => {
  const lower = rawMessage.toLowerCase();
  if (error instanceof TypeError) {
    return (
      lower.includes('failed to fetch') ||
      lower.includes('networkerror') ||
      lower.includes('load failed') ||
      lower.includes('network request failed') ||
      (lower.includes('fetch') && lower.includes('failed')) ||
      (lower.includes('fetch') && lower.includes('network'))
    );
  }
  return (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('load failed') ||
    lower.includes('network request failed') ||
    (lower.includes('fetch') && lower.includes('network'))
  );
};

const looksLikeSessionExpired = (rawMessage: string): boolean => {
  const lower = rawMessage.toLowerCase();
  return lower.includes('token expired') || (lower.includes('expired') && lower.includes('token'));
};

const looksLikeUnauthorized = (rawMessage: string): boolean => {
  const lower = rawMessage.toLowerCase();
  return (
    lower.includes('not authenticated') ||
    lower.includes('invalid token') ||
    lower.includes('unauthorized') ||
    lower.includes('forbidden')
  );
};

const looksLikeEmailInUse = (rawMessage: string): boolean => {
  const lower = rawMessage.toLowerCase();
  return (
    lower.includes('email already registered') ||
    lower.includes('email already used') ||
    lower.includes('email is already used') ||
    (lower.includes('already in use') && lower.includes('email'))
  );
};

const looksLikeInvalidResetLink = (rawMessage: string): boolean => {
  const lower = rawMessage.toLowerCase();
  return (
    (lower.includes('reset') && lower.includes('token')) ||
    (lower.includes('reset') && lower.includes('expired')) ||
    (lower.includes('invalid') && lower.includes('token'))
  );
};

const looksTechnical = (rawMessage: string): boolean => {
  const lower = rawMessage.toLowerCase();
  return (
    lower.includes('api request') ||
    lower.includes('cors') ||
    lower.includes('openai_api_key') ||
    lower.includes('token') ||
    lower.includes('syntaxerror') ||
    lower.includes('referenceerror') ||
    lower.includes('unexpected token') ||
    lower.includes('cannot read') ||
    lower.includes('is not a function') ||
    lower.includes('undefined') ||
    lower.includes('null') ||
    lower.includes('jwt') ||
    lower.includes('bearer ') ||
    lower.includes('traceback') ||
    lower.includes('stack') ||
    lower.includes('unprocessable entity') ||
    lower.includes('internal server error') ||
    lower.includes('bad request') ||
    lower.includes('gateway') ||
    lower.includes('non-json response')
  );
};

const looksUnhelpful = (rawMessage: string): boolean => {
  const trimmed = rawMessage.trim();
  if (!trimmed) return true;
  const lower = trimmed.toLowerCase();
  if (lower === 'error' || lower === 'failed' || lower === 'forbidden' || lower === 'unauthorized') return true;
  // Single-word / code-like errors rarely help end users.
  if (!trimmed.includes(' ') && trimmed.length < 24) return true;
  return false;
};

export const getUserFacingErrorMessage = (error: unknown, options: UserFacingErrorOptions = {}): string => {
  const rawMessage = getRawErrorMessage(error).trim();
  const action = options.action?.trim();
  const genericFallback = options.fallback?.trim()
    || (action ? `We couldn’t ${action}. Please try again.` : 'We couldn’t complete that. Please try again.');

  if (looksLikeSessionExpired(rawMessage)) {
    return 'Your session expired. Please sign in again.';
  }

  if (looksLikeEmailInUse(rawMessage)) {
    return 'That email is already in use. Try signing in instead.';
  }

  if (looksLikeInvalidResetLink(rawMessage)) {
    return 'That reset link is expired or invalid. Please request a new one.';
  }

  if (isLikelyNetworkError(error, rawMessage)) {
    return action
      ? `We couldn’t ${action}. Check your internet connection and try again.`
      : 'We couldn’t reach the server. Check your internet connection and try again.';
  }

  if (looksLikeUnauthorized(rawMessage)) {
    return 'Please sign in again to continue.';
  }

  if (!rawMessage || looksTechnical(rawMessage)) {
    return genericFallback;
  }

  if (looksUnhelpful(rawMessage)) {
    return genericFallback;
  }

  return rawMessage;
};

export const formatVoiceInputError = (code: string): string => {
  if (code === 'unsupported') {
    return 'Voice input isn’t available in this browser. You can type instead.';
  }

  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone access is blocked. Allow it in your browser settings and try again.';
    case 'no-speech':
      return 'I didn’t catch anything. Try again, or type instead.';
    case 'audio-capture':
      return 'No microphone found. Connect one (or try a different device) and try again.';
    case 'network':
      return 'Voice input couldn’t connect right now. Check your connection and try again (or type instead).';
    case 'language-not-supported':
      return 'Voice input isn’t available for this language. Try typing instead.';
    default:
      return 'We couldn’t use voice input right now. Please try again or type instead.';
  }
};

export const isEmailInUseError = (error: unknown): boolean => looksLikeEmailInUse(getRawErrorMessage(error));
