import { apiService } from './api';

type MockFetchResponse = {
  ok: boolean;
  status: number;
  statusText: string;
  text: () => Promise<string>;
};

const mockFetchResponse = (overrides: Partial<MockFetchResponse>): MockFetchResponse => ({
  ok: true,
  status: 200,
  statusText: 'OK',
  text: async () => '',
  ...overrides,
});

describe('apiService (request behavior)', () => {
  beforeEach(() => {
    (global as any).fetch = jest.fn();
    apiService.setAuthToken(null);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('includes Authorization header when token is set', async () => {
    const fetchMock = global.fetch as unknown as jest.Mock;
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse({
        text: async () => JSON.stringify({ id: 'u1' }),
      })
    );

    apiService.setAuthToken('abc123');
    await apiService.getUser('u1');

    const [, options] = fetchMock.mock.calls[0];
    expect((options.headers as any).Authorization).toBe('Bearer abc123');
  });

  test('returns empty array for GET /weight-logs 404', async () => {
    const fetchMock = global.fetch as unknown as jest.Mock;
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => JSON.stringify({ detail: 'Not found' }),
      })
    );

    await expect(apiService.getWeightLogs('u1')).resolves.toEqual([]);
  });

  test('returns void for 204 responses', async () => {
    const fetchMock = global.fetch as unknown as jest.Mock;
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse({
        status: 204,
        statusText: 'No Content',
      })
    );

    await expect(apiService.deleteUser('u1')).resolves.toBeUndefined();
  });

  test('formats FastAPI validation errors (422) into user-friendly message', async () => {
    const fetchMock = global.fetch as unknown as jest.Mock;
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse({
        ok: false,
        status: 422,
        statusText: 'Unprocessable Entity',
        text: async () =>
          JSON.stringify({
            detail: [
              {
                type: 'int_from_float',
                loc: ['body', 'daily_calorie_budget'],
                msg: 'Input should be a valid integer',
              },
            ],
          }),
      })
    );

    await expect(
      apiService.createUser({
        email: 'u@example.com',
        password: 'pw',
        first_name: 'U',
        last_name: 'X',
        age: 30,
        gender: 'male',
        activity_level: 'sedentary',
        daily_calorie_budget: 2000.5 as any,
      })
    ).rejects.toThrow(/daily calorie budget must be a whole number/i);
  });

  test('surfaces FastAPI error detail for non-422 responses', async () => {
    const fetchMock = global.fetch as unknown as jest.Mock;
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => JSON.stringify({ detail: 'Invalid token' }),
      })
    );

    await expect(apiService.getUser('u1')).rejects.toThrow(/401 unauthorized.*invalid token/i);
  });

  test('throws when response is ok but not JSON', async () => {
    const fetchMock = global.fetch as unknown as jest.Mock;
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => 'not json',
      })
    );

    await expect(apiService.getUser('u1')).rejects.toThrow(/returned non-json response/i);
  });
});

