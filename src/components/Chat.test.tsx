import React from 'react';
import { render, screen } from '@testing-library/react';
import Chat from './Chat';
import { User } from '../types';

const CHAT_HISTORY_STORAGE_PREFIX = 'dn.chat.history.v1';

describe('Chat', () => {
  beforeAll(() => {
    // JSDOM doesn't implement this; Chat uses it to auto-scroll.
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      value: jest.fn(),
      writable: true,
    });
  });

  beforeEach(() => {
    localStorage.clear();
  });

  test('loads persisted conversation when returning to chat view', () => {
    const user = {
      id: 'u1',
      name: 'Alice Smith',
      age: 30,
      height: { feet: 5, inches: 7 },
      weight: 150,
      gender: 'female',
      activityLevel: 'lightly_active',
      targetWeight: 140,
      targetDate: new Date('2030-01-01'),
      dailyCalorieTarget: 2000,
      dailyDeficitTarget: 500,
    } satisfies User;

    localStorage.setItem('user', JSON.stringify({ id: user.id }));
    localStorage.setItem(
      `${CHAT_HISTORY_STORAGE_PREFIX}:${user.id}`,
      JSON.stringify({
        v: 1,
        messages: [
          {
            id: 'm1',
            text: 'Persisted message',
            sender: 'user',
            timestamp: new Date('2025-01-01T12:00:00.000Z').toISOString(),
            type: 'general',
          },
        ],
      })
    );

    render(<Chat user={user} />);

    expect(screen.getByText('Persisted message')).toBeInTheDocument();
    expect(screen.queryByText(/tell me what you ate/i)).not.toBeInTheDocument();
  });

  test('renders assistant markdown formatting', () => {
    const user = {
      id: 'u1',
      name: 'Alice Smith',
      age: 30,
      height: { feet: 5, inches: 7 },
      weight: 150,
      gender: 'female',
      activityLevel: 'lightly_active',
      targetWeight: 140,
      targetDate: new Date('2030-01-01'),
      dailyCalorieTarget: 2000,
      dailyDeficitTarget: 500,
    } satisfies User;

    localStorage.setItem('user', JSON.stringify({ id: user.id }));
    localStorage.setItem(
      `${CHAT_HISTORY_STORAGE_PREFIX}:${user.id}`,
      JSON.stringify({
        v: 1,
        messages: [
          {
            id: 'm1',
            text: 'Got it - **Meal:** Breakfast - **Item:** 1 medium apple',
            sender: 'ai',
            timestamp: new Date('2025-01-01T12:00:00.000Z').toISOString(),
            type: 'general',
          },
        ],
      })
    );

    const { container } = render(<Chat user={user} />);

    const strong = screen.getByText('Meal:');
    expect(strong.tagName).toBe('STRONG');
    expect(container.querySelector('ul')).toBeTruthy();
  });
});
