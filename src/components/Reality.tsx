import React, { useState, useEffect } from 'react';
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
  Tab
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Restaurant,
  FitnessCenter,
  Schedule,
  LocalDining,
  DirectionsRun
} from '@mui/icons-material';
import { ActualMeal, Activity } from '../types';
import { mockAPI } from '../data/mockData';

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
      id={`reality-tabpanel-${index}`}
      aria-labelledby={`reality-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

const Reality: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [actualMeals, setActualMeals] = useState<ActualMeal[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [mealDialogOpen, setMealDialogOpen] = useState(false);
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [editingMeal, setEditingMeal] = useState<ActualMeal | null>(null);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [mealFormData, setMealFormData] = useState({
    name: '',
    calories: '',
    type: 'breakfast' as ActualMeal['type'],
    description: '',
    time: '',
    notes: ''
  });
  const [activityFormData, setActivityFormData] = useState({
    name: '',
    caloriesBurned: '',
    duration: '',
    type: 'cardio' as Activity['type'],
    time: ''
  });

  useEffect(() => {
    fetchRealityData();
  }, []);

  const fetchRealityData = async () => {
    try {
      const [meals, acts] = await Promise.all([
        mockAPI.getActualMeals(new Date()),
        mockAPI.getActivities(new Date())
      ]);
      setActualMeals(meals);
      setActivities(acts);
    } catch (error) {
      console.error('Error fetching reality data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // Meal handlers
  const handleAddMeal = () => {
    setEditingMeal(null);
    setMealFormData({
      name: '',
      calories: '',
      type: 'breakfast',
      description: '',
      time: '',
      notes: ''
    });
    setMealDialogOpen(true);
  };

  const handleEditMeal = (meal: ActualMeal) => {
    setEditingMeal(meal);
    setMealFormData({
      name: meal.name,
      calories: meal.actualCalories?.toString() || meal.calories.toString(),
      type: meal.type,
      description: meal.description || '',
      time: new Date(meal.time).toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
      notes: meal.notes || ''
    });
    setMealDialogOpen(true);
  };

  const handleDeleteMeal = (mealId: string) => {
    setActualMeals(prev => prev.filter(meal => meal.id !== mealId));
  };

  const handleSaveMeal = () => {
    if (!mealFormData.name || !mealFormData.calories) return;

    const newMeal: ActualMeal = {
      id: editingMeal?.id || Date.now().toString(),
      name: mealFormData.name,
      calories: parseInt(mealFormData.calories),
      type: mealFormData.type,
      description: mealFormData.description,
      time: new Date(`2024-01-15T${mealFormData.time}:00`),
      isPlanned: false,
      actualCalories: parseInt(mealFormData.calories),
      notes: mealFormData.notes
    };

    if (editingMeal) {
      setActualMeals(prev => prev.map(meal => 
        meal.id === editingMeal.id ? newMeal : meal
      ));
    } else {
      setActualMeals(prev => [...prev, newMeal]);
    }

    setMealDialogOpen(false);
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
    setActivities(prev => prev.filter(activity => activity.id !== activityId));
  };

  const handleSaveActivity = () => {
    if (!activityFormData.name || !activityFormData.caloriesBurned || !activityFormData.duration) return;

    const newActivity: Activity = {
      id: editingActivity?.id || Date.now().toString(),
      name: activityFormData.name,
      caloriesBurned: parseInt(activityFormData.caloriesBurned),
      duration: parseInt(activityFormData.duration),
      type: activityFormData.type,
      time: new Date(`2024-01-15T${activityFormData.time}:00`)
    };

    if (editingActivity) {
      setActivities(prev => prev.map(activity => 
        activity.id === editingActivity.id ? newActivity : activity
      ));
    } else {
      setActivities(prev => [...prev, newActivity]);
    }

    setActivityDialogOpen(false);
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

  const totalActualCalories = actualMeals.reduce((sum, meal) => sum + (meal.actualCalories || meal.calories), 0);
  const totalCaloriesBurned = activities.reduce((sum, activity) => sum + activity.caloriesBurned, 0);

  if (loading) {
    return <LinearProgress />;
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        My Reality 📊
      </Typography>

      {/* Summary Cards */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Calories Consumed
            </Typography>
            <Typography variant="h4" color="secondary">
              {totalActualCalories}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {actualMeals.length} meals logged
            </Typography>
          </CardContent>
        </Card>
        
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Calories Burned
            </Typography>
            <Typography variant="h4" color="success.main">
              {totalCaloriesBurned}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {activities.length} activities logged
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Tabs */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={tabValue} onChange={handleTabChange} aria-label="reality tabs">
              <Tab label="Meals" icon={<Restaurant />} iconPosition="start" />
              <Tab label="Activities" icon={<FitnessCenter />} iconPosition="start" />
            </Tabs>
          </Box>

          <TabPanel value={tabValue} index={0}>
            <Box sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  Actual Meals
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={handleAddMeal}
                >
                  Log Meal
                </Button>
              </Box>

              {actualMeals.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <LocalDining sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    No meals logged yet
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Start by logging what you actually ate today
                  </Typography>
                </Box>
              ) : (
                <List>
                  {actualMeals
                    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
                    .map((meal) => (
                    <ListItem
                      key={meal.id}
                      sx={{
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                        mb: 1,
                        '&:last-child': { mb: 0 }
                      }}
                    >
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: 'secondary.light' }}>
                          {getMealTypeIcon(meal.type)}
                        </Avatar>
                      </ListItemAvatar>
                      
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="subtitle1" fontWeight="bold">
                              {meal.name}
                            </Typography>
                            <Chip
                              label={meal.type}
                              size="small"
                              color="secondary"
                              variant="outlined"
                            />
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              {meal.actualCalories || meal.calories} calories
                            </Typography>
                            {meal.description && (
                              <Typography variant="body2" color="text.secondary">
                                {meal.description}
                              </Typography>
                            )}
                            {meal.notes && (
                              <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                Note: {meal.notes}
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
                          onClick={() => handleDeleteMeal(meal.id)}
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
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={handleAddActivity}
                >
                  Log Activity
                </Button>
              </Box>

              {activities.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <DirectionsRun sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    No activities logged yet
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Start by logging your exercise and activities
                  </Typography>
                </Box>
              ) : (
                <List>
                  {activities
                    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
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
                              {activity.caloriesBurned} calories burned • {activity.duration} minutes
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
          {editingMeal ? 'Edit Actual Meal' : 'Log Actual Meal'}
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
            {editingMeal ? 'Update' : 'Log'} Meal
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
      <Fab
        color="secondary"
        aria-label="log meal"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        onClick={handleAddMeal}
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
    </Box>
  );
};

export default Reality; 