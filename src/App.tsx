import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Plan from './components/Plan';
import Reality from './components/Reality';
import Chat from './components/Chat';
import Profile from './components/Profile';
import Setup from './components/Setup';
import { User } from './types';
import { calculateDailyExpenditure } from './utils/calculations';

// Create a custom theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#2196f3',
      light: '#64b5f6',
      dark: '#1976d2',
    },
    secondary: {
      main: '#ff9800',
      light: '#ffb74d',
      dark: '#f57c00',
    },
    success: {
      main: '#4caf50',
      light: '#81c784',
      dark: '#388e3c',
    },
    background: {
      default: '#f5f5f5',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 16,
        },
      },
    },
  },
});

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [setupComplete, setSetupComplete] = useState(false);

  useEffect(() => {
    // Check if user has completed setup (in a real app, this would check localStorage or API)
    // For now, we'll start with setup incomplete
    setSetupComplete(false);
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

  // If setup is not complete, show setup flow
  if (!setupComplete) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Setup onComplete={handleSetupComplete} />
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
            <Route path="/plan" element={<Plan />} />
            <Route path="/reality" element={<Reality />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/profile" element={<Profile user={user!} onUserUpdate={setUser} />} />
          </Routes>
        </Layout>
      </Router>
    </ThemeProvider>
  );
}

export default App;
