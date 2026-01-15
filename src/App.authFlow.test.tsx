import React from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('./components/Layout', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="layout">{children}</div>,
}));

jest.mock('./components/Dashboard', () => ({
  __esModule: true,
  default: ({ user }: any) => (
    <div data-testid="dashboard">{user?.targetDate instanceof Date ? 'targetDate:Date' : 'targetDate:notDate'}</div>
  ),
}));

jest.mock('./components/Log', () => ({ __esModule: true, default: () => <div>Log stub</div> }));
jest.mock('./components/Chat', () => ({ __esModule: true, default: () => <div>Chat stub</div> }));
jest.mock('./components/Profile', () => ({ __esModule: true, default: () => <div>Profile stub</div> }));
jest.mock('./components/Setup', () => ({ __esModule: true, default: () => <div>Setup stub</div> }));
jest.mock('./components/SignIn', () => ({ __esModule: true, default: () => <div>SignIn stub</div> }));
jest.mock('./components/About', () => ({ __esModule: true, default: () => <div>About stub</div> }));

import App from './App';
import { apiService } from './services/api';

describe('App auth/setup flow', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
    window.history.pushState({}, 'Test', '/');
  });

  test('renders SignIn when no access token is present', async () => {
    render(<App />);
    expect(await screen.findByText('SignIn stub')).toBeInTheDocument();
  });

  test('renders Setup when token exists but no stored user', async () => {
    localStorage.setItem('dn_access_token', 'tok');
    render(<App />);
    expect(await screen.findByText('Setup stub')).toBeInTheDocument();
  });

  test('revives stored user and sets API auth token', async () => {
    const spy = jest.spyOn(apiService, 'setAuthToken');
    localStorage.setItem('dn_access_token', 'tok');
    localStorage.setItem(
      'user',
      JSON.stringify({
        id: 'u1',
        name: 'Alice Smith',
        age: 30,
        height: { feet: 5, inches: 7 },
        weight: 150,
        gender: 'female',
        activityLevel: 'lightly_active',
        targetWeight: 140,
        targetDate: '2030-01-01T00:00:00.000Z',
        dailyCalorieTarget: 2000,
        dailyDeficitTarget: 500,
      })
    );

    render(<App />);
    expect(await screen.findByTestId('dashboard')).toHaveTextContent('targetDate:Date');
    expect(spy).toHaveBeenCalledWith('tok');
  });

  test('falls back to Setup when stored user is corrupted', async () => {
    localStorage.setItem('dn_access_token', 'tok');
    localStorage.setItem('user', '{broken');
    render(<App />);
    expect(await screen.findByText('Setup stub')).toBeInTheDocument();
  });
});

