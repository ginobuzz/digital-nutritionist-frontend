import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Log from './components/Log';
import Chat from './components/Chat';
import Profile from './components/Profile';
import Setup from './components/Setup';
import ApiTest from './components/ApiTest';
import SignIn from './components/SignIn';
import { User } from './types';
import { calculateDailyExpenditure } from './utils/calculations';
import { apiService } from './services/api';
import theme from './theme';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [setupComplete, setSetupComplete] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('dn_access_token');
    const storedUser = localStorage.getItem('user');
    if (token) {
      apiService.setAuthToken(token);
    }
    if (storedUser) {
      try {
        const raw = JSON.parse(storedUser);
        // Revive date-like fields
        if (raw && raw.targetDate && typeof raw.targetDate === 'string') {
          raw.targetDate = new Date(raw.targetDate);
        }
        setUser(raw);
      } catch {
        setUser(null);
      }
      setSetupComplete(true);
    } else {
      setSetupComplete(false);
    }
  }, []);

  const handleSetupComplete = (setupUser: User) => {
    // Calculate daily calorie target and deficit
    const dailyExpenditure = calculateDailyExpenditure(setupUser);
    const weightToLose = setupUser.weight - setupUser.targetWeight;
    const daysToTarget = Math.ceil((setupUser.targetDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    const dailyDeficitTarget = Math.round(weightToLose * 3500 / daysToTarget); // 3500 calories = 1 lb

    const completeUser: User = {
      ...setupUser,
      dailyCalorieTarget: dailyExpenditure - dailyDeficitTarget,
      dailyDeficitTarget: dailyDeficitTarget,
    };

    setUser(completeUser);
    setSetupComplete(true);
    
    // In a real app, you would save this to localStorage or send to API
    localStorage.setItem('user', JSON.stringify(completeUser));
    localStorage.setItem('setupComplete', 'true');
  };

  // Check if we're on the API test route - if so, show it regardless of setup status
  // This allows testing the API during development
  if (window.location.pathname === '/api-test') {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <ApiTest />
      </ThemeProvider>
    );
  }

  // If not authenticated, show unauthenticated router with SignIn and Setup
  if (!localStorage.getItem('dn_access_token')) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Router>
          <Routes>
            <Route
              path="/signin"
              element={
                <SignIn onSignedIn={(me: User) => {
                  setUser(me);
                  setSetupComplete(true);
                }} />
              }
            />
            <Route path="/setup" element={<Setup onComplete={handleSetupComplete} />} />
            <Route path="/" element={<Navigate to="/signin" replace />} />
            <Route path="*" element={<Navigate to="/signin" replace />} />
          </Routes>
        </Router>
      </ThemeProvider>
    );
  }

  // If signed-in but setup not complete, show setup flow
  if (!setupComplete) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Router>
          <Routes>
            <Route path="/setup" element={<Setup onComplete={handleSetupComplete} />} />
            <Route path="*" element={<Navigate to="/setup" replace />} />
          </Routes>
        </Router>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Layout user={user!}>
          <Routes>
            <Route path="/" element={<Dashboard user={user!} />} />
            <Route path="/setup" element={<Navigate to="/" replace />} />
            <Route path="/signin" element={<Navigate to="/" replace />} />
            <Route path="/log" element={<Log />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/profile" element={<Profile user={user!} onUserUpdate={setUser} />} />
            <Route path="/api-test" element={<ApiTest />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </Router>
    </ThemeProvider>
  );
}

export default App;
