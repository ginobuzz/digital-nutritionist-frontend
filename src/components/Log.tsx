import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Snackbar,
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
  CalendarToday,
} from '@mui/icons-material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { addDays, format, isAfter, isBefore, isValid, parseISO, startOfDay, startOfWeek } from 'date-fns';
import { ActualMeal, User } from '../types';
import { apiService, isUserNotFoundError, MealLogResponse } from '../services/api';
import { triggerSubmitHaptic, triggerSuccessHaptic } from '../services/haptics';
import { useSearchParams } from 'react-router-dom';
import { imageFileToDataUrl } from '../utils/images';
import { calculateDynamicWeeklyCalorieTargets, getMinimumHealthyDailyCalories } from '../utils/weeklyTargets';
import { resolveLockedTodayTarget } from '../utils/dailyTargetLock';
import { useSpeechToText } from '../hooks/useSpeechToText';
import { formatVoiceInputError, getUserFacingErrorMessage } from '../utils/errors';
import MealLogInput from './MealLogInput';
import {
  normalizeWidgetLogAction,
  syncWidgetDailyProgress,
  WIDGET_DEEP_LINK_ACTION_QUERY_KEY,
  WIDGET_DEEP_LINK_DATE_QUERY_KEY,
  WIDGET_DEEP_LINK_SOURCE_QUERY_KEY,
  WIDGET_DEEP_LINK_SOURCE_VALUE,
} from '../services/widgetBridge';

const toIsoDate = (d: Date) => format(d, 'yyyy-MM-dd');
type MealType = '' | 'breakfast' | 'lunch' | 'dinner' | 'snack';

const normalizeMealType = (value: string | null | undefined): ActualMeal['type'] => {
  const v = (value || '').toLowerCase();
  if (v === 'breakfast' || v === 'lunch' || v === 'dinner' || v === 'snack') return v;
  return 'snack';
};

const parseBackendDateTime = (value: string): Date => {
  const hasTimeZone = /[zZ]|[+-]\d{2}:\d{2}$/.test(value);
  return new Date(hasTimeZone ? value : `${value}Z`);
};

const mapMealLogToActualMeal = (log: MealLogResponse): ActualMeal => {
  const createdAt = log.created_at
    ? parseBackendDateTime(log.created_at)
    : new Date(`${log.date}T12:00:00`);
  const calories = typeof log.estimated_calories === 'number' ? log.estimated_calories : 0;
  const userDescription = log.user_description || 'Meal';
  return {
    id: String(log.id),
    name: userDescription,
    calories,
    actualCalories: calories || undefined,
    proteinGrams: typeof log.protein_g === 'number' ? log.protein_g : undefined,
    carbsGrams: typeof log.carbs_g === 'number' ? log.carbs_g : undefined,
    fatGrams: typeof log.fat_g === 'number' ? log.fat_g : undefined,
    type: normalizeMealType(log.meal_type),
    time: createdAt,
    isPlanned: false,
  };
};

interface LogProps {
  user: User;
}

const Log: React.FC<LogProps> = ({ user }) => {
  const theme = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const describeFieldRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const describePhotoInputRef = useRef<HTMLInputElement | null>(null);
  const handledWidgetActionRef = useRef<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [actualMeals, setActualMeals] = useState<ActualMeal[]>([]);
  const [weeklyTargetsByDate, setWeeklyTargetsByDate] = useState<Record<string, number>>({});
  const [weeklyOverBudgetBy, setWeeklyOverBudgetBy] = useState(0);
  const [loading, setLoading] = useState(true);
  const [mealDialogOpen, setMealDialogOpen] = useState(false);
  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [describeInput, setDescribeInput] = useState('');
  const [mealType, setMealType] = useState<MealType>('');
  const [describeReply, setDescribeReply] = useState<string | null>(null);
  const [describeImageDataUrl, setDescribeImageDataUrl] = useState<string | null>(null);
  const [logError, setLogError] = useState<string | null>(null);
  const [sendingDescribeLog, setSendingDescribeLog] = useState(false);
  const [logDictationBaseText, setLogDictationBaseText] = useState('');
  const [logVoiceError, setLogVoiceError] = useState<string | null>(null);
  const [editingMeal, setEditingMeal] = useState<ActualMeal | null>(null);
  const [deleteToast, setDeleteToast] = useState<{
    message: string;
    severity: 'success' | 'error';
  }>({ message: '', severity: 'success' });
  const [deleteToastOpen, setDeleteToastOpen] = useState(false);
  const [mealFormData, setMealFormData] = useState({
    name: '',
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
    type: 'breakfast' as ActualMeal['type'],
    description: '',
    time: '',
    notes: '',
  });

  const {
    supported: logVoiceSupported,
    isListening: logVoiceListening,
    interimTranscript: logInterimTranscript,
    finalTranscript: logFinalTranscript,
    error: logVoiceRawError,
    start: startLogVoice,
    stop: stopLogVoice,
    reset: resetLogVoice,
  } = useSpeechToText({ lang: 'en-US', continuous: false, interimResults: true });


  useEffect(() => {
    const transcript = [logFinalTranscript, logInterimTranscript].filter(Boolean).join(' ').trim();
    if (!logDictationBaseText && !transcript) return;

    const needsSpace = logDictationBaseText.length > 0 && !/\s$/.test(logDictationBaseText);
    setDescribeInput(`${logDictationBaseText}${needsSpace && transcript ? ' ' : ''}${transcript}`);
  }, [logDictationBaseText, logFinalTranscript, logInterimTranscript]);

  useEffect(() => {
    if (!logVoiceRawError) return;
    setLogVoiceError(formatVoiceInputError(logVoiceRawError));
  }, [logVoiceRawError]);


  const handleToggleLogVoice = useCallback(() => {
    setLogVoiceError(null);

    if (!logVoiceSupported) {
      setLogVoiceError(formatVoiceInputError('unsupported'));
      return;
    }

    if (logVoiceListening) {
      stopLogVoice();
      return;
    }

    resetLogVoice();
    setLogDictationBaseText(describeInput);
    if (describeReply) setDescribeReply(null);
    if (logError) setLogError(null);
    startLogVoice();
  }, [
    describeInput,
    describeReply,
    logError,
    logVoiceListening,
    logVoiceSupported,
    resetLogVoice,
    startLogVoice,
    stopLogVoice,
  ]);


  const fetchLogData = useCallback(async () => {
    try {
      setLoading(true);
      const selectedDay = startOfDay(selectedDate);
      const selectedKey = toIsoDate(selectedDay);
      const weekStart = startOfWeek(selectedDay, { weekStartsOn: 0 }); // Sunday
      const weekEnd = addDays(weekStart, 6);
      const today = startOfDay(new Date());
      const isCurrentWeek = !isBefore(today, weekStart) && !isAfter(today, weekEnd);
      const anchorDate = isBefore(today, weekStart)
        ? weekStart
        : isAfter(today, weekEnd)
          ? addDays(weekEnd, 1)
          : addDays(today, 1);

      const actualWeek = await apiService.getMealLogs({ userId: user.id, start: weekStart, end: weekEnd });

      setActualMeals(actualWeek.filter((log) => log.date === selectedKey).map(mapMealLogToActualMeal));

      const actualCaloriesByDate: Record<string, number> = {};
      for (const log of actualWeek) {
        const key = log.date;
        const cals = Number(log.estimated_calories || 0);
        actualCaloriesByDate[key] = (actualCaloriesByDate[key] || 0) + cals;
      }

      const plannedCaloriesByDate: Record<string, number> = {};

      const minDailyTarget = getMinimumHealthyDailyCalories(user.gender);
      let lockedTodayTarget: number | null = null;

      if (isCurrentWeek) {
        lockedTodayTarget = resolveLockedTodayTarget({
          userId: user.id,
          today,
          weekStart,
          dailyTarget: user.dailyCalorieTarget,
          minDailyTarget,
          actualCaloriesByDate,
          plannedCaloriesByDate,
        });
      }

      const dynamicWeek = calculateDynamicWeeklyCalorieTargets({
        weekStart,
        dailyTarget: user.dailyCalorieTarget,
        minDailyTarget,
        anchorDate,
        actualCaloriesByDate,
        plannedCaloriesByDate,
      });

      const nextWeeklyTargetsByDate = isCurrentWeek && lockedTodayTarget != null
        ? { ...dynamicWeek.targetsByDate, [toIsoDate(today)]: Math.round(lockedTodayTarget) }
        : dynamicWeek.targetsByDate;

      setWeeklyTargetsByDate(nextWeeklyTargetsByDate);
      setWeeklyOverBudgetBy(Math.round(dynamicWeek.overBudgetBy));

      if (isCurrentWeek) {
        const todayKey = toIsoDate(today);
        const consumedCalories = Math.round(actualCaloriesByDate[todayKey] || 0);
        const targetCalories = Math.max(
          0,
          Math.round(nextWeeklyTargetsByDate[todayKey] ?? Number(user.dailyCalorieTarget || 0))
        );
        void syncWidgetDailyProgress({ consumedCalories, targetCalories, dateKey: todayKey });
      }
    } catch (error) {
      console.error('Error fetching log data:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, user.dailyCalorieTarget, user.gender, user.id]);

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

  const dialogBusy = sendingDescribeLog;
  const selectedKey = toIsoDate(selectedDate);

  const openLogDialog = useCallback((targetDate?: Date) => {
    if (targetDate && toIsoDate(targetDate) !== toIsoDate(selectedDate)) {
      setSelectedDate(targetDate);
    }
    stopLogVoice();
    resetLogVoice();
    setLogDictationBaseText('');
    setLogVoiceError(null);
    setLogError(null);
    setDescribeReply(null);
    setDescribeImageDataUrl(null);
    setDescribeInput('');
    setMealType('');
    setLogDialogOpen(true);
  }, [resetLogVoice, selectedDate, stopLogVoice]);

  useEffect(() => {
    const source = searchParams.get(WIDGET_DEEP_LINK_SOURCE_QUERY_KEY);
    if (source !== WIDGET_DEEP_LINK_SOURCE_VALUE) return;

    const action = normalizeWidgetLogAction(searchParams.get(WIDGET_DEEP_LINK_ACTION_QUERY_KEY));
    if (!action) return;

    const dateParam = searchParams.get(WIDGET_DEEP_LINK_DATE_QUERY_KEY);
    const parsed = dateParam ? parseISO(dateParam) : new Date();
    const targetDate = isValid(parsed) ? startOfDay(parsed) : startOfDay(new Date());
    const actionKey = `${action}:${toIsoDate(targetDate)}`;

    if (handledWidgetActionRef.current === actionKey) return;
    handledWidgetActionRef.current = actionKey;

    openLogDialog(targetDate);

    if (action === 'voice') {
      window.setTimeout(() => {
        handleToggleLogVoice();
      }, 180);
    } else if (action === 'camera') {
      window.setTimeout(() => {
        try {
          describePhotoInputRef.current?.click();
        } catch {
          setLogError('Tap Add photo to open the camera.');
        }
      }, 180);
    } else {
      window.setTimeout(() => {
        describeFieldRef.current?.focus();
      }, 120);
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete(WIDGET_DEEP_LINK_SOURCE_QUERY_KEY);
    nextParams.delete(WIDGET_DEEP_LINK_ACTION_QUERY_KEY);
    setSearchParams(nextParams, { replace: true });
  }, [handleToggleLogVoice, openLogDialog, searchParams, setSearchParams]);


  const handleCloseLogDialog = () => {
    if (!dialogBusy) {
      stopLogVoice();
      setLogDialogOpen(false);
      setLogError(null);
      setLogVoiceError(null);
    }
  };


  const handleDescribeMealLog = async () => {
    if (!describeInput.trim() && !describeImageDataUrl) {
      setLogError('Add a description or meal photo to log it.');
      return;
    }

    try {
      setSendingDescribeLog(true);
      setLogError(null);
      setDescribeReply(null);
      void triggerSubmitHaptic();
      const prompt = [
        `Please log what I consumed on ${selectedKey}.`,
        ...(mealType ? [`Meal type: ${mealType}.`] : []),
        describeImageDataUrl ? `A meal photo is attached. Use it to identify foods and portions.` : null,
        `If details are missing, make reasonable assumptions and estimate calories (integer) rather than asking follow-up questions.`,
        `Also estimate macros in grams (protein, carbs, fat).`,
        ``,
        describeInput.trim() || '(No additional text — use the meal photo.)',
      ].join('\n');

      const response = await apiService.chat({
        message: prompt,
        user_id: user.id,
        client_local_date: toIsoDate(new Date()),
        client_time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        image_data_url: describeImageDataUrl ?? undefined,
      });

      void triggerSuccessHaptic();
      setDescribeReply(response.reply || 'OK.');
      setDescribeImageDataUrl(null);
      await fetchLogData();
    } catch (error) {
      if (isUserNotFoundError(error)) {
        return;
      }
      setLogError(
        getUserFacingErrorMessage(error, {
          action: 'log that meal',
          fallback: 'We couldn’t log that meal. Please try again.',
        })
      );
    } finally {
      setSendingDescribeLog(false);
    }
  };

  const handleAttachDescribeImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const dataUrl = await imageFileToDataUrl(file);
      setDescribeImageDataUrl(dataUrl);
      setLogError(null);
      if (describeReply) setDescribeReply(null);
    } catch (error) {
      console.error('Unable to attach image:', error);
      setLogError('We couldn’t read that photo. Try a different image.');
    }
  };

  // Meal handlers
  const handleEditMeal = (meal: ActualMeal) => {
    setEditingMeal(meal);
    setMealFormData({
      name: meal.name,
      calories: (meal.actualCalories || meal.calories).toString(),
      protein: meal.proteinGrams?.toString() || '',
      carbs: meal.carbsGrams?.toString() || '',
      fat: meal.fatGrams?.toString() || '',
      type: meal.type,
      description: meal.description || '',
      time: new Date(meal.time).toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      }),
      notes: meal.notes || '',
    });
    setMealDialogOpen(true);
  };

  const handleDeleteMeal = async (meal: ActualMeal) => {
    void triggerSubmitHaptic();

    try {
      await apiService.deleteMealLog(meal.id);
      await fetchLogData();
      setDeleteToast({
        message: `${meal.name} deleted.`,
        severity: 'success',
      });
      setDeleteToastOpen(true);
    } catch (error) {
      if (isUserNotFoundError(error)) {
        return;
      }
      console.error('Error deleting meal:', error);
      setDeleteToast({
        message: 'We couldn’t delete that meal. Please try again.',
        severity: 'error',
      });
      setDeleteToastOpen(true);
    }
  };

  const handleSaveMeal = () => {
    if (!mealFormData.name || !mealFormData.calories || !mealFormData.time) return;

    (async () => {
      try {
        const isoDate = toIsoDate(selectedDate);
        const time = new Date(`${isoDate}T${mealFormData.time}:00`);
        const calories = parseInt(mealFormData.calories, 10);
        const parseOptionalMacroGrams = (raw: string): number | null => {
          const trimmed = raw.trim();
          if (!trimmed) return null;
          const value = Number(trimmed);
          if (!Number.isFinite(value)) return null;
          return Math.max(0, Math.min(500, value));
        };

        const baseDescription = mealFormData.description
          ? `${mealFormData.name} - ${mealFormData.description}`
          : mealFormData.name;
        const userDescription = mealFormData.notes ? `${baseDescription} (Note: ${mealFormData.notes})` : baseDescription;
        const protein = parseOptionalMacroGrams(mealFormData.protein);
        const carbs = parseOptionalMacroGrams(mealFormData.carbs);
        const fat = parseOptionalMacroGrams(mealFormData.fat);
        if (editingMeal) {
          await apiService.updateMealLog(editingMeal.id, {
            user_description: userDescription,
            meal_type: mealFormData.type,
            estimated_calories: calories,
            protein_g: protein,
            carbs_g: carbs,
            fat_g: fat,
            time: time.toISOString(),
          });
        } else {
          await apiService.createMealLog({
              user_id: user.id,
              date: isoDate,
              user_description: userDescription,
              meal_type: mealFormData.type,
              estimated_calories: calories,
              protein_g: protein,
              carbs_g: carbs,
              fat_g: fat,
              time: time.toISOString(),
            });
        }

        setMealDialogOpen(false);
        await fetchLogData();
      } catch (error) {
        if (isUserNotFoundError(error)) {
          return;
        }
        console.error('Error saving meal:', error);
        setDeleteToast({
          message: getUserFacingErrorMessage(error, {
            action: 'save that meal',
            fallback: 'We couldn’t save that meal. Please try again.',
          }),
          severity: 'error',
        });
        setDeleteToastOpen(true);
      }
    })();
  };

  const getMealTypeIcon = (type: ActualMeal['type']) => {
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

  const totalActualCalories = actualMeals.reduce((sum, meal) => sum + (meal.actualCalories || meal.calories), 0);
  const macroTotals = actualMeals.reduce(
    (totals, meal) => ({
      protein: totals.protein + (meal.proteinGrams || 0),
      carbs: totals.carbs + (meal.carbsGrams || 0),
      fat: totals.fat + (meal.fatGrams || 0),
    }),
    { protein: 0, carbs: 0, fat: 0 }
  );
  const mealsWithAnyMacros = actualMeals.filter(
    (meal) => meal.proteinGrams != null || meal.carbsGrams != null || meal.fatGrams != null
  ).length;
  const mealsMissingMacros = Math.max(0, actualMeals.length - mealsWithAnyMacros);
  const hasAnyMacros = mealsWithAnyMacros > 0;

  const isToday = selectedDate.toDateString() === new Date().toDateString();
  const isPast = selectedDate < new Date(new Date().setHours(0, 0, 0, 0));
  const isFuture = selectedDate > new Date(new Date().setHours(23, 59, 59, 999));
  const displayedCalories = totalActualCalories;
  const baseCalorieTarget = Number(user.dailyCalorieTarget || 0);
  const calorieTarget = weeklyTargetsByDate[selectedKey] ?? baseCalorieTarget;
  const roundedBaseTarget = Math.round(baseCalorieTarget);
  const roundedTarget = Math.round(calorieTarget);
  const selectedAdjustment = roundedTarget - roundedBaseTarget;
  const hasWeekRebalance =
    Object.keys(weeklyTargetsByDate).length > 0 &&
    Object.values(weeklyTargetsByDate).some((value) => Math.round(value) !== roundedBaseTarget);
  const caloriesOver = displayedCalories - calorieTarget;
  const caloriesRemaining = calorieTarget - displayedCalories;
  const progressValue = calorieTarget > 0 ? Math.min((displayedCalories / calorieTarget) * 100, 100) : 0;
  const progressColor = caloriesOver > 0 ? theme.palette.error.main : theme.palette.success.main;

  if (loading) {
    return <LinearProgress />;
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 2,
            mb: 3,
          }}
        >
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
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="overline" sx={{ color: 'text.secondary', lineHeight: 1 }}>
                    Consumed
                  </Typography>
                  <Typography variant="h5" sx={{ lineHeight: 1.1 }}>
                    {Math.round(displayedCalories)} / {Math.round(calorieTarget)} kcal
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                    {caloriesOver > 0
                    ? `Over by ${Math.round(caloriesOver)} kcal`
                    : `${Math.max(0, Math.round(caloriesRemaining))} kcal left`}
                  </Typography>
                </Box>
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

              {hasWeekRebalance && (
                <Box sx={{ mt: 1.25, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Chip
                    size="small"
                    variant="outlined"
                    color={weeklyOverBudgetBy > 0 ? 'warning' : 'info'}
                    label={weeklyOverBudgetBy > 0 ? 'Week Over Budget' : 'Week Rebalanced'}
                  />
	                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
	                    {weeklyOverBudgetBy > 0
	                      ? `Not enough adjustable days to stay under weekly budget; week is ${weeklyOverBudgetBy} kcal over.`
	                      : isFuture && selectedAdjustment !== 0
	                        ? `This day's budget adjusted ${selectedAdjustment > 0 ? `+${selectedAdjustment}` : selectedAdjustment} kcal vs base (${roundedBaseTarget}).`
	                        : 'Adjusted remaining daily budgets for this week.'}
	                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>

          <Card sx={{ flex: 1 }}>
              <CardContent sx={{ p: 2.5 }}>
                <Typography variant="overline" sx={{ color: 'text.secondary', lineHeight: 1 }}>
                  Macros
                </Typography>
                <Box
                  sx={{
                    mt: 1,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                    gap: 1.5,
                  }}
                >
                  {[
                    { label: 'Protein', value: hasAnyMacros ? `${Math.round(macroTotals.protein)}g` : '—' },
                    { label: 'Carbs', value: hasAnyMacros ? `${Math.round(macroTotals.carbs)}g` : '—' },
                    { label: 'Fat', value: hasAnyMacros ? `${Math.round(macroTotals.fat)}g` : '—' },
                  ].map((item) => (
                    <Box key={item.label} sx={{ minWidth: 0 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 800 }}>
                        {item.label}
                      </Typography>
                      <Typography variant="h6" sx={{ lineHeight: 1.2 }}>
                        {item.value}
                      </Typography>
                    </Box>
                  ))}
                </Box>

                {mealsMissingMacros > 0 && (
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
                    {mealsMissingMacros} meal{mealsMissingMacros === 1 ? '' : 's'} missing macros
                  </Typography>
                )}
              </CardContent>
          </Card>
        </Box>

        {/* Meals */}
        <Card>
          <CardContent sx={{ p: 0 }}>
            <Box sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, mb: 2 }}>
                <Typography variant="h6">
                  Meals
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={() => openLogDialog()}
                    sx={{ width: { xs: '100%', sm: 'auto' } }}
                  >
                    Log Meal
                  </Button>
                </Box>
              </Box>

              {actualMeals.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <LocalDining sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    No meals logged yet
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Start by logging what you ate
                  </Typography>
                </Box>
              ) : (
                <List>
                  {[...actualMeals]
                    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
                    .map((meal) => (
                    <ListItem
                      key={meal.id}
                      sx={{
                        border: '1px solid',
                        borderColor: 'divider',
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
                          bgcolor: 'secondary.light' 
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
                                color="secondary"
                                variant="outlined"
                                sx={{ textTransform: 'capitalize' }}
                              />

                            </Box>
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              {Math.round((meal as ActualMeal).actualCalories || meal.calories)} calories
                            </Typography>
                            {(((meal as ActualMeal).proteinGrams != null) ||
                                ((meal as ActualMeal).carbsGrams != null) ||
                                ((meal as ActualMeal).fatGrams != null)) && (
                                <Typography variant="body2" color="text.secondary">
                                  Macros:{' '}
                                  {`P ${
                                    (meal as ActualMeal).proteinGrams != null
                                      ? `${Math.round((meal as ActualMeal).proteinGrams!)}g`
                                      : '—'
                                  } • C ${
                                    (meal as ActualMeal).carbsGrams != null
                                      ? `${Math.round((meal as ActualMeal).carbsGrams!)}g`
                                      : '—'
                                  } • F ${
                                    (meal as ActualMeal).fatGrams != null
                                      ? `${Math.round((meal as ActualMeal).fatGrams!)}g`
                                      : '—'
                                  }`}
                                </Typography>
                              )}
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
                          onClick={() => handleDeleteMeal(meal)}
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

        {/* Log Dialog */}
        <Dialog open={logDialogOpen} onClose={handleCloseLogDialog} maxWidth="sm" fullWidth>
          <DialogTitle>
            Log Meal — {format(selectedDate, 'EEEE, MMM d')}
          </DialogTitle>
          <DialogContent>
            {logError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {logError}
              </Alert>
            )}
            <MealLogInput
              value={describeInput}
              onChange={(v) => {
                setDescribeInput(v);
                if (describeReply) setDescribeReply(null);
                if (logError) setLogError(null);
              }}
              onSubmit={() => void handleDescribeMealLog()}
              imageDataUrl={describeImageDataUrl}
              onImageRemove={() => setDescribeImageDataUrl(null)}
              onImageAttach={handleAttachDescribeImage}
              mealType={mealType}
              onMealTypeChange={setMealType}
              voiceListening={logVoiceListening}
              voiceError={logVoiceError}
              onVoiceToggle={handleToggleLogVoice}
              busy={dialogBusy}
              reply={describeReply}
              inputRef={describeFieldRef}
              photoInputRef={describePhotoInputRef}
              radioGroupName="log-meal-type"
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseLogDialog} disabled={dialogBusy}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleDescribeMealLog()}
              variant="contained"
              disabled={dialogBusy || logVoiceListening || (!describeInput.trim() && !describeImageDataUrl)}
            >
              {dialogBusy ? 'Logging…' : 'Log Meal'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Meal Dialog */}
        <Dialog open={mealDialogOpen} onClose={() => setMealDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>
            {editingMeal ? 'Edit Meal' : 'Add Meal'}
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

              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
                  <TextField
                    label="Protein (g)"
                    type="number"
                    inputProps={{ min: 0, step: 1 }}
                    value={mealFormData.protein}
                    onChange={(e) => setMealFormData(prev => ({ ...prev, protein: e.target.value }))}
                    fullWidth
                  />
                  <TextField
                    label="Carbs (g)"
                    type="number"
                    inputProps={{ min: 0, step: 1 }}
                    value={mealFormData.carbs}
                    onChange={(e) => setMealFormData(prev => ({ ...prev, carbs: e.target.value }))}
                    fullWidth
                  />
                  <TextField
                    label="Fat (g)"
                    type="number"
                    inputProps={{ min: 0, step: 1 }}
                    value={mealFormData.fat}
                    onChange={(e) => setMealFormData(prev => ({ ...prev, fat: e.target.value }))}
                    fullWidth
                  />
                </Box>
              
              <FormControl fullWidth>
                <InputLabel>Meal Type</InputLabel>
                <Select
                  value={mealFormData.type}
                  label="Meal Type"
                  onChange={(e) => setMealFormData(prev => ({ ...prev, type: e.target.value as ActualMeal['type'] }))}
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
              
              <TextField
                  label="Notes (optional)"
                  value={mealFormData.notes}
                  onChange={(e) => setMealFormData(prev => ({ ...prev, notes: e.target.value }))}
                  fullWidth
                  multiline
                  rows={2}
                  placeholder="Any notes about this meal..."
                />
              
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

        <Snackbar
          open={deleteToastOpen}
          autoHideDuration={4000}
          onClose={() => setDeleteToastOpen(false)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            severity={deleteToast.severity}
            sx={{ width: '100%' }}
            onClose={() => setDeleteToastOpen(false)}
          >
            {deleteToast.message}
          </Alert>
        </Snackbar>

      </Box>
    </LocalizationProvider>
  );
};

export default Log;
