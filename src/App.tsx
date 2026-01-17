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
import SignIn from './components/SignIn';
import About from './components/About';
import { User } from './types';
import { calculateDailyCalorieTarget, calculateDailyExpenditure } from './utils/calculations';
import { apiService } from './services/api';
import { authService } from './services/auth';
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
        setSetupComplete(true);
      } catch {
        setUser(null);
        setSetupComplete(false);
        localStorage.removeItem('user');
        localStorage.removeItem('setupComplete');
      }
    } else {
      setSetupComplete(false);
    }
  }, []);

  const handleSetupComplete = (setupUser: User) => {
    // Calculate daily calorie target and deficit
    const dailyExpenditure = calculateDailyExpenditure(setupUser);
    const weightToLose = setupUser.weight - setupUser.targetWeight;
    const daysToTarget = Math.ceil((setupUser.targetDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    const desiredDeficitTarget = Math.round(weightToLose * 3500 / daysToTarget); // 3500 calories = 1 lb
    const dailyCalorieTarget = calculateDailyCalorieTarget({
      ...setupUser,
      dailyDeficitTarget: desiredDeficitTarget,
      dailyCalorieTarget: 0,
    });
    const dailyDeficitTarget = Math.max(0, dailyExpenditure - dailyCalorieTarget);

    const completeUser: User = {
      ...setupUser,
      dailyCalorieTarget: dailyCalorieTarget,
      dailyDeficitTarget: dailyDeficitTarget,
    };

    setUser(completeUser);
    setSetupComplete(true);
    
    // In a real app, you would save this to localStorage or send to API
    localStorage.setItem('user', JSON.stringify(completeUser));
    localStorage.setItem('setupComplete', 'true');
  };

  const handleSignOut = () => {
    authService.logout();
    apiService.setAuthToken(null);
    localStorage.removeItem('user');
    localStorage.removeItem('setupComplete');
    setUser(null);
    setSetupComplete(false);
  };

  // If not authenticated, show unauthenticated router with SignIn and Setup
  if (!localStorage.getItem('dn_access_token')) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Router basename={process.env.PUBLIC_URL}>
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
            <Route path="/about" element={<About />} />
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
        <Router basename={process.env.PUBLIC_URL}>
          <Routes>
            <Route path="/setup" element={<Setup onComplete={handleSetupComplete} />} />
            <Route path="/about" element={<About />} />
            <Route path="*" element={<Navigate to="/setup" replace />} />
          </Routes>
        </Router>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router basename={process.env.PUBLIC_URL}>
        <Layout user={user!}>
          <Routes>
            <Route path="/" element={<Dashboard user={user!} />} />
            <Route path="/setup" element={<Navigate to="/" replace />} />
            <Route path="/signin" element={<Navigate to="/" replace />} />
            <Route path="/log" element={<Log user={user!} />} />
            <Route path="/chat" element={<Chat user={user!} />} />
            <Route path="/profile" element={<Profile user={user!} onUserUpdate={setUser} onSignOut={handleSignOut} />} />
            <Route path="/about" element={<About />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </Router>
    </ThemeProvider>
  );
}

export default App;
