import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  LinearProgress,
  Card,
  CardContent,
  Chip,
  Button,
} from '@mui/material';
import { User, DailyProgress } from '../types';
import { apiService } from '../services/api';

interface DashboardProps {
  user: User;
  onNavigateToChat?: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onNavigateToChat }) => {
  const [dailyProgress, setDailyProgress] = useState<DailyProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentEntries, setRecentEntries] = useState<{ date: string; calories: number; status: string; label: string; }[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Determine current user id from persisted user
        const raw = localStorage.getItem('user');
        const parsed = raw ? JSON.parse(raw) : null;
        const userId = parsed?.id || user.id;

        // Fetch today's logs and a few recent days for the list
        const today = new Date();
        const start = new Date(today);
        start.setDate(start.getDate() - 4); // Last 5 days including today
        const logs = await apiService.getMealLogs({ userId, start, end: today });

        // Aggregate calories per day
        const caloriesByDate: Record<string, number> = {};
        for (const log of logs) {
          const key = log.date; // already YYYY-MM-DD
          const cals = Number(log.estimated_calories || 0);
          caloriesByDate[key] = (caloriesByDate[key] || 0) + cals;
        }

        const todayKey = today.toISOString().slice(0,10);
        const totalActual = caloriesByDate[todayKey] || 0;
        const progress: DailyProgress = {
          date: today,
          totalPlanned: 0,
          totalActual,
          totalBurned: 0,
          deficit: Math.max(0, user.dailyCalorieTarget - totalActual),
          meals: [],
          activities: [],
          logEntries: [],
        };
        setDailyProgress(progress);

        // Build recent entries list from the map
        const entries = Array.from({ length: 5 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (4 - i));
          const key = d.toISOString().slice(0, 10);
          const isToday = key === todayKey;
          const calories = Math.round(caloriesByDate[key] || 0);
          let status: string;
          let statusLabel: string;
          if (isToday) {
            status = calories > user.dailyCalorieTarget ? 'over' : 'current';
            statusLabel = calories > user.dailyCalorieTarget ? 'Over Budget' : 'Current';
          } else if (calories > 0) {
            status = calories > user.dailyCalorieTarget ? 'over' : 'under';
            statusLabel = calories > user.dailyCalorieTarget ? 'Over Budget' : 'On Track';
          } else {
            status = 'planned';
            statusLabel = 'Planned';
          }
          const label = isToday ? 'Today' : `${d.getMonth() + 1}/${d.getDate()}`;
          return { date: label, calories, status, label: statusLabel };
        });
        setRecentEntries(entries);
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

  // Entries are computed in state from the API response

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
        return '+';
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
      minHeight: '100vh',
      '& .MuiCardContent-root': {
        height: 'auto !important',
        minHeight: 'auto !important',
        maxHeight: 'none !important'
      }
    }}>
      {/* Main Content */}
      <Box sx={{ flex: 1, p: 2, overflow: 'visible' }}>
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
            <Typography 
              onClick={handleAddFood}
              sx={{ 
                color: '#1976d2',
                flexShrink: 0,
                fontSize: '1.5rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                userSelect: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                lineHeight: 1
              }}
            >
              +
            </Typography>
          </Box>
          <Typography 
            variant="body1" 
            sx={{ 
              textAlign: 'left', 
              fontWeight: 500,
              maxWidth: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            Today: {Math.round(dailyProgress.totalActual)}/{Math.round(user.dailyCalorieTarget)} calories
          </Typography>
        </Box>

        {/* Quick Actions */}
        <Card sx={{ mb: 3, bgcolor: '#f8f9fa', border: '1px solid #e9ecef' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Quick Actions
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Button
                variant="outlined"
                color="primary"
                onClick={() => window.location.href = '/log'}
                sx={{ minWidth: 120 }}
              >
                View Log
              </Button>
              <Button
                variant="outlined"
                color="secondary"
                onClick={handleAddFood}
                sx={{ minWidth: 120 }}
              >
                Log Food
              </Button>
            </Box>
          </CardContent>
        </Card>

        {/* Daily Entries */}
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: 1,
          mb: 2
        }}>
          <Typography variant="h6" sx={{ mb: 1, color: 'text.secondary' }}>
            Recent Days
          </Typography>
          {recentEntries.map((entry, index) => (
            <Card 
              key={index} 
              sx={{ 
                borderRadius: 2,
                border: `2px solid ${getStatusColor(entry.status)}`,
                bgcolor: 'white',
                minHeight: 'auto',
                '& .MuiCardContent-root': {
                  padding: '8px 12px',
                  '&:last-child': {
                    paddingBottom: '8px'
                  },
                  height: 'auto !important',
                  minHeight: 'auto !important',
                  maxHeight: 'none !important'
                }
              }}
            >
              <CardContent sx={{ 
                p: 0,
                height: 'auto !important',
                minHeight: 'auto !important',
                maxHeight: 'none !important'
              }}>
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  minHeight: '40px'
                }}>
                  <Box>
                    <Typography variant="h6" sx={{ 
                      fontWeight: 600, 
                      color: getStatusColor(entry.status),
                      fontSize: '1rem',
                      lineHeight: 1.2,
                      mb: 0.5
                    }}>
                      {entry.date}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                      {entry.calories} kcal
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography 
                      variant="h4" 
                      sx={{ 
                        color: getStatusColor(entry.status),
                        fontWeight: 'bold',
                        fontSize: '1.25rem',
                        lineHeight: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 28,
                        height: 28
                      }}
                    >
                      {getStatusIcon(entry.status)}
                    </Typography>
                  </Box>
                </Box>
                <Chip 
                  label={entry.label} 
                  size="small" 
                  sx={{ 
                    mt: 0.25,
                    bgcolor: getStatusColor(entry.status),
                    color: 'white',
                    fontSize: '0.75rem',
                    height: '18px'
                  }} 
                />
              </CardContent>
            </Card>
          ))}
        </Box>
      </Box>
    </Box>
  );
};

export default Dashboard; 