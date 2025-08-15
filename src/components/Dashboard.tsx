import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  LinearProgress,
  IconButton,
  BottomNavigation,
  BottomNavigationAction,
  Paper,
  Card,
  CardContent,
  Chip,
} from '@mui/material';
import {
  Add,
  Home,
  Timeline,
  Person,
  Settings,
} from '@mui/icons-material';
import { User, DailyProgress } from '../types';
import { mockAPI } from '../data/mockData';

interface DashboardProps {
  user: User;
  onNavigateToChat?: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onNavigateToChat }) => {
  const [dailyProgress, setDailyProgress] = useState<DailyProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const progress = await mockAPI.getDailyProgress(new Date());
        setDailyProgress(progress);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return <LinearProgress />;
  }

  if (!dailyProgress) {
    return <Typography>No data available</Typography>;
  }

  // Mock daily entries data based on the sketch
  const dailyEntries = [
    { date: '8/13', calories: 2900, status: 'over', label: 'Over Budget' },
    { date: '8/14', calories: 1980, status: 'under', label: 'On Track' },
    { date: 'Today', calories: Math.round(dailyProgress.totalActual), status: 'current', label: 'Current' },
    { date: '8/16', calories: 300, status: 'planned', label: 'Planned' },
    { date: '8/17', calories: 0, status: 'planned', label: 'Planned' },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'over':
        return '#ff6b6b'; // Red for over budget
      case 'under':
        return '#4caf50'; // Green for on track
      case 'current':
        return dailyProgress.totalActual > user.dailyCalorieTarget ? '#ff6b6b' : '#4caf50';
      case 'planned':
        return '#2196f3'; // Blue for planned
      default:
        return '#757575';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'over':
        return '✗';
      case 'under':
        return '✓';
      case 'current':
        return dailyProgress.totalActual > user.dailyCalorieTarget ? '✗' : '✓';
      case 'planned':
        return '';
      default:
        return '';
    }
  };

  const handleAddFood = () => {
    if (onNavigateToChat) {
      onNavigateToChat();
    }
  };

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100vh'
    }}>
      {/* Main Content */}
      <Box sx={{ flex: 1, p: 2, overflow: 'auto' }}>
        {/* Progress Bar */}
        <Box sx={{ 
          mb: 3, 
          p: 3, 
          border: '2px solid #e3f2fd', 
          borderRadius: 2, 
          bgcolor: '#f3f8ff',
          position: 'relative'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Box sx={{ flex: 1 }}>
              <LinearProgress
                variant="determinate"
                value={Math.min((dailyProgress.totalActual / user.dailyCalorieTarget) * 100, 100)}
                sx={{ 
                  height: 12, 
                  borderRadius: 6,
                  bgcolor: '#e0e0e0',
                  '& .MuiLinearProgress-bar': {
                    bgcolor: dailyProgress.totalActual > user.dailyCalorieTarget ? '#ff6b6b' : '#4caf50'
                  }
                }}
              />
            </Box>
            <IconButton 
              onClick={handleAddFood}
              sx={{ 
                color: '#1976d2',
                flexShrink: 0
              }}
            >
              <Add />
            </IconButton>
          </Box>
          <Typography variant="body1" sx={{ textAlign: 'center', fontWeight: 500 }}>
            Today: {Math.round(dailyProgress.totalActual)}/{Math.round(user.dailyCalorieTarget)} calories
          </Typography>
        </Box>

        {/* Daily Entries */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {dailyEntries.map((entry, index) => (
            <Card 
              key={index} 
              sx={{ 
                borderRadius: 2,
                border: `2px solid ${getStatusColor(entry.status)}`,
                bgcolor: 'white'
              }}
            >
              <CardContent sx={{ p: 2 }}>
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center' 
                }}>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 600, color: getStatusColor(entry.status) }}>
                      {entry.date}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {entry.calories} kcal
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography 
                      variant="h4" 
                      sx={{ 
                        color: getStatusColor(entry.status),
                        fontWeight: 'bold'
                      }}
                    >
                      {getStatusIcon(entry.status)}
                    </Typography>
                    {entry.status === 'planned' && (
                      <IconButton 
                        size="small" 
                        onClick={handleAddFood}
                        sx={{ color: getStatusColor(entry.status) }}
                      >
                        <Add />
                      </IconButton>
                    )}
                  </Box>
                </Box>
                <Chip 
                  label={entry.label} 
                  size="small" 
                  sx={{ 
                    mt: 1,
                    bgcolor: getStatusColor(entry.status),
                    color: 'white',
                    fontSize: '0.75rem'
                  }} 
                />
              </CardContent>
            </Card>
          ))}
        </Box>
      </Box>

      {/* Bottom Navigation */}
      <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0 }} elevation={3}>
        <BottomNavigation
          value={selectedTab}
          onChange={(event, newValue) => setSelectedTab(newValue)}
          showLabels
        >
          <BottomNavigationAction label="Home" icon={<Home />} />
          <BottomNavigationAction label="Progress" icon={<Timeline />} />
          <BottomNavigationAction label="Profile" icon={<Person />} />
          <BottomNavigationAction label="Settings" icon={<Settings />} />
        </BottomNavigation>
      </Paper>
    </Box>
  );
};

export default Dashboard; 