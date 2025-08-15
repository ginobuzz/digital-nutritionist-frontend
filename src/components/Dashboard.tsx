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
import { mockAPI } from '../data/mockData';

interface DashboardProps {
  user: User;
  onNavigateToChat?: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onNavigateToChat }) => {
  const [dailyProgress, setDailyProgress] = useState<DailyProgress | null>(null);
  const [loading, setLoading] = useState(true);

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
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="h6" sx={{ mb: 2, color: 'text.secondary' }}>
            Recent Days
          </Typography>
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
                        fontWeight: 'bold',
                        fontSize: '1.5rem',
                        lineHeight: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 32,
                        height: 32
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
    </Box>
  );
};

export default Dashboard; 