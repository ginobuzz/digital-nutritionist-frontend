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
  ToggleButton,
  ToggleButtonGroup,
  useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import TodayRoundedIcon from '@mui/icons-material/TodayRounded';
import TimelineRoundedIcon from '@mui/icons-material/TimelineRounded';
import InfoRoundedIcon from '@mui/icons-material/InfoRounded';
import { useNavigate } from 'react-router-dom';
import { addDays, format, isAfter, isBefore, isSameDay, startOfDay } from 'date-fns';
import Markdown from 'markdown-to-jsx';
import { User } from '../types';
import { apiService } from '../services/api';

interface DashboardProps {
  user: User;
  onNavigateToChat?: () => void;
}

type DayKind = 'past' | 'today' | 'future';

interface DayEntry {
  key: string; // YYYY-MM-DD
  date: Date;
  label: string;
  kind: DayKind;
  actualCalories: number;
  plannedCalories: number;
}

const WEEK_LENGTH_DAYS = 7;
const toIsoDate = (d: Date) => format(d, 'yyyy-MM-dd');

const Dashboard: React.FC<DashboardProps> = ({ user, onNavigateToChat }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(() => startOfDay(new Date()));
  const [dayEntries, setDayEntries] = useState<DayEntry[]>([]);
  const [actualCaloriesByDate, setActualCaloriesByDate] = useState<Record<string, number>>({});
  const [plannedCaloriesByDate, setPlannedCaloriesByDate] = useState<Record<string, number>>({});
  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [logMode, setLogMode] = useState<'quick' | 'describe'>('quick');
  const [logForm, setLogForm] = useState({
    description: '',
    calories: '',
    mealType: 'lunch',
  });
  const [describeInput, setDescribeInput] = useState('');
  const [describeReply, setDescribeReply] = useState<string | null>(null);
  const [logError, setLogError] = useState<string | null>(null);
  const [savingQuickLog, setSavingQuickLog] = useState(false);
  const [sendingDescribeLog, setSendingDescribeLog] = useState(false);

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

      const today = startOfDay(new Date());
      const weekStart = today;
      const weekEnd = addDays(today, WEEK_LENGTH_DAYS - 1);

      const [logs, plannedMeals] = await Promise.all([
        apiService.getMealLogs({ userId, start: weekStart, end: weekEnd }),
        apiService.getPlannedMeals({ userId: String(userId), start: weekStart, end: weekEnd }),
      ]);

      const nextActualByDate: Record<string, number> = {};
      for (const log of logs) {
        const key = log.date; // YYYY-MM-DD
        const cals = Number(log.estimated_calories || 0);
        nextActualByDate[key] = (nextActualByDate[key] || 0) + cals;
      }

      const nextPlannedByDate: Record<string, number> = {};
      for (const meal of plannedMeals) {
        const key = meal.date; // YYYY-MM-DD
        const cals = Number(meal.calories || 0);
        nextPlannedByDate[key] = (nextPlannedByDate[key] || 0) + cals;
      }

      const entries: DayEntry[] = Array.from({ length: WEEK_LENGTH_DAYS }, (_, idx) => {
        const date = addDays(today, idx);
        const key = toIsoDate(date);
        const kind: DayKind = isSameDay(date, today) ? 'today' : 'future';
        const label = format(date, 'EEEE');
        return {
          key,
          date,
          label,
          kind,
          actualCalories: Math.round(nextActualByDate[key] || 0),
          plannedCalories: Math.round(nextPlannedByDate[key] || 0),
        };
      });

      setActualCaloriesByDate(nextActualByDate);
      setPlannedCaloriesByDate(nextPlannedByDate);
      setDayEntries(entries);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }, [getActiveUserId]);

  useEffect(() => {
    fetchData(true);
  }, [fetchData]);

  if (loading) {
    return <LinearProgress />;
  }

  const selectedDay = startOfDay(selectedDate);
  const today = startOfDay(new Date());
  const selectedKey = toIsoDate(selectedDay);
  const isSelectedPast = isBefore(selectedDay, today);
  const isSelectedToday = isSameDay(selectedDay, today);
  const isSelectedFuture = isAfter(selectedDay, today);

  const selectedActualCalories = Math.round(actualCaloriesByDate[selectedKey] || 0);
  const selectedPlannedCalories = Math.round(plannedCaloriesByDate[selectedKey] || 0);
  const selectedDisplayedCalories = isSelectedFuture ? selectedPlannedCalories : selectedActualCalories;

  const getDayColor = (entry: DayEntry) => {
    if (entry.kind === 'past') return theme.palette.grey[600];
    if (entry.kind === 'future') return theme.palette.info.main;
    // today
    return entry.actualCalories > user.dailyCalorieTarget ? theme.palette.error.main : theme.palette.success.main;
  };

  const getDayChipLabel = (entry: DayEntry) => {
    if (entry.kind === 'past') return 'Locked';
    if (entry.kind === 'future') return entry.plannedCalories > 0 ? 'Planned' : 'Plan';
    return entry.actualCalories > user.dailyCalorieTarget ? 'Over Budget' : 'On Track';
  };

  const getDayIcon = (entry: DayEntry) => {
    if (entry.kind === 'past') return <LockRoundedIcon fontSize="small" />;
    if (entry.kind === 'future') return <AddRoundedIcon fontSize="small" />;
    return entry.actualCalories > user.dailyCalorieTarget
      ? <CloseRoundedIcon fontSize="small" />
      : <CheckRoundedIcon fontSize="small" />;
  };

  const openLogDialog = (date?: Date) => {
    if (date) {
      setSelectedDate(date);
    }
    if (date && isBefore(startOfDay(date), today)) return;
    if (!date && isSelectedPast) return;
    setLogError(null);
    setDescribeReply(null);
    setLogForm({
      description: '',
      calories: '',
      mealType: 'lunch',
    });
    setDescribeInput('');
    setLogDialogOpen(true);
  };

  const handleCloseLogDialog = () => {
    if (!savingQuickLog && !sendingDescribeLog) {
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
      setSavingQuickLog(true);
      setLogError(null);
      const userId = getActiveUserId();
      await apiService.createMealLog({
        user_id: userId,
        date: selectedKey,
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
      setSavingQuickLog(false);
    }
  };

  const handleDescribeMealLog = async () => {
    if (!describeInput.trim()) {
      setLogError('Describe what you ate (or drank) to log it.');
      return;
    }

    try {
      setSendingDescribeLog(true);
      setLogError(null);
      setDescribeReply(null);
      const userId = getActiveUserId();
      const prompt = [
        `Please log what I consumed on ${selectedKey}.`,
        `If details are missing, make reasonable assumptions and estimate calories (integer) rather than asking follow-up questions.`,
        ``,
        describeInput.trim(),
      ].join('\n');

      const response = await apiService.chat({
        message: prompt,
        user_id: userId ?? undefined,
      });

      setDescribeReply(response.reply || 'OK.');
      await fetchData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to log meal. Please try again.';
      setLogError(message);
    } finally {
      setSendingDescribeLog(false);
    }
  };

  const dialogBusy = savingQuickLog || sendingDescribeLog;

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
                  {isSelectedToday ? 'Today' : format(selectedDay, 'EEEE, MMM d')}
                </Typography>
              </Box>
              <Typography variant="h5" sx={{ lineHeight: 1.1 }}>
                {Math.round(selectedDisplayedCalories)} / {Math.round(user.dailyCalorieTarget)} kcal
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                {isSelectedPast
                  ? 'Past day (locked)'
                  : isSelectedFuture
                    ? `${Math.max(0, Math.round(user.dailyCalorieTarget - selectedDisplayedCalories))} kcal available to plan`
                    : selectedDisplayedCalories > user.dailyCalorieTarget
                      ? `Over by ${Math.round(selectedDisplayedCalories - user.dailyCalorieTarget)} kcal`
                      : `${Math.max(0, Math.round(user.dailyCalorieTarget - selectedDisplayedCalories))} kcal left`}
              </Typography>
            </Box>

            <Button
              variant="contained"
              color={isSelectedToday ? 'primary' : 'info'}
              onClick={() => {
                openLogDialog();
              }}
              startIcon={<AddRoundedIcon />}
              sx={{ flexShrink: 0 }}
              disabled={isSelectedPast}
            >
              Log
            </Button>
          </Box>

          <LinearProgress
            variant="determinate"
            value={Math.min((selectedDisplayedCalories / user.dailyCalorieTarget) * 100, 100)}
            sx={{
              height: 12,
              borderRadius: 999,
              bgcolor: alpha(theme.palette.text.primary, 0.06),
              '& .MuiLinearProgress-bar': {
                borderRadius: 999,
                backgroundColor: isSelectedPast
                  ? theme.palette.grey[600]
                  : isSelectedFuture
                    ? theme.palette.info.main
                    : selectedDisplayedCalories > user.dailyCalorieTarget
                      ? theme.palette.error.main
                      : theme.palette.success.main,
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
              onClick={() => navigate(`/log?date=${selectedKey}`)}
              startIcon={<TimelineRoundedIcon />}
            >
              View Log
            </Button>
            <Button
              fullWidth
              variant="contained"
              color="secondary"
              onClick={() => {
                openLogDialog();
              }}
              startIcon={<AddRoundedIcon />}
              disabled={isSelectedPast}
            >
              Log Food
            </Button>
          </Box>
          <Button
            variant="text"
            color="inherit"
            onClick={() => navigate('/about')}
            startIcon={<InfoRoundedIcon />}
            sx={{ mt: 1, px: 0 }}
          >
            About Sunday Mornings
          </Button>
        </CardContent>
      </Card>

      {/* Days */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography variant="h6" sx={{ color: 'text.secondary', px: 0.5 }}>
          Days
        </Typography>
        {dayEntries.map((entry) => {
          const color = getDayColor(entry);
          const isSelected = isSameDay(entry.date, selectedDay);
          const calories = entry.actualCalories > 0 ? entry.actualCalories : entry.plannedCalories;
          const caloriesLabel =
            entry.kind === 'future'
              ? entry.actualCalories > 0
                ? 'logged'
                : 'planned'
              : '';
          return (
            <Card
              key={entry.key}
              variant="outlined"
              sx={{
                cursor: 'pointer',
                borderColor: alpha(color, 0.35),
                backgroundColor: alpha(color, 0.06),
                outline: isSelected ? `2px solid ${alpha(color, 0.65)}` : 'none',
                outlineOffset: 0,
              }}
              onClick={() => {
                navigate(`/log?date=${entry.key}`);
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
                      {entry.label}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {calories} kcal {caloriesLabel}
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip
                      label={getDayChipLabel(entry)}
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
                      {getDayIcon(entry)}
                    </Box>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          );
        })}
      </Box>

      <Dialog open={logDialogOpen} onClose={handleCloseLogDialog} maxWidth="xs" fullWidth>
        <DialogTitle>Log Food ({isSelectedToday ? 'Today' : format(selectedDay, 'EEE M/d')})</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {logError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {logError}
            </Alert>
          )}
          <ToggleButtonGroup
            value={logMode}
            exclusive
            fullWidth
            size="small"
            disabled={dialogBusy}
            sx={{ mb: 1.5 }}
            onChange={(_, value) => {
              if (!value) return;
              setLogMode(value);
              setLogError(null);
              setDescribeReply(null);
            }}
          >
            <ToggleButton value="quick">Quick add</ToggleButton>
            <ToggleButton value="describe">Describe it</ToggleButton>
          </ToggleButtonGroup>

          {logMode === 'quick' ? (
            <>
              <TextField
                fullWidth
                margin="dense"
                label="What did you eat?"
                value={logForm.description}
                onChange={(event) => handleLogInputChange('description', event.target.value)}
                disabled={dialogBusy}
              />
              <TextField
                fullWidth
                margin="dense"
                label="Calories"
                type="number"
                inputProps={{ min: 0 }}
                value={logForm.calories}
                onChange={(event) => handleLogInputChange('calories', event.target.value)}
                disabled={dialogBusy}
              />
              <TextField
                select
                fullWidth
                margin="dense"
                label="Meal Type"
                value={logForm.mealType}
                onChange={(event) => handleLogInputChange('mealType', event.target.value)}
                disabled={dialogBusy}
              >
                {['breakfast', 'lunch', 'dinner', 'snack', 'other'].map((option) => (
                  <MenuItem key={option} value={option}>
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </MenuItem>
                ))}
              </TextField>
            </>
          ) : (
            <>
              <TextField
                fullWidth
                margin="dense"
                label="Describe what you ate (or drank)"
                placeholder="Example: chicken burrito bowl with rice, beans, guac and a Coke"
                value={describeInput}
                onChange={(event) => setDescribeInput(event.target.value)}
                multiline
                minRows={3}
                disabled={dialogBusy || Boolean(describeReply)}
              />

              {describeReply && (
                <Box
                  sx={{
                    mt: 2,
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.info.main, 0.06),
                    border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
                    '& p': { m: 0 },
                    '& ul, & ol': { m: 0, pl: 3 },
                    '& li': { mb: 0.5 },
                    '& li:last-child': { mb: 0 },
                    '& a': { color: 'inherit' },
                    '& code': {
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                      fontSize: '0.9em',
                    },
                    '& pre': {
                      overflowX: 'auto',
                      p: 1,
                      borderRadius: 1,
                      backgroundColor: 'rgba(0,0,0,0.06)',
                    },
                    '& pre code': { fontSize: '0.85em' },
                  }}
                >
                  <Markdown>{describeReply}</Markdown>
                </Box>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseLogDialog} disabled={dialogBusy}>
            {logMode === 'describe' && describeReply ? 'Close' : 'Cancel'}
          </Button>
          {logMode === 'quick' ? (
            <Button
              variant="contained"
              onClick={handleSaveMealLog}
              disabled={dialogBusy}
            >
              {savingQuickLog ? 'Saving...' : 'Log Meal'}
            </Button>
          ) : (
            <Button
              variant="contained"
              onClick={handleDescribeMealLog}
              disabled={dialogBusy || Boolean(describeReply)}
            >
              {sendingDescribeLog ? 'Sending...' : 'Send to AI'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Dashboard; 
