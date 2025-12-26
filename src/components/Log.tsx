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
  Fab,
  LinearProgress,
  Tabs,
  Tab,
} from '@mui/material';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import {
  Add,
  Edit,
  Delete,
  Restaurant,
  FitnessCenter,
  Schedule,
  LocalDining,
  DirectionsRun,
  CalendarToday
} from '@mui/icons-material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, isValid, parseISO } from 'date-fns';
import { ActualMeal, Activity, PlannedMeal, User } from '../types';
import { apiService, MealLogResponse, PlannedMealResponse, ActivityLogResponse } from '../services/api';
import { useSearchParams } from 'react-router-dom';

const toIsoDate = (d: Date) => format(d, 'yyyy-MM-dd');

const normalizeMealType = (value: string | null | undefined): ActualMeal['type'] => {
  const v = (value || '').toLowerCase();
  if (v === 'breakfast' || v === 'lunch' || v === 'dinner' || v === 'snack') return v;
  return 'snack';
};

const normalizeActivityType = (value: string | null | undefined): Activity['type'] => {
  const v = (value || '').toLowerCase();
  if (v === 'cardio' || v === 'strength' || v === 'flexibility' || v === 'other') return v;
  return 'other';
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

const mapActivityLogResponse = (activity: ActivityLogResponse): Activity => ({
  id: String(activity.id),
  name: activity.name,
  caloriesBurned: activity.calories_burned,
  duration: activity.duration,
  type: normalizeActivityType(activity.type),
  time: new Date(activity.time),
});

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`log-tabpanel-${index}`}
      aria-labelledby={`log-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

interface LogProps {
  user: User;
}

const Log: React.FC<LogProps> = ({ user }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tabValue, setTabValue] = useState(0);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [plannedMeals, setPlannedMeals] = useState<PlannedMeal[]>([]);
  const [actualMeals, setActualMeals] = useState<ActualMeal[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [mealDialogOpen, setMealDialogOpen] = useState(false);
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [editingMeal, setEditingMeal] = useState<PlannedMeal | ActualMeal | null>(null);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
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
  const [activityFormData, setActivityFormData] = useState({
    name: '',
    caloriesBurned: '',
    duration: '',
    type: 'cardio' as Activity['type'],
    time: ''
  });

  const fetchLogData = useCallback(async () => {
    try {
      setLoading(true);
      const [planned, actual, acts] = await Promise.all([
        apiService.getPlannedMeals({ userId: user.id, start: selectedDate, end: selectedDate }),
        apiService.getMealLogs({ userId: user.id, start: selectedDate, end: selectedDate }),
        apiService.getActivityLogs({ userId: user.id, start: selectedDate, end: selectedDate }),
      ]);
      setPlannedMeals(planned.map(mapPlannedMealResponse));
      setActualMeals(actual.map(mapMealLogToActualMeal));
      setActivities(acts.map(mapActivityLogResponse));
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

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleDateChange = (date: Date | null) => {
    if (date) {
      setSelectedDate(date);
      setSearchParams({ date: toIsoDate(date) }, { replace: true });
    }
  };

  // Meal handlers
  const handleAddMeal = (isPlanned: boolean = true) => {
    setEditingMeal(null);
    setIsEditingPlanned(isPlanned);
    setMealFormData({
      name: '',
      calories: '',
      type: 'breakfast',
      description: '',
      time: '',
      notes: '',
      isPlanned
    });
    setMealDialogOpen(true);
  };

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

  // Activity handlers
  const handleAddActivity = () => {
    setEditingActivity(null);
    setActivityFormData({
      name: '',
      caloriesBurned: '',
      duration: '',
      type: 'cardio',
      time: ''
    });
    setActivityDialogOpen(true);
  };

  const handleEditActivity = (activity: Activity) => {
    setEditingActivity(activity);
    setActivityFormData({
      name: activity.name,
      caloriesBurned: activity.caloriesBurned.toString(),
      duration: activity.duration.toString(),
      type: activity.type,
      time: new Date(activity.time).toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    });
    setActivityDialogOpen(true);
  };

  const handleDeleteActivity = (activityId: string) => {
    (async () => {
      try {
        await apiService.deleteActivityLog(activityId);
        await fetchLogData();
      } catch (error) {
        console.error('Error deleting activity:', error);
      }
    })();
  };

  const handleSaveActivity = () => {
    if (!activityFormData.name || !activityFormData.caloriesBurned || !activityFormData.duration) return;
    if (!activityFormData.time) return;

    (async () => {
      try {
        const isoDate = toIsoDate(selectedDate);
        const time = new Date(`${isoDate}T${activityFormData.time}:00`);
        const payload = {
          user_id: user.id,
          date: isoDate,
          name: activityFormData.name,
          calories_burned: parseInt(activityFormData.caloriesBurned, 10),
          duration: parseInt(activityFormData.duration, 10),
          type: activityFormData.type,
          time: time.toISOString(),
        };

        if (editingActivity) {
          await apiService.updateActivityLog(editingActivity.id, payload);
        } else {
          await apiService.createActivityLog(payload);
        }

        setActivityDialogOpen(false);
        await fetchLogData();
      } catch (error) {
        console.error('Error saving activity:', error);
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

  const getActivityTypeIcon = (type: Activity['type']) => {
    switch (type) {
      case 'cardio':
        return '🏃';
      case 'strength':
        return '💪';
      case 'flexibility':
        return '🧘';
      default:
        return '⚡';
    }
  };

  const getActivityTypeColor = (type: Activity['type']) => {
    switch (type) {
      case 'cardio':
        return 'error';
      case 'strength':
        return 'warning';
      case 'flexibility':
        return 'success';
      default:
        return 'default';
    }
  };

  const totalPlannedCalories = plannedMeals.reduce((sum, meal) => sum + meal.calories, 0);
  const totalActualCalories = actualMeals.reduce((sum, meal) => sum + (meal.actualCalories || meal.calories), 0);
  const totalCaloriesBurned = activities.reduce((sum, activity) => sum + activity.caloriesBurned, 0);

  const isToday = selectedDate.toDateString() === new Date().toDateString();
  const isPast = selectedDate < new Date(new Date().setHours(0, 0, 0, 0));
  const isFuture = selectedDate > new Date(new Date().setHours(23, 59, 59, 999));

  if (loading) {
    return <LinearProgress />;
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4">
            My Log 📝
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <DatePicker
              value={selectedDate}
              onChange={handleDateChange}
              slotProps={{
                textField: {
                  size: 'small',
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
        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          <Card sx={{ flex: 1 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {isFuture ? 'Planned' : 'Calories'}
              </Typography>
              <Typography variant="h4" color="primary">
                {Math.round(isFuture ? totalPlannedCalories : totalActualCalories)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {isFuture ? 'planned calories' : 'calories consumed'}
              </Typography>
            </CardContent>
          </Card>
          
          {!isFuture && (
            <Card sx={{ flex: 1 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Calories Burned
                </Typography>
                <Typography variant="h4" color="success.main">
                  {Math.round(totalCaloriesBurned)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {activities.length} activities logged
                </Typography>
              </CardContent>
            </Card>
          )}
          
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

        {/* Tabs */}
        <Card>
          <CardContent sx={{ p: 0 }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={tabValue} onChange={handleTabChange} aria-label="log tabs">
                <Tab label="Meals" icon={<Restaurant />} iconPosition="start" />
                <Tab label="Activities" icon={<FitnessCenter />} iconPosition="start" />
              </Tabs>
            </Box>

            <TabPanel value={tabValue} index={0}>
              <Box sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">
                    {isFuture ? 'Planned Meals' : 'Meals'}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {isFuture && (
                      <Button
                        variant="contained"
                        startIcon={<Add />}
                        onClick={() => handleAddMeal(true)}
                      >
                        Plan Meal
                      </Button>
                    )}
                    {!isFuture && (
                      <Button
                        variant="contained"
                        startIcon={<Add />}
                        onClick={() => handleAddMeal(false)}
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
                    {/* Show planned meals first for future dates, actual meals first for past/current dates */}
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
                          '&:last-child': { mb: 0 }
                        }}
                      >
                        <ListItemAvatar>
                          <Avatar sx={{ 
                            bgcolor: meal.isPlanned ? 'primary.light' : 'secondary.light' 
                          }}>
                            {getMealTypeIcon(meal.type)}
                          </Avatar>
                        </ListItemAvatar>
                        
	                        <ListItemText
	                          primaryTypographyProps={{ component: 'div' }}
	                          secondaryTypographyProps={{ component: 'div' }}
	                          primary={
	                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
	                              <Typography variant="subtitle1" fontWeight="bold">
	                                {meal.name}
	                              </Typography>
                              <Chip
                                label={meal.type}
                                size="small"
                                color={meal.isPlanned ? 'primary' : 'secondary'}
                                variant="outlined"
                              />
                              <Chip
                                label={meal.isPlanned ? 'Planned' : 'Logged'}
                                size="small"
                                color={meal.isPlanned ? 'info' : 'success'}
                                variant="outlined"
                              />
                            </Box>
                          }
                          secondary={
                            <Box>
                              <Typography variant="body2" color="text.secondary">
                                {Math.round((meal as ActualMeal).actualCalories || meal.calories)} calories
                              </Typography>
                              {meal.description && (
                                <Typography variant="body2" color="text.secondary">
                                  {meal.description}
                                </Typography>
                              )}
                              {(meal as ActualMeal).notes && (
                                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                  Note: {(meal as ActualMeal).notes}
                                </Typography>
                              )}
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                <Schedule sx={{ fontSize: 16 }} />
                                <Typography variant="caption" color="text.secondary">
                                  {new Date(meal.time).toLocaleTimeString()}
                                </Typography>
                              </Box>
                            </Box>
                          }
                        />
                        
                        <Box sx={{ display: 'flex', gap: 1 }}>
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
            </TabPanel>

            <TabPanel value={tabValue} index={1}>
              <Box sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">
                    Activities
                  </Typography>
                  {!isFuture && (
                    <Button
                      variant="contained"
                      startIcon={<Add />}
                      onClick={handleAddActivity}
                    >
                      Log Activity
                    </Button>
                  )}
                </Box>

                {activities.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <DirectionsRun sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                      {isFuture ? 'No activities planned' : 'No activities logged yet'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {isFuture ? 'Activities can only be logged after they happen' : 'Start by logging your exercise and activities'}
                    </Typography>
                  </Box>
                ) : (
                  <List>
                    {activities
                      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
                      .map((activity) => (
                      <ListItem
                        key={activity.id}
                        sx={{
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 1,
                          mb: 1,
                          '&:last-child': { mb: 0 }
                        }}
                      >
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: `${getActivityTypeColor(activity.type)}.light` }}>
                            {getActivityTypeIcon(activity.type)}
                          </Avatar>
                        </ListItemAvatar>
                        
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="subtitle1" fontWeight="bold">
                                {activity.name}
                              </Typography>
                              <Chip
                                label={activity.type}
                                size="small"
                                color={getActivityTypeColor(activity.type) as any}
                                variant="outlined"
                              />
                            </Box>
                          }
                          secondary={
                            <Box>
                              <Typography variant="body2" color="text.secondary">
                                {Math.round(activity.caloriesBurned)} calories burned • {activity.duration} minutes
                              </Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                <Schedule sx={{ fontSize: 16 }} />
                                <Typography variant="caption" color="text.secondary">
                                  {new Date(activity.time).toLocaleTimeString()}
                                </Typography>
                              </Box>
                            </Box>
                          }
                        />
                        
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <IconButton
                            size="small"
                            onClick={() => handleEditActivity(activity)}
                          >
                            <Edit />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteActivity(activity.id)}
                          >
                            <Delete />
                          </IconButton>
                        </Box>
                      </ListItem>
                    ))}
                  </List>
                )}
              </Box>
            </TabPanel>
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

        {/* Activity Dialog */}
        <Dialog open={activityDialogOpen} onClose={() => setActivityDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>
            {editingActivity ? 'Edit Activity' : 'Log Activity'}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              <TextField
                label="Activity Name"
                value={activityFormData.name}
                onChange={(e) => setActivityFormData(prev => ({ ...prev, name: e.target.value }))}
                fullWidth
                required
              />
              
              <TextField
                label="Calories Burned"
                type="number"
                value={activityFormData.caloriesBurned}
                onChange={(e) => setActivityFormData(prev => ({ ...prev, caloriesBurned: e.target.value }))}
                fullWidth
                required
              />
              
              <TextField
                label="Duration (minutes)"
                type="number"
                value={activityFormData.duration}
                onChange={(e) => setActivityFormData(prev => ({ ...prev, duration: e.target.value }))}
                fullWidth
                required
              />
              
              <FormControl fullWidth>
                <InputLabel>Activity Type</InputLabel>
                <Select
                  value={activityFormData.type}
                  label="Activity Type"
                  onChange={(e) => setActivityFormData(prev => ({ ...prev, type: e.target.value as Activity['type'] }))}
                >
                  <MenuItem value="cardio">Cardio</MenuItem>
                  <MenuItem value="strength">Strength Training</MenuItem>
                  <MenuItem value="flexibility">Flexibility/Yoga</MenuItem>
                  <MenuItem value="other">Other</MenuItem>
                </Select>
              </FormControl>
              
              <TextField
                label="Time"
                type="time"
                value={activityFormData.time}
                onChange={(e) => setActivityFormData(prev => ({ ...prev, time: e.target.value }))}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setActivityDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveActivity}
              variant="contained"
              disabled={!activityFormData.name || !activityFormData.caloriesBurned || !activityFormData.duration}
            >
              {editingActivity ? 'Update' : 'Log'} Activity
            </Button>
          </DialogActions>
        </Dialog>

        {/* Floating Action Buttons */}
        {isFuture && (
          <Fab
            color="primary"
            aria-label="plan meal"
            sx={{ position: 'fixed', bottom: 16, right: 16 }}
            onClick={() => handleAddMeal(true)}
          >
            <Add />
          </Fab>
        )}
        
        {!isFuture && (
          <>
            <Fab
              color="secondary"
              aria-label="log meal"
              sx={{ position: 'fixed', bottom: 16, right: 16 }}
              onClick={() => handleAddMeal(false)}
            >
              <Restaurant />
            </Fab>
            
            <Fab
              color="success"
              aria-label="log activity"
              sx={{ position: 'fixed', bottom: 80, right: 16 }}
              onClick={handleAddActivity}
            >
              <FitnessCenter />
            </Fab>
          </>
        )}
      </Box>
    </LocalizationProvider>
  );
};

export default Log;
