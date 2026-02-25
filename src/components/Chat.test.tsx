import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Chat from './Chat';
import { User } from '../types';
import { apiService } from '../services/api';
import * as hapticsService from '../services/haptics';

const CHAT_HISTORY_STORAGE_PREFIX = 'dn.chat.history.v1';

describe('Chat', () => {
  let triggerSubmitHapticSpy: jest.SpyInstance<Promise<void>, []>;
  let triggerSuccessHapticSpy: jest.SpyInstance<Promise<void>, []>;

  beforeAll(() => {
    // JSDOM doesn't implement this; Chat uses it to auto-scroll.
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      value: jest.fn(),
      writable: true,
    });
  });

  beforeEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
    triggerSubmitHapticSpy = jest
      .spyOn(hapticsService, 'triggerSubmitHaptic')
      .mockResolvedValue(undefined);
    triggerSuccessHapticSpy = jest
      .spyOn(hapticsService, 'triggerSuccessHaptic')
      .mockResolvedValue(undefined);
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

  test('sends a message and renders assistant reply', async () => {
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
    const chatSpy = jest
      .spyOn(apiService, 'chat')
      .mockResolvedValueOnce({ reply: 'All set!', created_meal_logs: [], created_planned_meals: [] } as any);

    render(<Chat user={user} />);

    const input = screen.getByPlaceholderText(/log what you ate/i);
    await userEvent.type(input, 'I had oatmeal');
    await userEvent.click(screen.getByRole('button', { name: /send message/i }));

    expect(chatSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'I had oatmeal',
        user_id: user.id,
        history: expect.any(Array),
      })
    );
    expect(await screen.findByText('All set!')).toBeInTheDocument();
    expect(triggerSubmitHapticSpy).toHaveBeenCalledTimes(1);
    expect(triggerSuccessHapticSpy).toHaveBeenCalledTimes(1);
  });

  test('fires success haptic when a meal log is created', async () => {
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
    jest.spyOn(apiService, 'chat').mockResolvedValueOnce({
      reply: 'Nice work logging that meal.',
      created_meal_logs: [
        {
          id: 'm1',
          user_id: user.id,
          date: '2026-02-23',
          user_description: 'I had oatmeal',
        },
      ],
      created_planned_meals: [],
    } as any);

    render(<Chat user={user} />);

    const input = screen.getByPlaceholderText(/log what you ate/i);
    await userEvent.type(input, 'I had oatmeal');
    await userEvent.click(screen.getByRole('button', { name: /send message/i }));

    expect(await screen.findByText(/nice work logging that meal/i)).toBeInTheDocument();
    expect(triggerSubmitHapticSpy).toHaveBeenCalledTimes(1);
    expect(triggerSuccessHapticSpy).toHaveBeenCalledTimes(1);
  });

  test('renders an error reply when API call fails', async () => {
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
    jest.spyOn(apiService, 'chat').mockRejectedValueOnce(new Error('Boom'));

    render(<Chat user={user} />);

    const input = screen.getByPlaceholderText(/log what you ate/i);
    await userEvent.type(input, 'I had oatmeal');
    await userEvent.click(screen.getByRole('button', { name: /send message/i }));

    expect(await screen.findByText(/couldn’t get a reply right now/i)).toBeInTheDocument();
    expect(triggerSubmitHapticSpy).toHaveBeenCalledTimes(1);
    expect(triggerSuccessHapticSpy).not.toHaveBeenCalled();
  });
});
