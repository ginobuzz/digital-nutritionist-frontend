import React, { useState, useEffect, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useMediaQuery } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Log from './components/Log';
import Chat from './components/Chat';
import Profile from './components/Profile';
import Setup from './components/Setup';
import SignIn from './components/SignIn';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';
import About from './components/About';
import Legal from './components/Legal';
import { User } from './types';
import { calculateDailyCalorieTarget, calculateDailyExpenditure } from './utils/calculations';
import { apiService } from './services/api';
import { authService } from './services/auth';
import { createAppTheme, THEME_PREFERENCE_STORAGE_KEY, type ThemePreference } from './theme';

function SignInRedirect() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const next = params.get('next');
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/signin')
    ? next
    : null;
  return <Navigate to={safeNext || '/'} replace />;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [setupComplete, setSetupComplete] = useState(false);
  const [themePreference, setThemePreference] = useState<ThemePreference>(() => {
    const stored = localStorage.getItem(THEME_PREFERENCE_STORAGE_KEY);
    return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
  });

  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)', { noSsr: true });
  const resolvedThemeMode = themePreference === 'system' ? (prefersDarkMode ? 'dark' : 'light') : themePreference;
  const theme = useMemo(() => createAppTheme(resolvedThemeMode), [resolvedThemeMode]);

  useEffect(() => {
    localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, themePreference);
  }, [themePreference]);

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
        <CssBaseline enableColorScheme />
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
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/about" element={<About />} />
            <Route path="/legal" element={<Legal />} />
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
        <CssBaseline enableColorScheme />
        <Router basename={process.env.PUBLIC_URL}>
          <Routes>
            <Route path="/setup" element={<Setup onComplete={handleSetupComplete} />} />
            <Route path="/about" element={<About />} />
            <Route path="/legal" element={<Legal />} />
            <Route path="*" element={<Navigate to="/setup" replace />} />
          </Routes>
        </Router>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline enableColorScheme />
      <Router basename={process.env.PUBLIC_URL}>
        <Layout
          user={user!}
          themePreference={themePreference}
          resolvedThemeMode={resolvedThemeMode}
          onThemePreferenceChange={setThemePreference}
        >
          <Routes>
            <Route path="/" element={<Dashboard user={user!} />} />
            <Route path="/setup" element={<Navigate to="/" replace />} />
            <Route path="/signin" element={<SignInRedirect />} />
            <Route path="/log" element={<Log user={user!} />} />
            <Route path="/chat" element={<Chat user={user!} />} />
            <Route path="/profile" element={<Profile user={user!} onUserUpdate={setUser} onSignOut={handleSignOut} />} />
            <Route path="/about" element={<About />} />
            <Route path="/legal" element={<Legal />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </Router>
    </ThemeProvider>
  );
}

export default App;
