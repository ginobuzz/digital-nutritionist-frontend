import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box,
  Typography,
  LinearProgress,
  Card,
  CardContent,
  Chip,
  Button,
  TextField,
  Alert,
  ToggleButton,
  ToggleButtonGroup,
  FormControlLabel,
  Radio,
  RadioGroup,
  IconButton,
  Tooltip,
  useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import TodayRoundedIcon from '@mui/icons-material/TodayRounded';
import PhotoCameraRoundedIcon from '@mui/icons-material/PhotoCameraRounded';
import MicRoundedIcon from '@mui/icons-material/MicRounded';
import StopCircleRoundedIcon from '@mui/icons-material/StopCircleRounded';
import { useNavigate } from 'react-router-dom';
import { addDays, format, isBefore, isSameDay, startOfDay, startOfWeek } from 'date-fns';
import Markdown from 'markdown-to-jsx';
import { User } from '../types';
import { apiService, isUserNotFoundError } from '../services/api';
import { imageFileToDataUrl } from '../utils/images';
import { calculateDynamicWeeklyCalorieTargets, getMinimumHealthyDailyCalories } from '../utils/weeklyTargets';
import { useSpeechToText } from '../hooks/useSpeechToText';

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

type MealType = '' | 'breakfast' | 'lunch' | 'dinner' | 'snack';

const WEEK_LENGTH_DAYS = 7;
const toIsoDate = (d: Date) => format(d, 'yyyy-MM-dd');

const Dashboard: React.FC<DashboardProps> = ({ user, onNavigateToChat }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const quickLogSectionRef = useRef<HTMLDivElement | null>(null);
  const describeFieldRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const quickDescriptionFieldRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [dayEntries, setDayEntries] = useState<DayEntry[]>([]);
  const [actualCaloriesByDate, setActualCaloriesByDate] = useState<Record<string, number>>({});
  const [plannedCaloriesByDate, setPlannedCaloriesByDate] = useState<Record<string, number>>({});
  const [logMode, setLogMode] = useState<'quick' | 'describe'>('describe');
  const [logForm, setLogForm] = useState({
    description: '',
    calories: '',
  });
  const [mealType, setMealType] = useState<MealType>('');
  const [describeInput, setDescribeInput] = useState('');
  const [describeReply, setDescribeReply] = useState<string | null>(null);
  const [describeImageDataUrl, setDescribeImageDataUrl] = useState<string | null>(null);
  const [logError, setLogError] = useState<string | null>(null);
  const [savingQuickLog, setSavingQuickLog] = useState(false);
  const [sendingDescribeLog, setSendingDescribeLog] = useState(false);
  const [describeDictationBaseText, setDescribeDictationBaseText] = useState('');
  const [describeVoiceError, setDescribeVoiceError] = useState<string | null>(null);

  const {
    supported: describeVoiceSupported,
    isListening: describeVoiceListening,
    interimTranscript: describeInterimTranscript,
    finalTranscript: describeFinalTranscript,
    error: describeVoiceRawError,
    start: startDescribeVoice,
    stop: stopDescribeVoice,
    reset: resetDescribeVoice,
  } = useSpeechToText({ lang: 'en-US', continuous: false, interimResults: true });

  useEffect(() => {
    const transcript = [describeFinalTranscript, describeInterimTranscript].filter(Boolean).join(' ').trim();
    if (!describeDictationBaseText && !transcript) return;

    const needsSpace = describeDictationBaseText.length > 0 && !/\s$/.test(describeDictationBaseText);
    setDescribeInput(`${describeDictationBaseText}${needsSpace && transcript ? ' ' : ''}${transcript}`);
  }, [describeDictationBaseText, describeFinalTranscript, describeInterimTranscript]);

  useEffect(() => {
    if (!describeVoiceRawError) return;

    if (describeVoiceRawError === 'unsupported') {
      setDescribeVoiceError('Voice input isn’t supported in this browser.');
      return;
    }

    switch (describeVoiceRawError) {
      case 'not-allowed':
      case 'service-not-allowed':
        setDescribeVoiceError('Microphone permission blocked. Enable it in your browser settings.');
        return;
      case 'no-speech':
        setDescribeVoiceError('No speech detected. Try again.');
        return;
      case 'audio-capture':
        setDescribeVoiceError('No microphone detected.');
        return;
      case 'network':
        setDescribeVoiceError('Network error while using voice input.');
        return;
      case 'language-not-supported':
        setDescribeVoiceError('Language not supported for voice input.');
        return;
      default:
        setDescribeVoiceError(`Voice input error: ${describeVoiceRawError}`);
    }
  }, [describeVoiceRawError]);

  const handleToggleDescribeVoice = () => {
    setDescribeVoiceError(null);

    if (!describeVoiceSupported) {
      setDescribeVoiceError('Voice input isn’t supported in this browser.');
      return;
    }

    if (describeVoiceListening) {
      stopDescribeVoice();
      return;
    }

    resetDescribeVoice();
    setDescribeDictationBaseText(describeInput);
    if (describeReply) setDescribeReply(null);
    if (logError) setLogError(null);
    startDescribeVoice();
  };

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
      const weekStart = startOfWeek(today, { weekStartsOn: 0 }); // Sunday
      const weekEnd = addDays(weekStart, WEEK_LENGTH_DAYS - 1);

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
        const date = addDays(weekStart, idx);
        const key = toIsoDate(date);
        const kind: DayKind = isSameDay(date, today) ? 'today' : isBefore(date, today) ? 'past' : 'future';
        const label = format(date, 'EEEE M/d');
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

  const today = startOfDay(new Date());
  const weekStart = startOfWeek(today, { weekStartsOn: 0 }); // Sunday
  const selectedDay = today;
  const selectedKey = toIsoDate(selectedDay);
  const isSelectedPast = isBefore(selectedDay, today);
  const isSelectedToday = isSameDay(selectedDay, today);
  const isSelectedFuture = false;

  const selectedActualCalories = Math.round(actualCaloriesByDate[selectedKey] || 0);
  const selectedPlannedCalories = Math.round(plannedCaloriesByDate[selectedKey] || 0);
  const selectedDisplayedCalories = isSelectedFuture ? selectedPlannedCalories : selectedActualCalories;

  const baseDailyTarget = Math.round(user.dailyCalorieTarget || 0);
  const minHealthyDailyTarget = getMinimumHealthyDailyCalories(user.gender);
  const dynamicWeek = useMemo(() => {
    return calculateDynamicWeeklyCalorieTargets({
      weekStart,
      dailyTarget: baseDailyTarget,
      minDailyTarget: minHealthyDailyTarget,
      anchorDate: addDays(today, 1),
      actualCaloriesByDate,
      plannedCaloriesByDate,
    });
  }, [actualCaloriesByDate, baseDailyTarget, minHealthyDailyTarget, plannedCaloriesByDate, today, weekStart]);

  const dynamicTargetsByDate = dynamicWeek.targetsByDate;
  const selectedTargetCalories = dynamicTargetsByDate[selectedKey] ?? baseDailyTarget;
  const hasFutureAdjustments = useMemo(() => {
    return dayEntries.some((entry) => {
      if (entry.kind !== 'future') return false;
      const targetCalories = dynamicTargetsByDate[entry.key] ?? baseDailyTarget;
      return targetCalories !== baseDailyTarget;
    });
  }, [baseDailyTarget, dayEntries, dynamicTargetsByDate]);
  const showRebalanceNotice = hasFutureAdjustments || dynamicWeek.overBudgetBy > 0;

  const getDayColor = (entry: DayEntry, targetCalories: number) => {
    if (entry.kind === 'future') return theme.palette.info.main;
    if (entry.kind === 'past') {
      const hasLogged = entry.actualCalories > 0;
      if (!hasLogged) return theme.palette.grey[500];
      const isOver = entry.actualCalories > targetCalories;
      return alpha(isOver ? theme.palette.error.main : theme.palette.success.main, 0.75);
    }
    // today
    return entry.actualCalories > targetCalories ? theme.palette.error.main : theme.palette.success.main;
  };

  const getDayChipLabel = (entry: DayEntry, targetCalories: number) => {
    if (entry.kind === 'past') {
      const hasLogged = entry.actualCalories > 0;
      if (!hasLogged) return 'Log';
      return entry.actualCalories > targetCalories ? 'Over Budget' : 'Under Budget';
    }
    if (entry.kind === 'future') return entry.plannedCalories > 0 ? 'Planned' : 'Plan';
    return entry.actualCalories > targetCalories ? 'Over Budget' : 'On Track';
  };

  const getDayIcon = (entry: DayEntry, targetCalories: number) => {
    if (entry.kind === 'past') {
      const hasLogged = entry.actualCalories > 0;
      if (!hasLogged) return <AddRoundedIcon fontSize="small" />;
      return entry.actualCalories > targetCalories
        ? <CloseRoundedIcon fontSize="small" />
        : <CheckRoundedIcon fontSize="small" />;
    }
    if (entry.kind === 'future') return <AddRoundedIcon fontSize="small" />;
    return entry.actualCalories > targetCalories
      ? <CloseRoundedIcon fontSize="small" />
      : <CheckRoundedIcon fontSize="small" />;
  };

  const handleLogInputChange = (field: 'description' | 'calories', value: string) => {
    setLogForm(prev => ({ ...prev, [field]: value }));
  };

  const focusLogInput = useCallback((mode: 'quick' | 'describe') => {
    if (mode === 'quick') {
      quickDescriptionFieldRef.current?.focus();
      return;
    }
    describeFieldRef.current?.focus();
  }, []);

  if (loading) {
    return <LinearProgress />;
  }

  const hasUnloggedPastDays = dayEntries.some((entry) => entry.kind === 'past' && entry.actualCalories <= 0);

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
        meal_type: mealType || null,
        estimated_calories: Number(logForm.calories),
      });
      setLogForm({
        description: '',
        calories: '',
      });
      setMealType('');
      await fetchData();
    } catch (error) {
      if (isUserNotFoundError(error)) {
        return;
      }
      const message = error instanceof Error ? error.message : 'Unable to log meal. Please try again.';
      setLogError(message);
    } finally {
      setSavingQuickLog(false);
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
      const userId = getActiveUserId();
      const prompt = [
        `Please log what I consumed on ${selectedKey}.`,
        ...(mealType ? [`Meal type: ${mealType}.`] : []),
        describeImageDataUrl ? `A meal photo is attached. Use it to identify foods and portions.` : null,
        `If details are missing, make reasonable assumptions and estimate calories (integer) rather than asking follow-up questions.`,
        ``,
        describeInput.trim() || '(No additional text — use the meal photo.)',
      ].join('\n');

      const response = await apiService.chat({
        message: prompt,
        user_id: userId ?? undefined,
        client_local_date: toIsoDate(startOfDay(new Date())),
        client_time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        image_data_url: describeImageDataUrl ?? undefined,
      });

      setDescribeReply(response.reply || 'OK.');
      setDescribeInput('');
      setDescribeImageDataUrl(null);
      await fetchData();
      window.setTimeout(() => focusLogInput('describe'), 0);
    } catch (error) {
      if (isUserNotFoundError(error)) {
        return;
      }
      const message = error instanceof Error ? error.message : 'Unable to log meal. Please try again.';
      setLogError(message);
    } finally {
      setSendingDescribeLog(false);
    }
  };

  const logBusy = savingQuickLog || sendingDescribeLog;

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
      setLogError('Unable to read that image. Try a different file.');
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
                  {isSelectedToday ? 'Today' : format(selectedDay, 'EEEE, MMM d')}
                </Typography>
              </Box>
              <Typography variant="h5" sx={{ lineHeight: 1.1 }}>
                {Math.round(selectedDisplayedCalories)} / {Math.round(selectedTargetCalories)} kcal
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                {isSelectedPast
                  ? 'Past day — you can still log meals'
                  : isSelectedFuture
                    ? `${Math.max(0, Math.round(selectedTargetCalories - selectedDisplayedCalories))} kcal available to plan`
                    : selectedDisplayedCalories > selectedTargetCalories
                      ? `Over by ${Math.round(selectedDisplayedCalories - selectedTargetCalories)} kcal`
                      : `${Math.max(0, Math.round(selectedTargetCalories - selectedDisplayedCalories))} kcal left`}
              </Typography>
            </Box>
          </Box>

          <LinearProgress
            variant="determinate"
            value={selectedTargetCalories > 0 ? Math.min((selectedDisplayedCalories / selectedTargetCalories) * 100, 100) : 0}
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
                    : selectedDisplayedCalories > selectedTargetCalories
                      ? theme.palette.error.main
                      : theme.palette.success.main,
              },
            }}
          />

          {showRebalanceNotice && (
            <Box sx={{ mt: 1.25, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Chip
                size="small"
                variant="outlined"
                color={dynamicWeek.overBudgetBy > 0 ? 'warning' : 'info'}
                label={dynamicWeek.overBudgetBy > 0 ? 'Week Over Budget' : 'Week Rebalanced'}
              />
	              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
	                {dynamicWeek.overBudgetBy > 0
	                  ? `Not enough adjustable days to stay under weekly budget; week is ${Math.round(dynamicWeek.overBudgetBy)} kcal over.`
	                  : 'Adjusted remaining daily budgets to keep weekly calories on track.'}
	              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Quick Log */}
      <Card ref={quickLogSectionRef}>
        <CardContent sx={{ p: 2.5 }}>
          <Typography variant="h6" sx={{ mb: 1.5 }}>
            Quick Log
          </Typography>
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
            disabled={logBusy}
            sx={{ mb: 1.5 }}
            onChange={(_, value) => {
              if (!value) return;
              if (value !== 'describe' && describeVoiceListening) stopDescribeVoice();
              setLogMode(value);
              setLogError(null);
              setDescribeReply(null);
              if (value === 'quick') setDescribeImageDataUrl(null);
              window.setTimeout(() => focusLogInput(value), 0);
            }}
          >
            <ToggleButton value="describe">Describe / photo</ToggleButton>
            <ToggleButton value="quick">Quick add</ToggleButton>
          </ToggleButtonGroup>

          <Box sx={{ mb: 1.5 }}>
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', fontWeight: 800, display: 'block', mb: 0.75 }}
            >
              Meal (optional)
            </Typography>
            <RadioGroup
              row
              value={mealType}
              onChange={(event) => setMealType(event.target.value as MealType)}
              aria-label="Meal type"
              name="meal-type"
              sx={{
                gap: { xs: 0.5, sm: 1 },
                flexWrap: 'nowrap',
                overflowX: 'auto',
                pb: 0.25,
              }}
            >
              {(
                [
                  { value: 'breakfast', label: 'Breakfast' },
                  { value: 'lunch', label: 'Lunch' },
                  { value: 'dinner', label: 'Dinner' },
                  { value: 'snack', label: 'Snack' },
                ] as const
              ).map((option) => {
                const selected = mealType === option.value;
                return (
                  <FormControlLabel
                    key={option.value}
                    value={option.value}
                    disabled={logBusy}
                    control={<Radio size="small" />}
                    label={option.label}
                    sx={{
                      m: 0,
                      pl: { xs: 0.75, sm: 1 },
                      pr: { xs: 0.9, sm: 1.25 },
                      py: { xs: 0.2, sm: 0.25 },
                      borderRadius: 999,
                      border: `1px solid ${alpha(
                        selected ? theme.palette.primary.main : theme.palette.text.primary,
                        selected ? 0.45 : 0.14
                      )}`,
                      bgcolor: alpha(
                        selected ? theme.palette.primary.main : theme.palette.text.primary,
                        selected ? 0.08 : 0.03
                      ),
                      '& .MuiRadio-root': { p: { xs: 0.35, sm: 0.5 } },
                      '& .MuiSvgIcon-root': { fontSize: { xs: 18, sm: 20 } },
                      '& .MuiTypography-root': { fontWeight: 800, fontSize: { xs: 12, sm: 13 } },
                    }}
                  />
                );
              })}
            </RadioGroup>
          </Box>

          {logMode === 'quick' ? (
            <>
              <TextField
                fullWidth
                margin="dense"
                label="What did you eat?"
                value={logForm.description}
                onChange={(event) => handleLogInputChange('description', event.target.value)}
                disabled={logBusy}
                inputRef={quickDescriptionFieldRef}
              />
              <TextField
                fullWidth
                margin="dense"
                label="Calories"
                type="number"
                inputProps={{ min: 0 }}
                value={logForm.calories}
                onChange={(event) => handleLogInputChange('calories', event.target.value)}
                disabled={logBusy}
              />
            </>
          ) : (
            <>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                Add a description, take/upload a photo, or use both.
              </Typography>

              {describeImageDataUrl && (
                <Box sx={{ mb: 1.25, display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                  <Box
                    component="img"
                    src={describeImageDataUrl}
                    alt="Selected meal"
                    sx={{
                      width: 88,
                      height: 88,
                      objectFit: 'cover',
                      borderRadius: 1.5,
                      border: `1px solid ${alpha(theme.palette.text.primary, 0.12)}`,
                    }}
                  />
                  <IconButton
                    size="small"
                    onClick={() => setDescribeImageDataUrl(null)}
                    disabled={logBusy}
                    aria-label="Remove meal photo"
                  >
                    <CloseRoundedIcon fontSize="small" />
                  </IconButton>
                </Box>
              )}

              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignSelf: 'center' }}>
                  <IconButton
                    component="label"
                    disabled={logBusy || describeVoiceListening}
                    color={describeImageDataUrl ? 'primary' : 'default'}
                    aria-label="Attach meal photo"
                  >
                    <PhotoCameraRoundedIcon />
                    <input
                      hidden
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleAttachDescribeImage}
                    />
                  </IconButton>
                  <IconButton
                    onClick={handleToggleDescribeVoice}
                    disabled={logBusy}
                    color={describeVoiceListening ? 'error' : 'default'}
                    aria-label={describeVoiceListening ? 'Stop voice input' : 'Start voice input'}
                  >
                    {describeVoiceListening ? <StopCircleRoundedIcon /> : <MicRoundedIcon />}
                  </IconButton>
                </Box>
                <TextField
                  fullWidth
                  margin="dense"
                  label={describeImageDataUrl ? 'Add a note (optional)' : 'Describe what you ate (or drank)'}
                  placeholder={
                    describeImageDataUrl
                      ? 'Optional: any details the photo won’t show (portion, sauces, drinks, etc.)'
                      : 'Example: chicken burrito bowl with rice, beans, guac and a Coke'
                  }
                  value={describeInput}
                  onChange={(event) => {
                    setDescribeInput(event.target.value);
                    if (describeReply) setDescribeReply(null);
                    if (logError) setLogError(null);
                  }}
                  multiline
                  minRows={3}
                  disabled={logBusy || describeVoiceListening}
                  InputLabelProps={{
                    shrink: true,
                    sx: { whiteSpace: 'nowrap', backgroundColor: 'background.paper', px: 0.5 },
                  }}
                  inputRef={describeFieldRef}
                />
              </Box>

              {describeVoiceListening && (
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.75 }}>
                  Listening… tap the mic to stop.
                </Typography>
              )}

              {describeVoiceError && (
                <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.75 }}>
                  {describeVoiceError}
                </Typography>
              )}

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
                  <Markdown>{describeReply}</Markdown>
                </Box>
              )}
            </>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
            {logMode === 'quick' ? (
              <Button variant="contained" onClick={handleSaveMealLog} disabled={logBusy}>
                {savingQuickLog ? 'Saving...' : 'Log Meal'}
              </Button>
            ) : (
              <Button
                variant="contained"
                onClick={handleDescribeMealLog}
                disabled={logBusy || describeVoiceListening || !(describeInput.trim() || describeImageDataUrl)}
              >
                {sendingDescribeLog ? 'Sending...' : 'Send to AI'}
              </Button>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* This Week */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 0.5 }}>
          <Typography variant="h6" sx={{ color: 'text.secondary' }}>
            This Week
          </Typography>
          <Tooltip
            arrow
            placement="top"
            title={
              <Box sx={{ maxWidth: 320 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                  Why a fixed week?
                </Typography>
                <Typography variant="body2">
                  We always show a full Sunday–Saturday week so you can plan at a glance.
                  If one day runs higher or lower, the remaining days’ calorie targets automatically rebalance so you still hit your weekly goal.
                </Typography>
              </Box>
            }
          >
            <IconButton size="small" aria-label="About this week view" sx={{ color: 'text.secondary' }}>
              <InfoOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        {hasUnloggedPastDays && (
          <Typography variant="caption" sx={{ color: 'text.secondary', px: 0.5, mt: -0.75 }}>
            Missed a day? Tap any earlier day to log meals.
          </Typography>
        )}
        {dayEntries.map((entry) => {
          const targetCalories = dynamicTargetsByDate[entry.key] ?? baseDailyTarget;
          const color = getDayColor(entry, targetCalories);
          const isSelected = isSameDay(entry.date, selectedDay);
          const hasLogged = entry.actualCalories > 0;
          const calories = entry.actualCalories > 0 ? entry.actualCalories : entry.plannedCalories;
          const caloriesLabel =
            entry.actualCalories > 0
              ? 'logged'
              : entry.plannedCalories > 0
                ? 'planned'
                : entry.kind === 'future'
                  ? 'available'
                  : '';
          const caloriesText = calories > 0 ? `${calories} kcal${caloriesLabel ? ` ${caloriesLabel}` : ''}` : null;
          const adjustment =
            entry.kind === 'future' && targetCalories !== baseDailyTarget ? targetCalories - baseDailyTarget : 0;
          const adjustmentText = adjustment !== 0 ? ` (adj ${adjustment > 0 ? `+${adjustment}` : adjustment})` : '';
          const subtitle = caloriesText
            ? `${caloriesText} • Budget ${targetCalories} kcal`
            : `Budget ${targetCalories} kcal`;
          const subtitleWithAdjustment =
            entry.kind === 'future' ? `${subtitle}${adjustmentText}` : subtitle;
          const pastMeta =
            entry.kind === 'past' && !hasLogged
              ? entry.plannedCalories > 0
                ? ' • Not logged yet'
                : ' • Tap to log'
              : '';
          return (
            <Card
              key={entry.key}
              variant="outlined"
              sx={{
                cursor: 'pointer',
                position: 'relative',
                overflow: 'hidden',
                borderColor: alpha(color, isSelected ? 0.82 : 0.35),
                borderWidth: isSelected ? 3 : 1,
                backgroundColor: alpha(color, isSelected ? 0.16 : 0.06),
                boxShadow: isSelected ? `0 14px 40px ${alpha(color, 0.24)}` : 'none',
                transform: isSelected ? 'translateY(-2px) scale(1.01)' : 'none',
                transition: 'border-color 180ms ease, background-color 180ms ease, box-shadow 180ms ease, transform 180ms ease',
                '&:hover': {
                  borderColor: alpha(color, isSelected ? 0.9 : 0.55),
                  backgroundColor: alpha(color, isSelected ? 0.18 : 0.09),
                },
                '&::before': isSelected
                  ? {
                      content: '""',
                      position: 'absolute',
                      inset: 0,
                      borderRadius: 'inherit',
                      pointerEvents: 'none',
                      background: `linear-gradient(90deg, ${alpha(color, 0.22)} 0%, ${alpha(color, 0)} 55%)`,
                    }
                  : undefined,
              }}
              onClick={() => {
                navigate(`/log?date=${entry.key}`);
              }}
            >
              <CardContent sx={{ p: 1.75, '&:last-child': { pb: 1.75 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                      <Typography
                        variant="subtitle1"
                        sx={{
                          fontWeight: isSelected ? 950 : 900,
                          color,
                          lineHeight: 1.2,
                          fontSize: isSelected ? { xs: '1.08rem', sm: '1.12rem' } : undefined,
                          textShadow: 'none',
                        }}
                      >
                        {entry.label}
                      </Typography>
                      {entry.kind === 'today' && (
                        <Chip
                          label="Today"
                          size="small"
                          sx={{
                            height: 22,
                            fontWeight: 600,
                            bgcolor: isSelected ? alpha(color, 0.7) : alpha(color, 0.22),
                            color: isSelected ? theme.palette.common.white : color,
                            border: isSelected
                              ? `1px solid ${alpha(theme.palette.common.white, 0.38)}`
                              : `1px solid ${alpha(color, 0.36)}`,
                            textShadow: isSelected ? `0 1px 2px ${alpha(theme.palette.common.black, 0.28)}` : 'none',
                          }}
                        />
                      )}
                    </Box>
                    <Typography
                      variant="body2"
                      sx={{
                        color: isSelected ? alpha(theme.palette.text.primary, 0.78) : 'text.secondary',
                        fontWeight: isSelected ? 650 : undefined,
                      }}
                    >
                      {subtitleWithAdjustment}
                      {pastMeta}
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip
                      label={getDayChipLabel(entry, targetCalories)}
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
                      {getDayIcon(entry, targetCalories)}
                    </Box>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          );
        })}
      </Box>
    </Box>
  );
};

export default Dashboard; 
