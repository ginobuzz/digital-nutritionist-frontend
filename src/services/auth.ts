import { API_BASE_URL } from './config';

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user?: { id: string | number; email?: string };
}

export interface SignupResponse {
  access_token?: string;
  token_type?: string;
  // Fallback fields in case backend returns user object instead of token
  id?: string;
  email?: string;
}

export interface PasswordResetRequestResponse {
  detail?: string;
}

export interface PasswordResetConfirmResponse {
  detail?: string;
}

export interface EmailAvailabilityResponse {
  available: boolean;
}

const TOKEN_KEY = 'dn_access_token';

const readErrorDetail = async (res: Response): Promise<string> => {
  const text = await res.text().catch(() => '');
  if (!text) return '';
  try {
    const parsed = JSON.parse(text) as any;
    const detail = parsed?.detail;
    return typeof detail === 'string' ? detail : text;
  } catch {
    return text;
  }
};

export const authService = {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },
  setToken(token: string | null) {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  },
  getUserIdFromToken(token: string): string | number | null {
    try {
      // Our backend may return a non-JWT token (e.g., itsdangerous). In that case,
      // there will be no "." segments and we cannot decode a user id from it.
      if (typeof token !== 'string' || !token.includes('.')) return null;
      const [, payload] = token.split('.');
      if (!payload) return null;
      const json = JSON.parse(atob(payload));
      const sub = json?.sub;
      if (typeof sub === 'number') return sub;
      if (typeof sub === 'string') {
        // Return numeric if string is numeric, else return string
        const asNum = Number(sub);
        return Number.isNaN(asNum) ? sub : asNum;
      }
      return null;
    } catch {
      return null;
    }
  },
  async login(email: string, password: string): Promise<LoginResponse> {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ email, password }),
        mode: 'cors',
        credentials: 'omit',
      });
      if (!res.ok) {
        const detail = await readErrorDetail(res);
        if (res.status === 401 || res.status === 403) {
          throw new Error('That email or password didn’t match. Try again, or reset your password.');
        }
        if (res.status === 429) {
          throw new Error('Too many sign-in attempts. Please wait a moment and try again.');
        }
        if (/expired/i.test(detail)) {
          throw new Error('Your session expired. Please sign in again.');
        }
        throw new Error('We couldn’t sign you in. Please try again.');
      }
      const data = await res.json();
      // Normalize backend response (which currently returns { token, ...user fields })
      const normalized: LoginResponse = {
        access_token: data.access_token ?? data.token,
        token_type: data.token_type ?? 'bearer',
        user: data.user
          ? { id: data.user.id, email: data.user.email }
          : (typeof data.id !== 'undefined' ? { id: data.id, email: data.email } : undefined),
      };
      return normalized;
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error('We couldn’t reach the server. Check your internet connection and try again.');
      }
      // Always throw proper Error instances for linter and reliability
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('We couldn’t sign you in. Please try again.');
    }
  },
  async signup(payload: any): Promise<SignupResponse> {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload),
        mode: 'cors',
        credentials: 'omit',
      });
      if (!res.ok) {
        const detail = await readErrorDetail(res);
        if (res.status === 400 && /email already registered/i.test(detail)) {
          throw new Error('That email is already in use. Try signing in instead.');
        }
        if (res.status === 400 && /password/i.test(detail) && detail.trim()) {
          throw new Error(detail.trim());
        }
        if (res.status === 422) {
          throw new Error('Please double-check your details and try again.');
        }
        if (res.status === 429) {
          throw new Error('Too many attempts. Please wait a moment and try again.');
        }
        throw new Error('We couldn’t create your account. Please try again.');
      }
      const data = await res.json();
      // Provide fallback fields so callers can pull user id directly
      return {
        access_token: data.access_token ?? data.token,
        token_type: data.token_type ?? 'bearer',
        id: data.user?.id ?? data.id,
        email: data.user?.email ?? data.email,
      };
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error('We couldn’t reach the server. Check your internet connection and try again.');
      }
      // Always throw proper Error instances for linter and reliability
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('We couldn’t create your account. Please try again.');
    }
  },
  async checkEmailAvailability(email: string): Promise<EmailAvailabilityResponse> {
    try {
      const qs = new URLSearchParams({ email });
      const res = await fetch(`${API_BASE_URL}/auth/email-available?${qs.toString()}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        mode: 'cors',
        credentials: 'omit',
      });
      if (!res.ok) {
        if (res.status === 429) {
          throw new Error('Please wait a moment, then try checking that email again.');
        }
        throw new Error('We couldn’t check that email right now. Please try again.');
      }
      const data = await res.json().catch(() => ({}));
      return { available: Boolean((data as any).available) };
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error('We couldn’t reach the server. Check your internet connection and try again.');
      }
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('We couldn’t check that email right now. Please try again.');
    }
  },
  logout() {
    this.setToken(null);
  },
  async requestPasswordReset(email: string): Promise<PasswordResetRequestResponse> {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/password-reset/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ email }),
        mode: 'cors',
        credentials: 'omit',
      });
      if (!res.ok) {
        if (res.status === 429) {
          throw new Error('Too many reset requests. Please wait a moment and try again.');
        }
        throw new Error('We couldn’t send the reset link. Please try again.');
      }
      const data = await res.json().catch(() => ({}));
      return data;
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error('We couldn’t reach the server. Check your internet connection and try again.');
      }
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('We couldn’t send the reset link. Please try again.');
    }
  },
  async resetPassword(token: string, new_password: string): Promise<PasswordResetConfirmResponse> {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/password-reset/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ token, new_password }),
        mode: 'cors',
        credentials: 'omit',
      });
      if (!res.ok) {
        const detail = await readErrorDetail(res);
        if (/token/i.test(detail) || /expired/i.test(detail)) {
          throw new Error('That reset link is expired or invalid. Please request a new one.');
        }
        if (res.status === 400 && /password/i.test(detail) && detail.trim()) {
          throw new Error(detail.trim());
        }
        if (res.status === 422) {
          throw new Error('Please choose a new password and try again.');
        }
        throw new Error('We couldn’t update your password. Please try again.');
      }
      const data = await res.json().catch(() => ({}));
      return data;
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error('We couldn’t reach the server. Check your internet connection and try again.');
      }
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('We couldn’t update your password. Please try again.');
    }
  },
};
