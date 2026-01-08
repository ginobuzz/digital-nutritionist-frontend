import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  LinearProgress,
  Alert,
  ToggleButton,
  ToggleButtonGroup,
  useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import {
  Add,
  Edit,
  Delete,
  Schedule,
  LocalDining,
  CalendarToday
} from '@mui/icons-material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, isValid, parseISO } from 'date-fns';
import Markdown from 'markdown-to-jsx';
import { ActualMeal, PlannedMeal, User } from '../types';
import { apiService, MealLogResponse, PlannedMealResponse } from '../services/api';
import { useSearchParams } from 'react-router-dom';

const toIsoDate = (d: Date) => format(d, 'yyyy-MM-dd');

type PlanMealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

const normalizeMealType = (value: string | null | undefined): ActualMeal['type'] => {
  const v = (value || '').toLowerCase();
  if (v === 'breakfast' || v === 'lunch' || v === 'dinner' || v === 'snack') return v;
  return 'snack';
};

const normalizePlanMealType = (value: unknown): PlanMealType => {
  const v = String(value || '').trim().toLowerCase();
  if (v === 'breakfast' || v === 'lunch' || v === 'dinner' || v === 'snack') return v;
  return 'snack';
};

const defaultTimeForMealType = (mealType: PlanMealType): string => {
  switch (mealType) {
    case 'breakfast':
      return '08:00';
    case 'lunch':
      return '12:00';
    case 'dinner':
      return '18:00';
    case 'snack':
    default:
      return '15:00';
  }
};

const coerceTime = (value: unknown, mealType: PlanMealType): string => {
  if (typeof value !== 'string') return defaultTimeForMealType(mealType);
  const trimmed = value.trim();
  const match = /^(\d{2}):(\d{2})$/.exec(trimmed);
  if (!match) return defaultTimeForMealType(mealType);
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return defaultTimeForMealType(mealType);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return defaultTimeForMealType(mealType);
  return `${match[1]}:${match[2]}`;
};

const extractJsonArray = (raw: string): string | null => {
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return null;
  return raw.slice(start, end + 1);
};

type PlannedMealDraft = {
  name: string;
  calories: number;
  meal_type: PlanMealType;
  time: string; // HH:MM (24h)
  description: string | null;
};

const parsePlannedMealDraftsFromReply = (reply: string): PlannedMealDraft[] => {
  const candidate = extractJsonArray(reply) ?? reply;
  const parsed = JSON.parse(candidate);
  if (!Array.isArray(parsed)) {
    throw new Error('Expected a JSON array.');
  }

  return parsed
    .map((item): PlannedMealDraft | null => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const name = typeof record.name === 'string' ? record.name.trim() : '';
      const calories = Number(record.calories);
      const mealType = normalizePlanMealType(record.meal_type);
      const time = coerceTime(record.time, mealType);
      const description =
        record.description == null
          ? null
          : typeof record.description === 'string'
            ? record.description.trim().slice(0, 500) || null
            : null;

      if (!name) return null;
      if (!Number.isFinite(calories)) return null;
      const caloriesInt = Math.max(0, Math.min(5000, Math.round(calories)));

      return {
        name,
        calories: caloriesInt,
        meal_type: mealType,
        time,
        description,
      };
    })
    .filter((item): item is PlannedMealDraft => Boolean(item));
};

const mapMealLogToActualMeal = (log: MealLogResponse): ActualMeal => {
  const createdAt = log.created_at ? new Date(log.created_at) : new Date(`${log.date}T12:00:00`);
  const calories = typeof log.estimated_calories === 'number' ? log.estimated_calories : 0;
  const userDescription = log.user_description || 'Meal';
  return {
    id: String(log.id),
    name: userDescription,
    calories,
    actualCalories: calories || undefined,
    type: normalizeMealType(log.meal_type),
    time: createdAt,
    isPlanned: false,
  };
};

const mapPlannedMealResponse = (meal: PlannedMealResponse): PlannedMeal => ({
  id: String(meal.id),
  name: meal.name,
  calories: meal.calories,
  type: normalizeMealType(meal.meal_type),
  description: meal.description || undefined,
  time: new Date(meal.time),
  isPlanned: true,
});

interface LogProps {
  user: User;
}

const Log: React.FC<LogProps> = ({ user }) => {
  const theme = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [plannedMeals, setPlannedMeals] = useState<PlannedMeal[]>([]);
  const [actualMeals, setActualMeals] = useState<ActualMeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [mealDialogOpen, setMealDialogOpen] = useState(false);
  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [logMode, setLogMode] = useState<'quick' | 'describe'>('describe');
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
  const [planMode, setPlanMode] = useState<'quick' | 'describe'>('describe');
  const [planForm, setPlanForm] = useState({
    description: '',
    calories: '',
    mealType: 'lunch',
  });
  const [planDescribeInput, setPlanDescribeInput] = useState('');
  const [planDescribeReply, setPlanDescribeReply] = useState<string | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [savingQuickPlan, setSavingQuickPlan] = useState(false);
  const [sendingDescribePlan, setSendingDescribePlan] = useState(false);
  const [editingMeal, setEditingMeal] = useState<PlannedMeal | ActualMeal | null>(null);
  const [isEditingPlanned, setIsEditingPlanned] = useState(false);
  const [mealFormData, setMealFormData] = useState({
    name: '',
    calories: '',
    type: 'breakfast' as PlannedMeal['type'] | ActualMeal['type'],
    description: '',
    time: '',
    notes: '',
    isPlanned: true
  });

  const fetchLogData = useCallback(async () => {
    try {
      setLoading(true);
      const [planned, actual] = await Promise.all([
        apiService.getPlannedMeals({ userId: user.id, start: selectedDate, end: selectedDate }),
        apiService.getMealLogs({ userId: user.id, start: selectedDate, end: selectedDate }),
      ]);
      setPlannedMeals(planned.map(mapPlannedMealResponse));
      setActualMeals(actual.map(mapMealLogToActualMeal));
    } catch (error) {
      console.error('Error fetching log data:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, user.id]);

  useEffect(() => {
    fetchLogData();
  }, [fetchLogData]);

  useEffect(() => {
    const dateParam = searchParams.get('date');
    if (!dateParam) return;
    const parsed = parseISO(dateParam);
    if (!isValid(parsed)) return;
    if (toIsoDate(parsed) === toIsoDate(selectedDate)) return;
    setSelectedDate(parsed);
  }, [searchParams, selectedDate]);

  const handleDateChange = (date: Date | null) => {
    if (date) {
      setSelectedDate(date);
      setSearchParams({ date: toIsoDate(date) }, { replace: true });
    }
  };

  const dialogBusy = savingQuickLog || sendingDescribeLog;
  const planDialogBusy = savingQuickPlan || sendingDescribePlan;
  const selectedKey = toIsoDate(selectedDate);

  const openLogDialog = () => {
    if (toIsoDate(selectedDate) > toIsoDate(new Date())) return;
    setLogMode('describe');
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

  const openPlanDialog = () => {
    if (toIsoDate(selectedDate) <= toIsoDate(new Date())) return;
    setPlanMode('describe');
    setPlanError(null);
    setPlanDescribeReply(null);
    setPlanForm({
      description: '',
      calories: '',
      mealType: 'lunch',
    });
    setPlanDescribeInput('');
    setPlanDialogOpen(true);
  };

  const handleCloseLogDialog = () => {
    if (!dialogBusy) {
      setLogDialogOpen(false);
      setLogError(null);
    }
  };

  const handleClosePlanDialog = () => {
    if (!planDialogBusy) {
      setPlanDialogOpen(false);
      setPlanError(null);
    }
  };

  const handleLogInputChange = (field: 'description' | 'calories' | 'mealType', value: string) => {
    setLogForm(prev => ({ ...prev, [field]: value }));
  };

  const handlePlanInputChange = (field: 'description' | 'calories' | 'mealType', value: string) => {
    setPlanForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveMealLog = async () => {
    if (!logForm.description.trim() || !logForm.calories.trim()) {
      setLogError('Enter a short description and calories to log the meal.');
      return;
    }

    try {
      setSavingQuickLog(true);
      setLogError(null);
      await apiService.createMealLog({
        user_id: user.id,
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
      await fetchLogData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to log meal. Please try again.';
      setLogError(message);
    } finally {
      setSavingQuickLog(false);
    }
  };

  const handleSaveMealPlan = async () => {
    if (!planForm.description.trim() || !planForm.calories.trim()) {
      setPlanError('Enter a short description and calories to plan the meal.');
      return;
    }

    try {
      setSavingQuickPlan(true);
      setPlanError(null);

      const mealType = normalizePlanMealType(planForm.mealType);
      const time = defaultTimeForMealType(mealType);
      const caloriesValue = Number(planForm.calories);
      if (!Number.isFinite(caloriesValue)) {
        setPlanError('Calories must be a number.');
        return;
      }
      const calories = Math.max(0, Math.min(5000, Math.round(caloriesValue)));

      await apiService.createPlannedMeal({
        user_id: user.id,
        date: selectedKey,
        name: planForm.description.trim(),
        calories,
        meal_type: mealType,
        time: new Date(`${selectedKey}T${time}:00`).toISOString(),
        description: null,
      });

      setPlanDialogOpen(false);
      setPlanForm({
        description: '',
        calories: '',
        mealType: 'lunch',
      });
      await fetchLogData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to plan meal. Please try again.';
      setPlanError(message);
    } finally {
      setSavingQuickPlan(false);
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
      const prompt = [
        `Please log what I consumed on ${selectedKey}.`,
        `If details are missing, make reasonable assumptions and estimate calories (integer) rather than asking follow-up questions.`,
        ``,
        describeInput.trim(),
      ].join('\n');

      const response = await apiService.chat({
        message: prompt,
        user_id: user.id,
        client_local_date: toIsoDate(new Date()),
        client_time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });

      setDescribeReply(response.reply || 'OK.');
      await fetchLogData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to log meal. Please try again.';
      setLogError(message);
    } finally {
      setSendingDescribeLog(false);
    }
  };

  const handleDescribeMealPlan = async () => {
    if (!planDescribeInput.trim()) {
      setPlanError('Describe what you want to eat to generate a plan.');
      return;
    }

    let lastReply = '';
    try {
      setSendingDescribePlan(true);
      setPlanError(null);
      setPlanDescribeReply(null);

      const calorieTarget = Number(user.dailyCalorieTarget || 0);
      const prompt = [
        `Create a meal plan for ${selectedKey}.`,
        `Return ONLY a JSON array (no markdown, no commentary).`,
        `Each item must have: name (string), calories (integer), meal_type ("breakfast"|"lunch"|"dinner"|"snack"), time ("HH:MM" 24h), description (string|null).`,
        calorieTarget > 0
          ? `Aim for a reasonable total around ${Math.round(calorieTarget)} calories (does not need to be exact).`
          : `Use reasonable calorie estimates.`,
        ``,
        planDescribeInput.trim(),
      ].join('\n');

      const response = await apiService.chat({
        message: prompt,
        user_id: user.id,
        client_local_date: toIsoDate(new Date()),
        client_time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });

      lastReply = response.reply || '';
      const drafts = parsePlannedMealDraftsFromReply(lastReply);
      if (drafts.length === 0) {
        setPlanDescribeReply(lastReply || 'No response.');
        throw new Error('AI did not return any planned meals.');
      }

      await Promise.all(
        drafts.map((draft) =>
          apiService.createPlannedMeal({
            user_id: user.id,
            date: selectedKey,
            name: draft.name,
            calories: draft.calories,
            meal_type: draft.meal_type,
            description: draft.description,
            time: new Date(`${selectedKey}T${draft.time}:00`).toISOString(),
          })
        )
      );

      setPlanDialogOpen(false);
      setPlanDescribeInput('');
      await fetchLogData();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to generate meal plan. Please try again.';
      setPlanError(message);
      if (lastReply) {
        setPlanDescribeReply(lastReply);
      }
    } finally {
      setSendingDescribePlan(false);
    }
  };

  // Meal handlers
  const handleEditMeal = (meal: PlannedMeal | ActualMeal) => {
    setEditingMeal(meal);
    setIsEditingPlanned(meal.isPlanned);
    setMealFormData({
      name: meal.name,
      calories: (meal as ActualMeal).actualCalories?.toString() || meal.calories.toString(),
      type: meal.type,
      description: meal.description || '',
      time: new Date(meal.time).toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
      notes: (meal as ActualMeal).notes || '',
      isPlanned: meal.isPlanned
    });
    setMealDialogOpen(true);
  };

  const handleDeleteMeal = (mealId: string, isPlanned: boolean) => {
    (async () => {
      try {
        if (isPlanned) {
          await apiService.deletePlannedMeal(mealId);
        } else {
          await apiService.deleteMealLog(mealId);
        }
        await fetchLogData();
      } catch (error) {
        console.error('Error deleting meal:', error);
      }
    })();
  };

  const handleSaveMeal = () => {
    if (!mealFormData.name || !mealFormData.calories || !mealFormData.time) return;

    (async () => {
      try {
        const isoDate = toIsoDate(selectedDate);
        const time = new Date(`${isoDate}T${mealFormData.time}:00`);
        const calories = parseInt(mealFormData.calories, 10);

        if (mealFormData.isPlanned) {
          const payload = {
            user_id: user.id,
            date: isoDate,
            name: mealFormData.name,
            calories,
            meal_type: mealFormData.type,
            description: mealFormData.description || null,
            time: time.toISOString(),
          };
          if (editingMeal && editingMeal.isPlanned) {
            await apiService.updatePlannedMeal(editingMeal.id, payload);
          } else {
            await apiService.createPlannedMeal(payload);
          }
        } else {
          const baseDescription = mealFormData.description
            ? `${mealFormData.name} - ${mealFormData.description}`
            : mealFormData.name;
          const userDescription = mealFormData.notes ? `${baseDescription} (Note: ${mealFormData.notes})` : baseDescription;
          const payload = {
            user_id: user.id,
            date: isoDate,
            user_description: userDescription,
            meal_type: mealFormData.type,
            estimated_calories: calories,
            time: time.toISOString(),
          };
          if (editingMeal && !editingMeal.isPlanned) {
            await apiService.updateMealLog(editingMeal.id, payload);
          } else {
            await apiService.createMealLog(payload);
          }
        }

        setMealDialogOpen(false);
        await fetchLogData();
      } catch (error) {
        console.error('Error saving meal:', error);
      }
    })();
  };

  const getMealTypeIcon = (type: PlannedMeal['type'] | ActualMeal['type']) => {
    switch (type) {
      case 'breakfast':
        return '🌅';
      case 'lunch':
        return '🌞';
      case 'dinner':
        return '🌙';
      case 'snack':
        return '🍎';
      default:
        return '🍽️';
    }
  };

  const totalPlannedCalories = plannedMeals.reduce((sum, meal) => sum + meal.calories, 0);
  const totalActualCalories = actualMeals.reduce((sum, meal) => sum + (meal.actualCalories || meal.calories), 0);

  const isToday = selectedDate.toDateString() === new Date().toDateString();
  const isPast = selectedDate < new Date(new Date().setHours(0, 0, 0, 0));
  const isFuture = selectedDate > new Date(new Date().setHours(23, 59, 59, 999));
  const displayedCalories = isFuture ? totalPlannedCalories : totalActualCalories;
  const calorieTarget = Number(user.dailyCalorieTarget || 0);
  const caloriesOver = displayedCalories - calorieTarget;
  const caloriesRemaining = calorieTarget - displayedCalories;
  const progressValue = calorieTarget > 0 ? Math.min((displayedCalories / calorieTarget) * 100, 100) : 0;
  const progressColor = isFuture
    ? theme.palette.info.main
    : caloriesOver > 0
      ? theme.palette.error.main
      : theme.palette.success.main;

  if (loading) {
    return <LinearProgress />;
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', sm: 'center' },
            flexWrap: 'wrap',
            gap: 2,
            mb: 3,
          }}
        >
          <Typography variant="h4" sx={{ typography: { xs: 'h5', sm: 'h4' } }}>
            My Log 📝
          </Typography>
          <Box
            sx={{
              display: 'flex',
              gap: 2,
              alignItems: 'center',
              flexWrap: 'wrap',
              justifyContent: { xs: 'flex-start', sm: 'flex-end' },
              width: { xs: '100%', sm: 'auto' },
            }}
          >
            <DatePicker
              value={selectedDate}
              onChange={handleDateChange}
              slotProps={{
                textField: {
                  size: 'small',
                  sx: { minWidth: { xs: '100%', sm: 240 } },
                  InputProps: {
                    startAdornment: <CalendarToday sx={{ mr: 1, color: 'action.active' }} />
                  }
                }
              }}
            />
            <Chip 
              label={isToday ? 'Today' : isPast ? 'Past' : 'Future'} 
              color={isToday ? 'primary' : isPast ? 'default' : 'success'}
              variant="outlined"
            />
          </Box>
        </Box>

        {/* Summary Cards */}
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, mb: 3 }}>
          <Card sx={{ flex: 1 }}>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 1.5 }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="overline" sx={{ color: 'text.secondary', lineHeight: 1 }}>
                    {isFuture ? 'Planned' : 'Consumed'}
                  </Typography>
                  <Typography variant="h5" sx={{ lineHeight: 1.1 }}>
                    {Math.round(displayedCalories)} / {Math.round(calorieTarget)} kcal
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                    {isFuture
                      ? `${Math.max(0, Math.round(caloriesRemaining))} kcal available to plan`
                      : caloriesOver > 0
                        ? `Over by ${Math.round(caloriesOver)} kcal`
                        : `${Math.max(0, Math.round(caloriesRemaining))} kcal left`}
                  </Typography>
                </Box>

                <Button
                  variant="contained"
                  color={isFuture ? 'info' : 'primary'}
                  onClick={isFuture ? openPlanDialog : openLogDialog}
                  startIcon={<Add />}
                  sx={{ flexShrink: 0 }}
                >
                  {isFuture ? 'Plan' : 'Log'}
                </Button>
              </Box>

              <LinearProgress
                variant="determinate"
                value={progressValue}
                sx={{
                  height: 12,
                  borderRadius: 999,
                  bgcolor: alpha(theme.palette.text.primary, 0.06),
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 999,
                    backgroundColor: progressColor,
                  },
                }}
              />
            </CardContent>
          </Card>
          
          {isFuture && (
            <Card sx={{ flex: 1 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Meals Planned
                </Typography>
                <Typography variant="h4" color="info.main">
                  {plannedMeals.length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  meals planned
                </Typography>
              </CardContent>
            </Card>
          )}
        </Box>

        {/* Meals */}
        <Card>
          <CardContent sx={{ p: 0 }}>
            <Box sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, mb: 2 }}>
                <Typography variant="h6">
                  {isFuture ? 'Planned Meals' : 'Meals'}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {isFuture ? (
                    <Button
                      variant="contained"
                      startIcon={<Add />}
                      onClick={openPlanDialog}
                      sx={{ width: { xs: '100%', sm: 'auto' } }}
                    >
                      Plan Meal
                    </Button>
                  ) : (
                    <Button
                      variant="contained"
                      startIcon={<Add />}
                      onClick={openLogDialog}
                      sx={{ width: { xs: '100%', sm: 'auto' } }}
                    >
                      Log Meal
                    </Button>
                  )}
                </Box>
              </Box>

              {plannedMeals.length === 0 && actualMeals.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <LocalDining sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    {isFuture ? 'No meals planned yet' : 'No meals logged yet'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {isFuture ? 'Start by planning your meals for this day' : 'Start by logging what you ate'}
                  </Typography>
                </Box>
              ) : (
                <List>
                  {(isFuture ? [...plannedMeals] : [...actualMeals, ...plannedMeals])
                    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
                    .map((meal) => (
                    <ListItem
                      key={meal.id}
                      sx={{
                        border: '1px solid',
                        borderColor: meal.isPlanned ? 'primary.main' : 'secondary.main',
                        borderRadius: 1,
                        mb: 1,
                        overflow: 'hidden',
                        alignItems: { xs: 'flex-start', sm: 'center' },
                        gap: 1,
                        flexWrap: { xs: 'wrap', sm: 'nowrap' },
                        '&:last-child': { mb: 0 }
                      }}
                    >
                      <ListItemAvatar sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}>
                        <Avatar sx={{ 
                          bgcolor: meal.isPlanned ? 'primary.light' : 'secondary.light' 
                        }}>
                          {getMealTypeIcon(meal.type)}
                        </Avatar>
                      </ListItemAvatar>
                      
                      <ListItemText
                        sx={{ flex: '1 1 0', minWidth: 0 }}
                        primaryTypographyProps={{ component: 'div' }}
                        secondaryTypographyProps={{ component: 'div' }}
                        primary={
                          <Box
                            sx={{
                              display: 'flex',
                              flexDirection: { xs: 'column', sm: 'row' },
                              alignItems: { xs: 'flex-start', sm: 'center' },
                              gap: 1,
                              minWidth: 0,
                            }}
                          >
                            <Typography
                              variant="subtitle1"
                              fontWeight="bold"
                              sx={{
                                flex: '1 1 auto',
                                minWidth: 0,
                                overflowWrap: 'anywhere',
                                wordBreak: 'break-word',
                                lineHeight: 1.2,
                              }}
                            >
                              {meal.name}
                            </Typography>
                            <Box
                              sx={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                alignItems: 'center',
                                gap: 1,
                                minWidth: 0,
                                maxWidth: '100%',
                                flex: { xs: '1 1 auto', sm: '0 1 auto' },
                              }}
                            >
                              <Chip
                                label={meal.type}
                                size="small"
                                color={meal.isPlanned ? 'primary' : 'secondary'}
                                variant="outlined"
                                sx={{ textTransform: 'capitalize' }}
                              />
                              <Chip
                                label={meal.isPlanned ? 'Planned' : 'Logged'}
                                size="small"
                                color={meal.isPlanned ? 'info' : 'success'}
                                variant="outlined"
                              />
                            </Box>
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              {Math.round((meal as ActualMeal).actualCalories || meal.calories)} calories
                            </Typography>
                            {meal.description && (
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
                              >
                                {meal.description}
                              </Typography>
                            )}
                            {(meal as ActualMeal).notes && (
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ fontStyle: 'italic', overflowWrap: 'anywhere', wordBreak: 'break-word' }}
                              >
                                Note: {(meal as ActualMeal).notes}
                              </Typography>
                            )}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                              <Schedule sx={{ fontSize: 16 }} />
                              <Typography variant="caption" color="text.secondary">
                                {new Date(meal.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                              </Typography>
                            </Box>
                          </Box>
                        }
                      />
                      
                      <Box
                        sx={{
                          display: 'flex',
                          gap: 1,
                          flexShrink: 0,
                          ml: { xs: 0, sm: 'auto' },
                          width: { xs: '100%', sm: 'auto' },
                          justifyContent: { xs: 'flex-end', sm: 'flex-end' },
                        }}
                      >
                        <IconButton
                          size="small"
                          onClick={() => handleEditMeal(meal)}
                        >
                          <Edit />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteMeal(meal.id, meal.isPlanned)}
                        >
                          <Delete />
                        </IconButton>
                      </Box>
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          </CardContent>
        </Card>

        {/* Meal Dialog */}
        <Dialog open={mealDialogOpen} onClose={() => setMealDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>
            {editingMeal ? `Edit ${isEditingPlanned ? 'Planned' : 'Logged'} Meal` : 
             `Add ${isEditingPlanned ? 'Planned' : 'Logged'} Meal`}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              <TextField
                label="Meal Name"
                value={mealFormData.name}
                onChange={(e) => setMealFormData(prev => ({ ...prev, name: e.target.value }))}
                fullWidth
                required
              />
              
              <TextField
                label="Calories"
                type="number"
                value={mealFormData.calories}
                onChange={(e) => setMealFormData(prev => ({ ...prev, calories: e.target.value }))}
                fullWidth
                required
              />
              
              <FormControl fullWidth>
                <InputLabel>Meal Type</InputLabel>
                <Select
                  value={mealFormData.type}
                  label="Meal Type"
                  onChange={(e) => setMealFormData(prev => ({ ...prev, type: e.target.value as PlannedMeal['type'] | ActualMeal['type'] }))}
                >
                  <MenuItem value="breakfast">Breakfast</MenuItem>
                  <MenuItem value="lunch">Lunch</MenuItem>
                  <MenuItem value="dinner">Dinner</MenuItem>
                  <MenuItem value="snack">Snack</MenuItem>
                </Select>
              </FormControl>
              
              <TextField
                label="Description (optional)"
                value={mealFormData.description}
                onChange={(e) => setMealFormData(prev => ({ ...prev, description: e.target.value }))}
                fullWidth
                multiline
                rows={2}
              />
              
              {!isEditingPlanned && (
                <TextField
                  label="Notes (optional)"
                  value={mealFormData.notes}
                  onChange={(e) => setMealFormData(prev => ({ ...prev, notes: e.target.value }))}
                  fullWidth
                  multiline
                  rows={2}
                  placeholder="Any notes about this meal..."
                />
              )}
              
              <TextField
                label="Time"
                type="time"
                value={mealFormData.time}
                onChange={(e) => setMealFormData(prev => ({ ...prev, time: e.target.value }))}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setMealDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveMeal}
              variant="contained"
              disabled={!mealFormData.name || !mealFormData.calories}
            >
              {editingMeal ? 'Update' : 'Add'} Meal
            </Button>
          </DialogActions>
        </Dialog>

        {/* Plan Dialog (Future Days) */}
        <Dialog open={planDialogOpen} onClose={handleClosePlanDialog} maxWidth="xs" fullWidth>
          <DialogTitle>Plan Food ({format(selectedDate, 'EEE M/d')})</DialogTitle>
          <DialogContent sx={{ pt: 1 }}>
            {planError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {planError}
              </Alert>
            )}
            <ToggleButtonGroup
              value={planMode}
              exclusive
              fullWidth
              size="small"
              disabled={planDialogBusy}
              sx={{ mb: 1.5 }}
              onChange={(_, value) => {
                if (!value) return;
                setPlanMode(value);
                setPlanError(null);
                setPlanDescribeReply(null);
              }}
            >
              <ToggleButton value="describe">Describe it</ToggleButton>
              <ToggleButton value="quick">Quick add</ToggleButton>
            </ToggleButtonGroup>

            {planMode === 'quick' ? (
              <>
                <TextField
                  fullWidth
                  margin="dense"
                  label="What do you plan to eat?"
                  value={planForm.description}
                  onChange={(event) => handlePlanInputChange('description', event.target.value)}
                  disabled={planDialogBusy}
                />
                <TextField
                  fullWidth
                  margin="dense"
                  label="Calories"
                  type="number"
                  inputProps={{ min: 0 }}
                  value={planForm.calories}
                  onChange={(event) => handlePlanInputChange('calories', event.target.value)}
                  disabled={planDialogBusy}
                />
                <TextField
                  select
                  fullWidth
                  margin="dense"
                  label="Meal Type"
                  value={planForm.mealType}
                  onChange={(event) => handlePlanInputChange('mealType', event.target.value)}
                  disabled={planDialogBusy}
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
                  label="Describe what you want to eat"
                  placeholder="Example: High protein day with a salad lunch and pasta dinner"
                  value={planDescribeInput}
                  onChange={(event) => setPlanDescribeInput(event.target.value)}
                  multiline
                  minRows={3}
                  disabled={planDialogBusy || Boolean(planDescribeReply)}
                />

                {planDescribeReply && (
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
                        fontFamily:
                          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
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
                    <Markdown>{planDescribeReply}</Markdown>
                  </Box>
                )}
              </>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={handleClosePlanDialog} disabled={planDialogBusy}>
              {planMode === 'describe' && planDescribeReply ? 'Close' : 'Cancel'}
            </Button>
            {planMode === 'quick' ? (
              <Button variant="contained" onClick={handleSaveMealPlan} disabled={planDialogBusy}>
                {savingQuickPlan ? 'Saving...' : 'Plan Meal'}
              </Button>
            ) : (
              <Button
                variant="contained"
                onClick={handleDescribeMealPlan}
                disabled={planDialogBusy || Boolean(planDescribeReply)}
              >
                {sendingDescribePlan ? 'Sending...' : 'Send to AI'}
              </Button>
            )}
          </DialogActions>
        </Dialog>

        {/* Dashboard-style Log Dialog */}
        <Dialog open={logDialogOpen} onClose={handleCloseLogDialog} maxWidth="xs" fullWidth>
          <DialogTitle>Log Food ({isToday ? 'Today' : format(selectedDate, 'EEE M/d')})</DialogTitle>
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
              <ToggleButton value="describe">Describe it</ToggleButton>
              <ToggleButton value="quick">Quick add</ToggleButton>
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
                  onChange={(event) => {
                    setDescribeInput(event.target.value);
                    if (describeReply) setDescribeReply(null);
                    if (logError) setLogError(null);
                  }}
                  multiline
                  minRows={3}
                  disabled={dialogBusy}
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
                disabled={dialogBusy || !describeInput.trim()}
              >
                {sendingDescribeLog ? 'Sending...' : 'Send to AI'}
              </Button>
            )}
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default Log;
