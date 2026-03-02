import React from 'react';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Profile from './Profile';
import { apiService } from '../services/api';
import { User } from '../types';

describe('Profile weight check-in', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  test('creates today weight log and updates progress/history', async () => {
    const user = {
      id: 'u1',
      name: 'Alice Smith',
      age: 30,
      height: { feet: 5, inches: 7 },
      weight: 160,
      gender: 'female',
      activityLevel: 'lightly_active',
      targetWeight: 150,
      targetDate: new Date('2030-01-01'),
      dailyCalorieTarget: 2000,
      dailyDeficitTarget: 500,
    } satisfies User;

    jest.spyOn(apiService, 'getWeightLogs').mockResolvedValueOnce([]);
    const createSpy = jest
      .spyOn(apiService, 'createWeightLog')
      .mockImplementationOnce(async (payload) => ({ id: 'wl1', ...payload }));

    render(
      <MemoryRouter>
        <Profile user={user} onUserUpdate={jest.fn()} onSignOut={jest.fn()} />
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: user.name })).toBeInTheDocument();
    expect(screen.getByText('0.0%')).toBeInTheDocument();

    const weightInput = screen.getByLabelText(/today.*weight/i);
    await userEvent.clear(weightInput);
    await userEvent.type(weightInput, '158');
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /check in/i }));
    });

    expect(await screen.findByText(/saved today’s check-in/i)).toBeInTheDocument();

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: user.id,
        weight: 158,
        date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      })
    );

    expect(await screen.findByText('20.0%')).toBeInTheDocument();
    const currentWeightBox = screen.getByText(/current weight/i).parentElement as HTMLElement;
    expect(within(currentWeightBox).getByText(/158/)).toBeInTheDocument();
  });
});
