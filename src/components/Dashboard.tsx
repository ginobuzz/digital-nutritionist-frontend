import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box,
  Typography,
  LinearProgress,
  Card,
  CardContent,
  Chip,
  Button,
  Alert,
  Menu,
  MenuItem,
  IconButton,
  Popover,
  useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import TodayRoundedIcon from '@mui/icons-material/TodayRounded';
import { useLocation, useNavigate } from 'react-router-dom';
import { addDays, format, isBefore, isSameDay, startOfDay, startOfWeek } from 'date-fns';
import { User } from '../types';
import { apiService, isUserNotFoundError, MealLogResponse } from '../services/api';
import { triggerSubmitHaptic, triggerSuccessHaptic } from '../services/haptics';
import { imageFileToDataUrl } from '../utils/images';
import { calculateDynamicWeeklyCalorieTargets, getMinimumHealthyDailyCalories } from '../utils/weeklyTargets';
import { resolveLockedTodayTarget } from '../utils/dailyTargetLock';
import { useSpeechToText } from '../hooks/useSpeechToText';
import { formatVoiceInputError, getUserFacingErrorMessage } from '../utils/errors';
import { syncWidgetDailyProgress } from '../services/widgetBridge';
import SundayFreshStartDialog from './SundayFreshStartDialog';
import SignupWelcomeDialog from './SignupWelcomeDialog';
import MealLogInput from './MealLogInput';

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
}

type MealType = '' | 'breakfast' | 'lunch' | 'dinner' | 'snack';

const WEEK_LENGTH_DAYS = 7;
const toIsoDate = (d: Date) => format(d, 'yyyy-MM-dd');
const RECENT_MEALS_LIMIT = 4;
const RECENT_MEALS_LOOKBACK_DAYS = 120;
const SUNDAY_WELCOME_STORAGE_PREFIX = 'dn.sunday_welcome.week.';
const SUNDAY_WELCOME_PREVIEW_QUERY_PARAM = 'previewSunday';
const SUNDAY_WELCOME_PREVIEW_SESSION_KEY = 'dn.sunday_welcome.preview.once';
const SIGNUP_WELCOME_STORAGE_PREFIX = 'dn.signup_welcome.seen.';
const SIGNUP_WELCOME_PREVIEW_QUERY_PARAM = 'previewSignupWelcome';
const SIGNUP_WELCOME_PREVIEW_SESSION_KEY = 'dn.signup_welcome.preview.once';
const SIGNUP_WELCOME_POST_SIGNUP_SESSION_KEY = 'dn.signup_welcome.post_signup.once';

const getCurrentWeekStart = (): Date => {
  return startOfWeek(startOfDay(new Date()), { weekStartsOn: 0 });
};

const normalizeMealType = (value: string | null | undefined): MealType => {
  const v = (value || '').trim().toLowerCase();
  if (v === 'breakfast' || v === 'lunch' || v === 'dinner' || v === 'snack') return v;
  return '';
};

const formatMealTypeLabel = (value: string | null | undefined): string | null => {
  const v = (value || '').trim();
  if (!v) return null;
  const lower = v.toLowerCase();
  return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
};

const normalizeMealTypeForBackend = (value: string | null | undefined): string | null => {
  const v = (value || '').trim().toLowerCase();
  return v ? v : null;
};

const parseBackendDateTime = (value: string): Date => {
  const hasTimeZone = /[zZ]|[+-]\d{2}:\d{2}$/.test(value);
  return new Date(hasTimeZone ? value : `${value}Z`);
};

const getMealLogCreatedAt = (log: MealLogResponse): Date => {
  if (log.created_at) return parseBackendDateTime(log.created_at);
  return new Date(`${log.date}T12:00:00`);
};

const Dashboard: React.FC<DashboardProps> = ({ user, onNavigateToChat }) => {
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const describeFieldRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [dayEntries, setDayEntries] = useState<DayEntry[]>([]);
  const [actualCaloriesByDate, setActualCaloriesByDate] = useState<Record<string, number>>({});
  const [macroTotalsByDate, setMacroTotalsByDate] = useState<
    Record<
      string,
      {
        protein: number;
        carbs: number;
        fat: number;
        mealsWithAnyMacros: number;
        mealsTotal: number;
      }
    >
  >({});
  const [lockedTodayTarget, setLockedTodayTarget] = useState<{ dateKey: string; target: number } | null>(null);
  const [mealType, setMealType] = useState<MealType>('');
  const [describeInput, setDescribeInput] = useState('');
  const [describeReply, setDescribeReply] = useState<string | null>(null);
  const [describeImageDataUrl, setDescribeImageDataUrl] = useState<string | null>(null);
  const [logError, setLogError] = useState<string | null>(null);
  const [sendingDescribeLog, setSendingDescribeLog] = useState(false);
  const [recentMealsAnchorEl, setRecentMealsAnchorEl] = useState<HTMLElement | null>(null);
  const [recentMealsLogs, setRecentMealsLogs] = useState<MealLogResponse[] | null>(null);
  const [recentMealsLoading, setRecentMealsLoading] = useState(false);
  const [recentMealsError, setRecentMealsError] = useState<string | null>(null);
  const [addingRecentMealId, setAddingRecentMealId] = useState<string | null>(null);
  const [weekInfoAnchorEl, setWeekInfoAnchorEl] = useState<HTMLElement | null>(null);
  const [describeDictationBaseText, setDescribeDictationBaseText] = useState('');
  const [describeVoiceError, setDescribeVoiceError] = useState<string | null>(null);
  const [showSundayWelcome, setShowSundayWelcome] = useState(false);
  const [showSignupWelcome, setShowSignupWelcome] = useState(false);

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
    setDescribeVoiceError(formatVoiceInputError(describeVoiceRawError));
  }, [describeVoiceRawError]);

  const handleToggleDescribeVoice = () => {
    setDescribeVoiceError(null);

    if (!describeVoiceSupported) {
      setDescribeVoiceError(formatVoiceInputError('unsupported'));
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

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get(SUNDAY_WELCOME_PREVIEW_QUERY_PARAM) !== '1') return;
    try {
      sessionStorage.setItem(SUNDAY_WELCOME_PREVIEW_SESSION_KEY, '1');
    } catch {
      // no-op
    }
  }, [location.search]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get(SIGNUP_WELCOME_PREVIEW_QUERY_PARAM) !== '1') return;
    try {
      sessionStorage.setItem(SIGNUP_WELCOME_PREVIEW_SESSION_KEY, '1');
    } catch {
      // no-op
    }
  }, [location.search]);

  const sundayWelcomePreviewMode = useMemo(() => {
    const params = new URLSearchParams(location.search);
    if (params.get(SUNDAY_WELCOME_PREVIEW_QUERY_PARAM) === '1') return true;
    try {
      return sessionStorage.getItem(SUNDAY_WELCOME_PREVIEW_SESSION_KEY) === '1';
    } catch {
      return false;
    }
  }, [location.search]);

  const signupWelcomePreviewMode = useMemo(() => {
    const params = new URLSearchParams(location.search);
    if (params.get(SIGNUP_WELCOME_PREVIEW_QUERY_PARAM) === '1') return true;
    try {
      return sessionStorage.getItem(SIGNUP_WELCOME_PREVIEW_SESSION_KEY) === '1';
    } catch {
      return false;
    }
  }, [location.search]);

  const sundayWelcomeWeekLabel = useMemo(() => {
    const weekStart = getCurrentWeekStart();
    const weekEnd = addDays(weekStart, WEEK_LENGTH_DAYS - 1);
    return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d')}`;
  }, []);

  const sundayWelcomeWeeklyBudget = useMemo(() => {
    const dailyTarget = Math.max(0, Math.round(user.dailyCalorieTarget || 0));
    return dailyTarget * WEEK_LENGTH_DAYS;
  }, [user.dailyCalorieTarget]);

  const fetchData = useCallback(async (showLoader = false) => {
    try {
      if (showLoader) {
        setLoading(true);
      }
      const userId = getActiveUserId();

      const today = startOfDay(new Date());
      const todayKey = toIsoDate(today);
      const weekStart = startOfWeek(today, { weekStartsOn: 0 }); // Sunday
      const weekEnd = addDays(weekStart, WEEK_LENGTH_DAYS - 1);

      const logs = await apiService.getMealLogs({ userId, start: weekStart, end: weekEnd });

      const nextActualByDate: Record<string, number> = {};
      const nextMacrosByDate: Record<
        string,
        { protein: number; carbs: number; fat: number; mealsWithAnyMacros: number; mealsTotal: number }
      > = {};
      for (const log of logs) {
        const key = log.date; // YYYY-MM-DD
        const cals = Number(log.estimated_calories || 0);
        nextActualByDate[key] = (nextActualByDate[key] || 0) + cals;

        const protein = typeof log.protein_g === 'number' ? log.protein_g : 0;
        const carbs = typeof log.carbs_g === 'number' ? log.carbs_g : 0;
        const fat = typeof log.fat_g === 'number' ? log.fat_g : 0;
        const hasAnyMacros =
          typeof log.protein_g === 'number' || typeof log.carbs_g === 'number' || typeof log.fat_g === 'number';
        const entry = nextMacrosByDate[key] || {
          protein: 0,
          carbs: 0,
          fat: 0,
          mealsWithAnyMacros: 0,
          mealsTotal: 0,
        };
        entry.protein += protein;
        entry.carbs += carbs;
        entry.fat += fat;
        entry.mealsTotal += 1;
        if (hasAnyMacros) entry.mealsWithAnyMacros += 1;
        nextMacrosByDate[key] = entry;
      }

      const baseDailyTarget = Math.round(user.dailyCalorieTarget || 0);
      const minHealthyDailyTarget = getMinimumHealthyDailyCalories(user.gender);
      const resolvedLockedTodayTarget = resolveLockedTodayTarget({
        userId,
        today,
        weekStart,
        dailyTarget: baseDailyTarget,
        minDailyTarget: minHealthyDailyTarget,
        actualCaloriesByDate: nextActualByDate,
        plannedCaloriesByDate: {},
      });

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
        };
      });

      setActualCaloriesByDate(nextActualByDate);
      setMacroTotalsByDate(nextMacrosByDate);
      setDayEntries(entries);
      setLockedTodayTarget({ dateKey: todayKey, target: resolvedLockedTodayTarget });

      // Push today's data to WidgetKit immediately after a successful fetch.
      const consumedCalories = Math.round(nextActualByDate[todayKey] || 0);
      const targetCalories = Math.max(0, Math.round(resolvedLockedTodayTarget));
      void syncWidgetDailyProgress({ consumedCalories, targetCalories, dateKey: todayKey });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }, [getActiveUserId, user.dailyCalorieTarget, user.gender]);

  useEffect(() => {
    fetchData(true);
  }, [fetchData]);

  const markSundayWelcomeSeen = useCallback(() => {
    try {
      sessionStorage.removeItem(SUNDAY_WELCOME_PREVIEW_SESSION_KEY);
    } catch {
      // no-op
    }
    if (sundayWelcomePreviewMode) return;
    const weekKey = toIsoDate(getCurrentWeekStart());
    try {
      localStorage.setItem(`${SUNDAY_WELCOME_STORAGE_PREFIX}${user.id}`, weekKey);
    } catch {
      // no-op
    }
  }, [sundayWelcomePreviewMode, user.id]);

  useEffect(() => {
    if (loading) return;

    const now = startOfDay(new Date());
    const isSunday = now.getDay() === 0;
    if (!isSunday && !sundayWelcomePreviewMode) {
      setShowSundayWelcome(false);
      return;
    }

    const weekKey = toIsoDate(startOfWeek(now, { weekStartsOn: 0 }));
    try {
      const lastSeenWeek = localStorage.getItem(`${SUNDAY_WELCOME_STORAGE_PREFIX}${user.id}`);
      if (sundayWelcomePreviewMode || lastSeenWeek !== weekKey) {
        setShowSundayWelcome(true);
      }
    } catch {
      setShowSundayWelcome(true);
    }
  }, [loading, sundayWelcomePreviewMode, user.id]);

  useEffect(() => {
    if (loading) return;

    if (signupWelcomePreviewMode) {
      setShowSignupWelcome(true);
      return;
    }

    try {
      const alreadySeen = localStorage.getItem(`${SIGNUP_WELCOME_STORAGE_PREFIX}${user.id}`) === '1';
      const postSignupTrigger = sessionStorage.getItem(SIGNUP_WELCOME_POST_SIGNUP_SESSION_KEY) === '1';
      if (postSignupTrigger && !alreadySeen) {
        setShowSignupWelcome(true);
      }
    } catch {
      // no-op
    }
  }, [loading, signupWelcomePreviewMode, user.id]);

  const markSignupWelcomeSeen = useCallback(() => {
    try {
      sessionStorage.removeItem(SIGNUP_WELCOME_PREVIEW_SESSION_KEY);
      sessionStorage.removeItem(SIGNUP_WELCOME_POST_SIGNUP_SESSION_KEY);
    } catch {
      // no-op
    }
    if (signupWelcomePreviewMode) return;
    try {
      localStorage.setItem(`${SIGNUP_WELCOME_STORAGE_PREFIX}${user.id}`, '1');
    } catch {
      // no-op
    }
  }, [signupWelcomePreviewMode, user.id]);

  const handleSignupWelcomeStart = useCallback(() => {
    markSignupWelcomeSeen();
    setShowSignupWelcome(false);
    void triggerSuccessHaptic();
    navigate('/');
  }, [markSignupWelcomeSeen, navigate]);

  const handleSignupWelcomePulse = useCallback(() => {
    void triggerSubmitHaptic();
  }, []);

  const handleSignupWelcomeStageReveal = useCallback(() => {
    void triggerSubmitHaptic();
  }, []);

  const handleCloseSundayWelcome = useCallback(() => {
    markSundayWelcomeSeen();
    setShowSundayWelcome(false);
  }, [markSundayWelcomeSeen]);

  const handleStartWeekFromWelcome = useCallback(() => {
    markSundayWelcomeSeen();
    setShowSundayWelcome(false);
    void triggerSuccessHaptic();
    navigate('/');
  }, [markSundayWelcomeSeen, navigate]);

  const handleSundayWelcomePulse = useCallback(() => {
    void triggerSubmitHaptic();
  }, []);

  const handleSundayWelcomeStepReveal = useCallback(() => {
    void triggerSubmitHaptic();
  }, []);

  const today = startOfDay(new Date());
  const weekStart = startOfWeek(today, { weekStartsOn: 0 }); // Sunday
  const selectedDay = today;
  const selectedKey = toIsoDate(selectedDay);
  const isSelectedPast = isBefore(selectedDay, today);
  const isSelectedToday = isSameDay(selectedDay, today);
  const selectedMacros = macroTotalsByDate[selectedKey];
  const hasSelectedMacros = Boolean(selectedMacros && selectedMacros.mealsWithAnyMacros > 0);
  const selectedMealsMissingMacros = selectedMacros
    ? Math.max(0, selectedMacros.mealsTotal - selectedMacros.mealsWithAnyMacros)
    : 0;

  const selectedActualCalories = Math.round(actualCaloriesByDate[selectedKey] || 0);

  const baseDailyTarget = Math.round(user.dailyCalorieTarget || 0);
  const minHealthyDailyTarget = getMinimumHealthyDailyCalories(user.gender);
  const lockedTargetForSelectedDay = lockedTodayTarget?.dateKey === selectedKey ? lockedTodayTarget.target : null;
  const dynamicWeek = useMemo(() => {
    return calculateDynamicWeeklyCalorieTargets({
      weekStart,
      dailyTarget: baseDailyTarget,
      minDailyTarget: minHealthyDailyTarget,
      anchorDate: addDays(today, 1),
      actualCaloriesByDate,
      plannedCaloriesByDate: {},
    });
  }, [actualCaloriesByDate, baseDailyTarget, minHealthyDailyTarget, today, weekStart]);

  const dynamicTargetsByDate = useMemo(() => {
    if (lockedTargetForSelectedDay == null) return dynamicWeek.targetsByDate;
    return {
      ...dynamicWeek.targetsByDate,
      [selectedKey]: lockedTargetForSelectedDay,
    };
  }, [dynamicWeek.targetsByDate, lockedTargetForSelectedDay, selectedKey]);
  const selectedTargetCalories = dynamicTargetsByDate[selectedKey] ?? baseDailyTarget;
  const hasFutureAdjustments = useMemo(() => {
    return dayEntries.some((entry) => {
      if (entry.kind !== 'future') return false;
      const targetCalories = dynamicTargetsByDate[entry.key] ?? baseDailyTarget;
      return targetCalories !== baseDailyTarget;
    });
  }, [baseDailyTarget, dayEntries, dynamicTargetsByDate]);
  const showRebalanceNotice = hasFutureAdjustments || dynamicWeek.overBudgetBy > 0;

  useEffect(() => {
    const todayKey = toIsoDate(startOfDay(new Date()));
    const consumedCalories = Math.round(actualCaloriesByDate[todayKey] || 0);
    const targetCalories = Math.max(
      0,
      Math.round(dynamicTargetsByDate[todayKey] ?? lockedTargetForSelectedDay ?? baseDailyTarget)
    );
    void syncWidgetDailyProgress({ consumedCalories, targetCalories, dateKey: todayKey });
  }, [actualCaloriesByDate, baseDailyTarget, dynamicTargetsByDate, lockedTargetForSelectedDay]);

  const recentMeals = useMemo(() => {
    const logs = recentMealsLogs ?? [];
    const filtered = mealType ? logs.filter((log) => normalizeMealType(log.meal_type) === mealType) : logs;
    return filtered.slice(0, RECENT_MEALS_LIMIT);
  }, [mealType, recentMealsLogs]);

  const fetchRecentMeals = useCallback(async () => {
    try {
      setRecentMealsLoading(true);
      setRecentMealsError(null);
      const userId = getActiveUserId();
      const today = startOfDay(new Date());
      const start = addDays(today, -RECENT_MEALS_LOOKBACK_DAYS);
      const logs = await apiService.getMealLogs({ userId, start, end: today });
      const sorted = [...logs].sort((a, b) => getMealLogCreatedAt(b).getTime() - getMealLogCreatedAt(a).getTime());
      setRecentMealsLogs(sorted);
    } catch (error) {
      if (isUserNotFoundError(error)) {
        return;
      }
      setRecentMealsError(
        getUserFacingErrorMessage(error, {
          action: 'load your recent meals',
          fallback: 'We couldn’t load your recent meals. Please try again.',
        })
      );
    } finally {
      setRecentMealsLoading(false);
    }
  }, [getActiveUserId]);

  const getDayColor = (entry: DayEntry, targetCalories: number) => {
    if (entry.kind === 'past' || entry.kind === 'future') {
      const hasLogged = entry.actualCalories > 0;
      if (!hasLogged) return theme.palette.grey[500];
      const isOver = entry.actualCalories > targetCalories;
      return alpha(isOver ? theme.palette.error.main : theme.palette.success.main, 0.75);
    }
    // today
    return entry.actualCalories > targetCalories ? theme.palette.error.main : theme.palette.success.main;
  };

  const getDayChipLabel = (entry: DayEntry, targetCalories: number) => {
    if (entry.kind === 'past' || entry.kind === 'future') {
      const hasLogged = entry.actualCalories > 0;
      if (!hasLogged) return 'Log';
      return entry.actualCalories > targetCalories ? 'Over Budget' : 'Under Budget';
    }
    return entry.actualCalories > targetCalories ? 'Over Budget' : 'On Track';
  };

  const getDayIcon = (entry: DayEntry, targetCalories: number) => {
    if (entry.kind === 'past' || entry.kind === 'future') {
      const hasLogged = entry.actualCalories > 0;
      if (!hasLogged) return <AddRoundedIcon fontSize="small" />;
      return entry.actualCalories > targetCalories
        ? <CloseRoundedIcon fontSize="small" />
        : <CheckRoundedIcon fontSize="small" />;
    }
    return entry.actualCalories > targetCalories
      ? <CloseRoundedIcon fontSize="small" />
      : <CheckRoundedIcon fontSize="small" />;
  };

  const focusLogInput = useCallback(() => {
    describeFieldRef.current?.focus();
  }, []);

  if (loading) {
    return <LinearProgress />;
  }

  const hasUnloggedPastDays = dayEntries.some((entry) => entry.kind === 'past' && entry.actualCalories <= 0);

  const isRecentMealsOpen = Boolean(recentMealsAnchorEl);
  const isWeekInfoOpen = Boolean(weekInfoAnchorEl);

  const handleOpenRecentMeals = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (describeVoiceListening) stopDescribeVoice();
    setRecentMealsError(null);
    setRecentMealsAnchorEl(event.currentTarget);
    if (recentMealsLogs === null && !recentMealsLoading) {
      void fetchRecentMeals();
    }
  };

  const handleCloseRecentMeals = () => {
    setRecentMealsAnchorEl(null);
    setRecentMealsError(null);
  };

  const handleAddRecentMeal = async (meal: MealLogResponse) => {
    const mealId = String(meal.id);
    try {
      setAddingRecentMealId(mealId);
      setRecentMealsError(null);
      const userId = getActiveUserId();
      void triggerSubmitHaptic();
      await apiService.createMealLog({
        user_id: userId,
        date: selectedKey,
        user_description: meal.user_description || 'Meal',
        meal_type: mealType ? mealType : normalizeMealTypeForBackend(meal.meal_type),
        estimated_calories: typeof meal.estimated_calories === 'number' ? meal.estimated_calories : null,
        protein_g: typeof meal.protein_g === 'number' ? meal.protein_g : null,
        carbs_g: typeof meal.carbs_g === 'number' ? meal.carbs_g : null,
        fat_g: typeof meal.fat_g === 'number' ? meal.fat_g : null,
      });
      void triggerSuccessHaptic();
      setRecentMealsLogs(null);
      setRecentMealsAnchorEl(null);
      await fetchData();
    } catch (error) {
      if (isUserNotFoundError(error)) {
        return;
      }
      setRecentMealsError(
        getUserFacingErrorMessage(error, {
          action: 'add that meal',
          fallback: 'We couldn’t add that meal. Please try again.',
        })
      );
    } finally {
      setAddingRecentMealId(null);
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
        user_id: userId ?? undefined,
        client_local_date: toIsoDate(startOfDay(new Date())),
        client_time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        image_data_url: describeImageDataUrl ?? undefined,
      });

      void triggerSuccessHaptic();
      setDescribeReply(response.reply || 'OK.');
      setDescribeInput('');
      setDescribeImageDataUrl(null);
      setRecentMealsLogs(null);
      await fetchData();
      window.setTimeout(() => focusLogInput(), 0);
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

  const logBusy = sendingDescribeLog || Boolean(addingRecentMealId);

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

  return (
    <>
      <SignupWelcomeDialog
        open={showSignupWelcome}
        previewMode={signupWelcomePreviewMode}
        onOpenPulse={handleSignupWelcomePulse}
        onStageReveal={handleSignupWelcomeStageReveal}
        onGetStarted={handleSignupWelcomeStart}
      />
      <SundayFreshStartDialog
        open={showSundayWelcome && !showSignupWelcome}
        weekLabel={sundayWelcomeWeekLabel}
        weeklyTargetCalories={sundayWelcomeWeeklyBudget}
        previewMode={sundayWelcomePreviewMode}
        onOpenPulse={handleSundayWelcomePulse}
        onStepReveal={handleSundayWelcomeStepReveal}
        onClose={handleCloseSundayWelcome}
        onStartWeek={handleStartWeekFromWelcome}
      />
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
                {Math.round(selectedActualCalories)} / {Math.round(selectedTargetCalories)} kcal
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                {isSelectedPast
                  ? 'Past day — you can still log meals'
                  : selectedActualCalories > selectedTargetCalories
                    ? `Over by ${Math.round(selectedActualCalories - selectedTargetCalories)} kcal`
                    : `${Math.max(0, Math.round(selectedTargetCalories - selectedActualCalories))} kcal left`}
              </Typography>
            </Box>
          </Box>

          <LinearProgress
            variant="determinate"
            value={selectedTargetCalories > 0 ? Math.min((selectedActualCalories / selectedTargetCalories) * 100, 100) : 0}
            sx={{
              height: 12,
              borderRadius: 999,
              bgcolor: alpha(theme.palette.text.primary, 0.06),
              '& .MuiLinearProgress-bar': {
                borderRadius: 999,
                backgroundColor: isSelectedPast
                  ? theme.palette.grey[600]
                  : selectedActualCalories > selectedTargetCalories
                    ? theme.palette.error.main
                    : theme.palette.success.main,
              },
            }}
          />

          <Box
            sx={{
              mt: 1.5,
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 1.5,
            }}
          >
            {[
              { label: 'Protein', value: hasSelectedMacros ? `${Math.round(selectedMacros?.protein || 0)}g` : '—' },
              { label: 'Carbs', value: hasSelectedMacros ? `${Math.round(selectedMacros?.carbs || 0)}g` : '—' },
              { label: 'Fat', value: hasSelectedMacros ? `${Math.round(selectedMacros?.fat || 0)}g` : '—' },
            ].map((item) => (
              <Box key={item.label} sx={{ minWidth: 0 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 800 }}>
                  {item.label}
                </Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 900, lineHeight: 1.2 }}>
                  {item.value}
                </Typography>
              </Box>
            ))}
          </Box>

          {selectedMealsMissingMacros > 0 && (
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
              {selectedMealsMissingMacros} meal{selectedMealsMissingMacros === 1 ? '' : 's'} missing macros
            </Typography>
          )}

          {showRebalanceNotice && (
            <Box sx={{ mt: 1.25, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Chip
                size="small"
                variant="outlined"
                color={dynamicWeek.overBudgetBy > 0 ? 'warning' : 'info'}
                label={dynamicWeek.overBudgetBy > 0 ? 'Week Over Budget' : 'Week Rebalanced'}
              />
              {dynamicWeek.overBudgetBy > 0 && (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {`Not enough adjustable days to stay under weekly budget; week is ${Math.round(dynamicWeek.overBudgetBy)} kcal over.`}
                </Typography>
              )}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Log Food */}
      <Card>
        <CardContent sx={{ p: 2.5 }}>
          <Typography variant="h6" sx={{ mb: 1.5 }}>
            Log Food
          </Typography>
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
            voiceListening={describeVoiceListening}
            voiceError={describeVoiceError}
            onVoiceToggle={handleToggleDescribeVoice}
            busy={logBusy}
            reply={describeReply}
            inputRef={describeFieldRef}
          />

          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 1,
              mt: 2,
            }}
          >
            <Box>
              <Button
                variant="outlined"
                size="small"
                endIcon={<ExpandMoreRoundedIcon />}
                onClick={handleOpenRecentMeals}
                disabled={logBusy}
                aria-haspopup="menu"
                aria-expanded={isRecentMealsOpen ? 'true' : undefined}
                sx={{ textTransform: 'none', fontWeight: 800 }}
              >
                Recent Meals
              </Button>
              <Menu
                anchorEl={recentMealsAnchorEl}
                open={isRecentMealsOpen}
                onClose={handleCloseRecentMeals}
                PaperProps={{ sx: { width: { xs: 360, sm: 420 }, maxWidth: '92vw' } }}
                MenuListProps={{ sx: { py: 0 } }}
              >
                <Box sx={{ px: 2, py: 1.25 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 900, lineHeight: 1.1 }}>
                    Recent Meals
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {mealType
                      ? `Showing recent ${formatMealTypeLabel(mealType) ?? mealType} logs`
                      : 'Showing recent logs across meal types'}
                  </Typography>
                </Box>

                {recentMealsLoading && <LinearProgress />}

                {recentMealsError && (
                  <Box sx={{ px: 2, pb: 1.25 }}>
                    <Typography variant="caption" color="error">
                      {recentMealsError}
                    </Typography>
                  </Box>
                )}

                {!recentMealsLoading && recentMeals.length === 0 && (
                  <Box sx={{ px: 2, pb: 1.5 }}>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      No recent meals found.
                    </Typography>
                  </Box>
                )}

                {recentMeals.map((meal) => {
                  const createdAt = getMealLogCreatedAt(meal);
                  const calories =
                    typeof meal.estimated_calories === 'number' ? Math.round(meal.estimated_calories) : null;
                  const typeLabel = formatMealTypeLabel(meal.meal_type);
                  const meta = [
                    calories != null ? `${calories} kcal` : null,
                    typeLabel,
                    format(createdAt, 'M/d p'),
                  ].filter(Boolean);

                  return (
                    <MenuItem
                      key={String(meal.id)}
                      disableGutters
                      sx={{
                        px: 2,
                        py: 1,
                        alignItems: 'flex-start',
                        borderTop: `1px solid ${alpha(theme.palette.text.primary, 0.06)}`,
                      }}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          width: '100%',
                          gap: 1.5,
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                        }}
                      >
                        <Box sx={{ minWidth: 0 }}>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 800,
                              overflow: 'hidden',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                            }}
                          >
                            {meal.user_description || 'Meal'}
                          </Typography>
                          {meta.length > 0 && (
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              {meta.join(' • ')}
                            </Typography>
                          )}
                        </Box>

                        <Button
                          size="small"
                          variant="contained"
                          disableElevation
                          startIcon={<AddRoundedIcon fontSize="small" />}
                          onClick={() => void handleAddRecentMeal(meal)}
                          disabled={logBusy}
                          sx={{
                            width: 116,
                            minWidth: 116,
                            flexShrink: 0,
                            whiteSpace: 'nowrap',
                            justifyContent: 'center',
                            mt: 0.15,
                          }}
                        >
                          {addingRecentMealId === String(meal.id) ? 'Adding…' : 'Add'}
                        </Button>
                      </Box>
                    </MenuItem>
                  );
                })}
              </Menu>
            </Box>
            <Button
              variant="contained"
              onClick={handleDescribeMealLog}
              disabled={logBusy || describeVoiceListening || !(describeInput.trim() || describeImageDataUrl)}
            >
              {sendingDescribeLog ? 'Sending...' : 'Send'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* This Week */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 0.5 }}>
          <Typography variant="h6" sx={{ color: 'text.secondary' }}>
            This Week
          </Typography>
          <IconButton
            size="small"
            aria-label="About this week view"
            aria-describedby={isWeekInfoOpen ? 'week-info-popover' : undefined}
            onClick={(event) => {
              setWeekInfoAnchorEl((current) => (current ? null : event.currentTarget));
            }}
            sx={{ color: 'text.secondary' }}
          >
            <InfoOutlinedIcon fontSize="small" />
          </IconButton>
          <Popover
            id="week-info-popover"
            open={isWeekInfoOpen}
            anchorEl={weekInfoAnchorEl}
            onClose={() => setWeekInfoAnchorEl(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            disableScrollLock
          >
            <Box sx={{ maxWidth: 320, p: 1.5 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                Why a fixed week?
              </Typography>
              <Typography variant="body2">
                We always show a full Sunday-Saturday week so you can plan at a glance.
                If one day runs higher or lower, the remaining days&apos; calorie targets automatically rebalance so you still hit your weekly goal.
              </Typography>
            </Box>
          </Popover>
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
          const isOverBudget = entry.actualCalories > targetCalories;
          const showCalorieProgress = hasLogged && !isOverBudget && targetCalories > 0;
          const calorieProgressPercent = showCalorieProgress
            ? Math.min((entry.actualCalories / targetCalories) * 100, 100)
            : 0;
          const calories = entry.actualCalories;
          const caloriesLabel = entry.actualCalories > 0 ? 'logged' : '';
          const caloriesText = calories > 0 ? `${calories} kcal${caloriesLabel ? ` ${caloriesLabel}` : ''}` : null;
          const adjustment =
            entry.kind === 'future' && targetCalories !== baseDailyTarget ? targetCalories - baseDailyTarget : 0;
          const adjustmentText = adjustment !== 0 ? ` (adj ${adjustment > 0 ? `+${adjustment}` : adjustment})` : '';
          const subtitle = caloriesText
            ? `${caloriesText} • Budget ${targetCalories} kcal`
            : `Budget ${targetCalories} kcal`;
          const subtitleWithAdjustment =
            entry.kind === 'future' ? `${subtitle}${adjustmentText}` : subtitle;
          const pastMeta = (entry.kind === 'past' || entry.kind === 'future') && !hasLogged ? ' • Tap to log' : '';
          return (
            <Card
              key={entry.key}
              variant="outlined"
              sx={{
                cursor: 'pointer',
                position: 'relative',
                isolation: 'isolate',
                overflow: 'hidden',
                borderColor: alpha(color, isSelected ? 0.82 : 0.35),
                borderWidth: isSelected ? 3 : 1,
                backgroundColor: showCalorieProgress
                  ? alpha(theme.palette.text.primary, isSelected ? 0.08 : 0.04)
                  : alpha(color, isSelected ? 0.16 : 0.06),
                boxShadow: isSelected ? `0 14px 40px ${alpha(color, 0.24)}` : 'none',
                transform: isSelected ? 'translateY(-2px) scale(1.01)' : 'none',
                transition: 'border-color 180ms ease, background-color 180ms ease, box-shadow 180ms ease, transform 180ms ease',
                '&:hover': {
                  borderColor: alpha(color, isSelected ? 0.9 : 0.55),
                  backgroundColor: showCalorieProgress
                    ? alpha(theme.palette.text.primary, isSelected ? 0.1 : 0.06)
                    : alpha(color, isSelected ? 0.18 : 0.09),
                },
                '&::before': showCalorieProgress
                  ? {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      left: 0,
                      width: `${calorieProgressPercent}%`,
                      zIndex: 0,
                      pointerEvents: 'none',
                      backgroundColor: alpha(theme.palette.success.main, isSelected ? 0.28 : 0.16),
                      transition: 'width 220ms ease',
                    }
                  : undefined,
                '&::after': isSelected
                  ? {
                      content: '""',
                      position: 'absolute',
                      inset: 0,
                      zIndex: 0,
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
              <CardContent sx={{ p: 1.75, position: 'relative', zIndex: 1, '&:last-child': { pb: 1.75 } }}>
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
    </>
  );
};

export default Dashboard; 
