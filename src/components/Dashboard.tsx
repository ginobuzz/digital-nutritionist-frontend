import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  LinearProgress,
  Card,
  CardContent,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Alert,
  useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import TodayRoundedIcon from '@mui/icons-material/TodayRounded';
import TimelineRoundedIcon from '@mui/icons-material/TimelineRounded';
import { useNavigate } from 'react-router-dom';
import { User, DailyProgress } from '../types';
import { apiService } from '../services/api';

interface DashboardProps {
  user: User;
  onNavigateToChat?: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onNavigateToChat }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [dailyProgress, setDailyProgress] = useState<DailyProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentEntries, setRecentEntries] = useState<{ date: string; calories: number; status: string; label: string; }[]>([]);
  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [logForm, setLogForm] = useState({
    description: '',
    calories: '',
    mealType: 'lunch',
  });
  const [logError, setLogError] = useState<string | null>(null);
  const [savingLog, setSavingLog] = useState(false);

  const getActiveUserId = useCallback(() => {
    try {
      const raw = localStorage.getItem('user');
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed?.id || user.id;
    } catch {
      return user.id;
    }
  }, [user.id]);

  const fetchData = useCallback(async (showLoader = false) => {
    try {
      if (showLoader) {
        setLoading(true);
      }
      const userId = getActiveUserId();

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
      if (showLoader) {
        setLoading(false);
      }
    }
  }, [getActiveUserId, user.dailyCalorieTarget]);

  useEffect(() => {
    fetchData(true);
  }, [fetchData]);

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
        return theme.palette.error.main;
      case 'under':
        return theme.palette.success.main;
      case 'current':
        return dailyProgress.totalActual > user.dailyCalorieTarget
          ? theme.palette.error.main
          : theme.palette.success.main;
      case 'planned':
        return theme.palette.info.main;
      default:
        return theme.palette.text.secondary;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'over':
        return <CloseRoundedIcon fontSize="small" />;
      case 'under':
        return <CheckRoundedIcon fontSize="small" />;
      case 'current':
        return dailyProgress.totalActual > user.dailyCalorieTarget
          ? <CloseRoundedIcon fontSize="small" />
          : <CheckRoundedIcon fontSize="small" />;
      case 'planned':
        return <AddRoundedIcon fontSize="small" />;
      default:
        return null;
    }
  };

  const openLogDialog = () => {
    setLogError(null);
    setLogForm({
      description: '',
      calories: '',
      mealType: 'lunch',
    });
    setLogDialogOpen(true);
  };

  const handleCloseLogDialog = () => {
    if (!savingLog) {
      setLogDialogOpen(false);
      setLogError(null);
    }
  };

  const handleLogInputChange = (field: 'description' | 'calories' | 'mealType', value: string) => {
    setLogForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveMealLog = async () => {
    if (!logForm.description.trim() || !logForm.calories.trim()) {
      setLogError('Enter a short description and calories to log the meal.');
      return;
    }

    try {
      setSavingLog(true);
      setLogError(null);
      const userId = getActiveUserId();
      await apiService.createMealLog({
        user_id: userId,
        date: new Date().toISOString().slice(0, 10),
        user_description: logForm.description.trim(),
        meal_type: logForm.mealType || null,
        estimated_calories: Number(logForm.calories),
      });
      setLogDialogOpen(false);
      setLogForm({
        description: '',
        calories: '',
        mealType: 'lunch',
      });
      await fetchData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to log meal. Please try again.';
      setLogError(message);
    } finally {
      setSavingLog(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Progress */}
      <Card
        sx={{
          overflow: 'hidden',
          background: `linear-gradient(135deg, ${alpha(
            theme.palette.primary.main,
            0.12
          )} 0%, ${alpha(theme.palette.secondary.main, 0.10)} 60%), ${
            theme.palette.background.paper
          }`,
        }}
      >
        <CardContent sx={{ p: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 1.5 }}>
            <Box sx={{ minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <TodayRoundedIcon sx={{ color: 'text.secondary', fontSize: 18 }} />
                <Typography variant="overline" sx={{ color: 'text.secondary', lineHeight: 1 }}>
                  Today
                </Typography>
              </Box>
              <Typography variant="h5" sx={{ lineHeight: 1.1 }}>
                {Math.round(dailyProgress.totalActual)} / {Math.round(user.dailyCalorieTarget)} kcal
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                {dailyProgress.totalActual > user.dailyCalorieTarget
                  ? `Over by ${Math.round(dailyProgress.totalActual - user.dailyCalorieTarget)} kcal`
                  : `${Math.max(0, Math.round(user.dailyCalorieTarget - dailyProgress.totalActual))} kcal left`}
              </Typography>
            </Box>

            <Button
              variant="contained"
              color="primary"
              onClick={openLogDialog}
              startIcon={<AddRoundedIcon />}
              sx={{ flexShrink: 0 }}
            >
              Log
            </Button>
          </Box>

          <LinearProgress
            variant="determinate"
            value={Math.min((dailyProgress.totalActual / user.dailyCalorieTarget) * 100, 100)}
            sx={{
              height: 12,
              borderRadius: 999,
              bgcolor: alpha(theme.palette.text.primary, 0.06),
              '& .MuiLinearProgress-bar': {
                borderRadius: 999,
                backgroundColor: getStatusColor('current'),
              },
            }}
          />
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardContent sx={{ p: 2.5 }}>
          <Typography variant="h6" sx={{ mb: 1.5 }}>
            Quick Actions
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Button
              fullWidth
              variant="outlined"
              color="primary"
              onClick={() => navigate('/log')}
              startIcon={<TimelineRoundedIcon />}
            >
              View Log
            </Button>
            <Button
              fullWidth
              variant="contained"
              color="secondary"
              onClick={openLogDialog}
              startIcon={<AddRoundedIcon />}
            >
              Log Food
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Recent Days */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography variant="h6" sx={{ color: 'text.secondary', px: 0.5 }}>
          Recent Days
        </Typography>
        {recentEntries.map((entry, index) => {
          const color = getStatusColor(entry.status);
          return (
            <Card
              key={index}
              sx={{
                borderColor: alpha(color, 0.35),
                backgroundColor: alpha(color, 0.06),
              }}
            >
              <CardContent sx={{ p: 1.75, '&:last-child': { pb: 1.75 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography
                      variant="subtitle1"
                      sx={{
                        fontWeight: 900,
                        color,
                        lineHeight: 1.2,
                      }}
                    >
                      {entry.date}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {entry.calories} kcal
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip
                      label={entry.label}
                      size="small"
                      sx={{
                        bgcolor: alpha(color, 0.14),
                        color,
                        border: `1px solid ${alpha(color, 0.26)}`,
                      }}
                    />
                    <Box
                      sx={{
                        width: 34,
                        height: 34,
                        display: 'grid',
                        placeItems: 'center',
                        borderRadius: 999,
                        color,
                        backgroundColor: alpha(color, 0.14),
                        border: `1px solid ${alpha(color, 0.26)}`,
                      }}
                    >
                      {getStatusIcon(entry.status)}
                    </Box>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          );
        })}
      </Box>

      <Dialog open={logDialogOpen} onClose={handleCloseLogDialog} maxWidth="xs" fullWidth>
        <DialogTitle>Log Today's Meal</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {logError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {logError}
            </Alert>
          )}
          <TextField
            fullWidth
            margin="dense"
            label="What did you eat?"
            value={logForm.description}
            onChange={(event) => handleLogInputChange('description', event.target.value)}
          />
          <TextField
            fullWidth
            margin="dense"
            label="Calories"
            type="number"
            inputProps={{ min: 0 }}
            value={logForm.calories}
            onChange={(event) => handleLogInputChange('calories', event.target.value)}
          />
          <TextField
            select
            fullWidth
            margin="dense"
            label="Meal Type"
            value={logForm.mealType}
            onChange={(event) => handleLogInputChange('mealType', event.target.value)}
          >
            {['breakfast', 'lunch', 'dinner', 'snack', 'other'].map((option) => (
              <MenuItem key={option} value={option}>
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseLogDialog} disabled={savingLog}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleSaveMealLog}
            disabled={savingLog}
          >
            {savingLog ? 'Saving...' : 'Log Meal'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Dashboard; 
