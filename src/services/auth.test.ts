import { authService } from './auth';

type MockFetchResponse = {
  ok: boolean;
  status: number;
  statusText: string;
  json: () => Promise<any>;
  text: () => Promise<string>;
};

const mockFetchResponse = (overrides: Partial<MockFetchResponse>): MockFetchResponse => ({
  ok: true,
  status: 200,
  statusText: 'OK',
  json: async () => ({}),
  text: async () => '',
  ...overrides,
});

describe('authService', () => {
  beforeEach(() => {
    localStorage.clear();
    (global as any).fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('setToken/getToken stores token in localStorage', () => {
    expect(authService.getToken()).toBeNull();
    authService.setToken('t1');
    expect(authService.getToken()).toBe('t1');
    authService.setToken(null);
    expect(authService.getToken()).toBeNull();
  });

  test('getUserIdFromToken returns null for non-JWT-like token', () => {
    expect(authService.getUserIdFromToken('not-a-jwt')).toBeNull();
  });

  test('getUserIdFromToken returns numeric id when sub is numeric string', () => {
    const payload = (globalThis as any).btoa?.(JSON.stringify({ sub: '123' })) ?? Buffer.from(JSON.stringify({ sub: '123' })).toString('base64');
    const token = `header.${payload}.sig`;
    expect(authService.getUserIdFromToken(token)).toBe(123);
  });

  test('getUserIdFromToken returns string id when sub is non-numeric', () => {
    const payload = (globalThis as any).btoa?.(JSON.stringify({ sub: 'user-abc' })) ?? Buffer.from(JSON.stringify({ sub: 'user-abc' })).toString('base64');
    const token = `header.${payload}.sig`;
    expect(authService.getUserIdFromToken(token)).toBe('user-abc');
  });

  test('login normalizes backend response fields', async () => {
    const fetchMock = global.fetch as unknown as jest.Mock;
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse({
        json: async () => ({
          token: 'tok123',
          token_type: 'bearer',
          user: { id: 'u1', email: 'u1@example.com' },
        }),
      })
    );

    const result = await authService.login('u1@example.com', 'pw');
    expect(result.access_token).toBe('tok123');
    expect(result.token_type).toBe('bearer');
    expect(result.user?.id).toBe('u1');
  });

  test('login throws a helpful error on network/CORS failure', async () => {
    const fetchMock = global.fetch as unknown as jest.Mock;
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(authService.login('u1@example.com', 'pw')).rejects.toThrow(
      /network or cors error/i
    );
  });

  test('signup throws on non-2xx responses with status and body', async () => {
    const fetchMock = global.fetch as unknown as jest.Mock;
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => 'Email already registered',
      })
    );

    await expect(authService.signup({ email: 'x', password: 'y' })).rejects.toThrow(
      /signup failed: 400 bad request/i
    );
  });
});

