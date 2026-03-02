import React, { useState, useEffect, useMemo, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp, type URLOpenListenerEvent } from '@capacitor/app';
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
import { consumePendingWidgetDeepLink, WIDGET_APP_SCHEME } from './services/widgetBridge';

const getRouterBasename = (): string | undefined => {
  if (typeof window !== 'undefined' && window.location?.protocol === 'capacitor:') return undefined;

  const raw = (process.env.PUBLIC_URL || '').trim();
  if (!raw) return undefined;

  // CRA uses "." / "./" when building for relative hosting (e.g., Capacitor).
  if (raw === '.' || raw === './' || raw === '/.' || raw === '/./') return undefined;

  let basename = raw;
  if (/^https?:\/\//i.test(basename)) {
    try {
      basename = new URL(basename).pathname;
    } catch {
      // ignore
    }
  }

  if (!basename.startsWith('/')) basename = `/${basename}`;
  basename = basename.replace(/\/+$/, '');

  return basename === '/' ? undefined : basename;
};

const normalizeDeepLinkPath = (rawUrl: string): string | null => {
  try {
    const url = new URL(rawUrl);
    const protocol = url.protocol.replace(':', '').toLowerCase();
    let path = url.pathname || '';

    if ((!path || path === '/') && url.host && url.host !== 'localhost') {
      path = `/${url.host}`;
    }

    if (/^https?$/.test(protocol)) {
      path = path.replace(/^\/digital-nutritionist-frontend(?=\/|$)/, '') || '/';
    }

    if (!path.startsWith('/')) path = `/${path}`;
    if (path.startsWith('//')) return null;

    const search = url.search || '';
    const hash = url.hash || '';
    return `${path}${search}${hash}`;
  } catch {
    return null;
  }
};

function NativeDeepLinkHandler() {
  const navigate = useNavigate();
  const lastHandledPendingUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const isIOSNative = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
    if (!isIOSNative) return;

    const readProtocol = (url: string): string | null => {
      try {
        return new URL(url).protocol.replace(':', '').toLowerCase();
      } catch {
        return null;
      }
    };

    const openInternalPath = (url: string) => {
      const parsed = normalizeDeepLinkPath(url);
      if (!parsed) return;
      navigate(parsed);
    };

    const syncPendingDeepLink = () => {
      void consumePendingWidgetDeepLink().then((pendingUrl) => {
        if (!pendingUrl) return;
        if (lastHandledPendingUrlRef.current === pendingUrl) return;
        lastHandledPendingUrlRef.current = pendingUrl;
        openInternalPath(pendingUrl);
      });
    };

    let mounted = true;
    let cleanup: (() => Promise<void>) | null = null;

    void CapacitorApp.getLaunchUrl()
      .then((launchData) => {
        if (!mounted || !launchData?.url) return;
        const launchProtocol = readProtocol(launchData.url);
        if (!launchProtocol) return;
        if (launchProtocol === WIDGET_APP_SCHEME || launchProtocol === 'capacitor' || /^https?$/.test(launchProtocol)) {
          openInternalPath(launchData.url);
        }
      })
      .catch(() => {
        // no-op
      });
    syncPendingDeepLink();

    void CapacitorApp.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
      const protocol = readProtocol(event.url);
      if (!protocol) return;
      if (protocol === WIDGET_APP_SCHEME || protocol === 'capacitor' || /^https?$/.test(protocol)) {
        lastHandledPendingUrlRef.current = event.url;
        openInternalPath(event.url);
      }
    }).then((listener) => {
      cleanup = () => listener.remove();
    });

    let appStateCleanup: (() => Promise<void>) | null = null;
    void CapacitorApp.addListener('appStateChange', (state) => {
      if (state.isActive) {
        syncPendingDeepLink();
      }
    }).then((listener) => {
      appStateCleanup = () => listener.remove();
    });

    return () => {
      mounted = false;
      if (appStateCleanup) void appStateCleanup();
      if (cleanup) void cleanup();
    };
  }, [navigate]);

  return null;
}

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
  const routerBasename = getRouterBasename();
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
        <Router basename={routerBasename}>
          <NativeDeepLinkHandler />
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
        <Router basename={routerBasename}>
          <NativeDeepLinkHandler />
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
      <Router basename={routerBasename}>
        <NativeDeepLinkHandler />
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
