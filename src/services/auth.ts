const API_BASE_URL = 'https://sundaymornings-backend-297759956270.europe-west1.run.app';

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export interface SignupResponse {
  access_token?: string;
  token_type?: string;
  // Fallback fields in case backend returns user object instead of token
  id?: string;
  email?: string;
}

const TOKEN_KEY = 'dn_access_token';

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
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => '');
      throw new Error(`Login failed: ${res.status} ${res.statusText}${msg ? ` - ${msg}` : ''}`);
    }
    return res.json();
  },
  async signup(payload: any): Promise<SignupResponse> {
    const res = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => '');
      throw new Error(`Signup failed: ${res.status} ${res.statusText}${msg ? ` - ${msg}` : ''}`);
    }
    return res.json();
  },
  logout() {
    this.setToken(null);
  },
};


