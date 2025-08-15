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
  LinearProgress
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Schedule,
  LocalDining
} from '@mui/icons-material';
import { PlannedMeal } from '../types';
import { mockAPI } from '../data/mockData';

const Plan: React.FC = () => {
  const [plannedMeals, setPlannedMeals] = useState<PlannedMeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMeal, setEditingMeal] = useState<PlannedMeal | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    calories: '',
    type: 'breakfast' as PlannedMeal['type'],
    description: '',
    time: ''
  });

  useEffect(() => {
    fetchPlannedMeals();
  }, []);

  const fetchPlannedMeals = async () => {
    try {
      const meals = await mockAPI.getPlannedMeals(new Date());
      setPlannedMeals(meals);
    } catch (error) {
      console.error('Error fetching planned meals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMeal = () => {
    setEditingMeal(null);
    setFormData({
      name: '',
      calories: '',
      type: 'breakfast',
      description: '',
      time: ''
    });
    setDialogOpen(true);
  };

  const handleEditMeal = (meal: PlannedMeal) => {
    setEditingMeal(meal);
    setFormData({
      name: meal.name,
      calories: meal.calories.toString(),
      type: meal.type,
      description: meal.description || '',
      time: new Date(meal.time).toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    });
    setDialogOpen(true);
  };

  const handleDeleteMeal = (mealId: string) => {
    setPlannedMeals(prev => prev.filter(meal => meal.id !== mealId));
  };

  const handleSaveMeal = () => {
    if (!formData.name || !formData.calories) return;

    const newMeal: PlannedMeal = {
      id: editingMeal?.id || Date.now().toString(),
      name: formData.name,
      calories: parseInt(formData.calories),
      type: formData.type,
      description: formData.description,
      time: new Date(`2024-01-15T${formData.time}:00`),
      isPlanned: true
    };

    if (editingMeal) {
      setPlannedMeals(prev => prev.map(meal => 
        meal.id === editingMeal.id ? newMeal : meal
      ));
    } else {
      setPlannedMeals(prev => [...prev, newMeal]);
    }

    setDialogOpen(false);
  };

  const getMealTypeIcon = (type: PlannedMeal['type']) => {
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

  const getMealTypeColor = (type: PlannedMeal['type']) => {
    switch (type) {
      case 'breakfast':
        return 'warning';
      case 'lunch':
        return 'info';
      case 'dinner':
        return 'primary';
      case 'snack':
        return 'success';
      default:
        return 'default';
    }
  };

  const totalPlannedCalories = plannedMeals.reduce((sum, meal) => sum + meal.calories, 0);

  if (loading) {
    return <LinearProgress />;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          My Plan 📋
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleAddMeal}
        >
          Add Meal
        </Button>
      </Box>

      {/* Summary Card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Today's Plan Summary
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h4" color="primary">
              {Math.round(totalPlannedCalories)}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              planned calories
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {plannedMeals.length} meals planned for today
          </Typography>
        </CardContent>
      </Card>

      {/* Meals List */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Planned Meals
          </Typography>
          
          {plannedMeals.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <LocalDining sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No meals planned yet
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Start by adding your planned meals for today
              </Typography>
            </Box>
          ) : (
            <List>
              {plannedMeals
                .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
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
                    <Avatar sx={{ bgcolor: `${getMealTypeColor(meal.type)}.light` }}>
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
                          color={getMealTypeColor(meal.type) as any}
                          variant="outlined"
                        />
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          {Math.round(meal.calories)} calories
                        </Typography>
                        {meal.description && (
                          <Typography variant="body2" color="text.secondary">
                            {meal.description}
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
        </CardContent>
      </Card>

      {/* Add/Edit Meal Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingMeal ? 'Edit Planned Meal' : 'Add Planned Meal'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Meal Name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              fullWidth
              required
            />
            
            <TextField
              label="Calories"
              type="number"
              value={formData.calories}
              onChange={(e) => setFormData(prev => ({ ...prev, calories: e.target.value }))}
              fullWidth
              required
            />
            
            <FormControl fullWidth>
              <InputLabel>Meal Type</InputLabel>
              <Select
                value={formData.type}
                label="Meal Type"
                onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as PlannedMeal['type'] }))}
              >
                <MenuItem value="breakfast">Breakfast</MenuItem>
                <MenuItem value="lunch">Lunch</MenuItem>
                <MenuItem value="dinner">Dinner</MenuItem>
                <MenuItem value="snack">Snack</MenuItem>
              </Select>
            </FormControl>
            
            <TextField
              label="Description (optional)"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              fullWidth
              multiline
              rows={2}
            />
            
            <TextField
              label="Time"
              type="time"
              value={formData.time}
              onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSaveMeal}
            variant="contained"
            disabled={!formData.name || !formData.calories}
          >
            {editingMeal ? 'Update' : 'Add'} Meal
          </Button>
        </DialogActions>
      </Dialog>

      {/* Floating Action Button */}
      <Fab
        color="primary"
        aria-label="add meal"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        onClick={handleAddMeal}
      >
        <Add />
      </Fab>
    </Box>
  );
};

export default Plan; 