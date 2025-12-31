import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Avatar,
  Chip,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Edit,
  Person,
  FitnessCenter,
  TrendingDown,
  CalendarToday,
  Scale,
  Logout,
} from '@mui/icons-material';
import { User, WeightLog } from '../types';
import { calculateDailyExpenditure, calculateWeightLossTimeline, calculateProgressPercentage } from '../utils/calculations';
import { apiService, convertUserToBackend, convertUserFromBackend, convertWeightLogFromBackend } from '../services/api';

interface ProfileProps {
  user: User;
  onUserUpdate: (user: User) => void;
  onSignOut: () => void;
}

const Profile: React.FC<ProfileProps> = ({ user, onUserUpdate, onSignOut }) => {
  const navigate = useNavigate();
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [signOutDialogOpen, setSignOutDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    heightFeet: '',
    heightInches: '',
    weight: '',
    gender: 'female' as User['gender'],
    activityLevel: 'moderately_active' as User['activityLevel'],
    targetWeight: '',
    targetDate: '',
    dailyDeficitTarget: ''
  });

  useEffect(() => {
    const fetchWeightLogs = async () => {
      try {
        const logs = await apiService.getWeightLogs(user.id);
        setWeightLogs(logs.map(convertWeightLogFromBackend));
      } catch (error) {
        console.error('Error fetching weight logs:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchWeightLogs();
  }, [user.id]);

  const handleEditProfile = () => {
    setFormData({
      name: user.name,
      age: user.age.toString(),
      heightFeet: user.height.feet.toString(),
      heightInches: user.height.inches.toString(),
      weight: user.weight.toString(),
      gender: user.gender,
      activityLevel: user.activityLevel,
      targetWeight: user.targetWeight.toString(),
      targetDate: user.targetDate.toISOString().split('T')[0],
      dailyDeficitTarget: user.dailyDeficitTarget.toString()
    });
    setEditDialogOpen(true);
  };

  const handleConfirmSignOut = () => {
    setSignOutDialogOpen(false);
    onSignOut();
    navigate('/signin', { replace: true });
  };

  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSaveProfile = async () => {
    setSaveLoading(true);
    setSaveError(null);

    try {
      const dailyExpenditure = calculateDailyExpenditure({
        ...user,
        age: parseInt(formData.age),
        height: {
          feet: parseInt(formData.heightFeet),
          inches: parseInt(formData.heightInches)
        },
        weight: parseInt(formData.weight),
        gender: formData.gender,
        activityLevel: formData.activityLevel
      });

      const updatedUser: User = {
        ...user,
        name: formData.name,
        age: parseInt(formData.age),
        height: {
          feet: parseInt(formData.heightFeet),
          inches: parseInt(formData.heightInches)
        },
        weight: parseInt(formData.weight),
        gender: formData.gender,
        activityLevel: formData.activityLevel,
        targetWeight: parseInt(formData.targetWeight),
        targetDate: new Date(formData.targetDate),
        dailyDeficitTarget: parseInt(formData.dailyDeficitTarget),
        dailyCalorieTarget: dailyExpenditure - parseInt(formData.dailyDeficitTarget)
      };

      // Convert to backend format and update user
      const backendUserData = convertUserToBackend(updatedUser);
      const updatedUserResponse = await apiService.updateUser(user.id, backendUserData);
      
      // Convert back to frontend format
      const frontendUser = convertUserFromBackend(updatedUserResponse);
      onUserUpdate(frontendUser);
      setEditDialogOpen(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to update user profile');
      console.error('Error updating user:', err);
    } finally {
      setSaveLoading(false);
    }
  };

  const getActivityLevelDescription = (level: User['activityLevel']) => {
    switch (level) {
      case 'sedentary':
        return 'Little or no exercise';
      case 'lightly_active':
        return 'Light exercise 1-3 days/week';
      case 'moderately_active':
        return 'Moderate exercise 3-5 days/week';
      case 'very_active':
        return 'Hard exercise 6-7 days/week';
      case 'extremely_active':
        return 'Very hard exercise, physical job';
      default:
        return '';
    }
  };

  const getGenderLabel = (gender: User['gender']) => {
    return gender === 'male' ? 'Male' : 'Female';
  };

  if (loading) {
    return <LinearProgress />;
  }

  const currentWeight = weightLogs[weightLogs.length - 1]?.weight || user.weight;
  const progressPercentage = calculateProgressPercentage(user, currentWeight);
  const weightLost = user.weight - currentWeight;
  const timeline = calculateWeightLossTimeline(user);
  const dailyExpenditure = calculateDailyExpenditure(user);

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        My Profile 👤
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Profile Overview and Progress */}
        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          <Card sx={{ flex: '1 1 600px' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar sx={{ width: 80, height: 80, bgcolor: 'primary.main' }}>
                    <Person sx={{ fontSize: 40 }} />
                  </Avatar>
                  <Box>
                    <Typography variant="h5" fontWeight="bold">
                      {user.name}
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                      {user.age} years old • {getGenderLabel(user.gender)}
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <Button
                    variant="outlined"
                    startIcon={<Edit />}
                    onClick={handleEditProfile}
                  >
                    Edit Profile
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<Logout />}
                    onClick={() => setSignOutDialogOpen(true)}
                  >
                    Sign Out
                  </Button>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Box sx={{ flex: '1 1 150px', minWidth: 120 }}>
                  <Typography variant="body2" color="text.secondary">
                    Height
                  </Typography>
                  <Typography variant="h6">
                    {user.height.feet}'{user.height.inches}"
                  </Typography>
                </Box>
                <Box sx={{ flex: '1 1 150px', minWidth: 120 }}>
                  <Typography variant="body2" color="text.secondary">
                    Current Weight
                  </Typography>
                  <Typography variant="h6">
                    {currentWeight} lbs
                  </Typography>
                </Box>
                <Box sx={{ flex: '1 1 150px', minWidth: 120 }}>
                  <Typography variant="body2" color="text.secondary">
                    Target Weight
                  </Typography>
                  <Typography variant="h6">
                    {user.targetWeight} lbs
                  </Typography>
                </Box>
                <Box sx={{ flex: '1 1 150px', minWidth: 120 }}>
                  <Typography variant="body2" color="text.secondary">
                    Weight Lost
                  </Typography>
                  <Typography variant="h6" color="success.main">
                    {weightLost.toFixed(1)} lbs
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          <Card sx={{ flex: '0 1 300px' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Progress to Goal
              </Typography>
              <Box sx={{ textAlign: 'center', mb: 2 }}>
                <Typography variant="h3" color="primary" gutterBottom>
                  {progressPercentage.toFixed(1)}%
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={progressPercentage}
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>
              <Typography variant="body2" color="text.secondary" align="center">
                {weightLost.toFixed(1)}lbs lost of {(user.weight - user.targetWeight).toFixed(1)}lbs goal
              </Typography>
            </CardContent>
          </Card>
        </Box>

        {/* Goals and Activity */}
        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          <Card sx={{ flex: '1 1 400px' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Weight Loss Goals
              </Typography>
              <List>
                <ListItem>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: 'primary.light' }}>
                      <TrendingDown />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary="Daily Calorie Deficit"
                    secondary={`${Math.round(user.dailyDeficitTarget)} calories per day`}
                  />
                </ListItem>
                <ListItem>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: 'secondary.light' }}>
                      <CalendarToday />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary="Target Date"
                    secondary={user.targetDate.toLocaleDateString()}
                  />
                </ListItem>
                <ListItem>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: 'info.light' }}>
                      <Scale />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary="Estimated Timeline"
                    secondary={`${timeline} days to reach goal`}
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>

          <Card sx={{ flex: '1 1 400px' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Activity & Nutrition
              </Typography>
              <List>
                <ListItem>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: 'warning.light' }}>
                      <FitnessCenter />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary="Activity Level"
                    secondary={
                      <Box>
                        <Typography variant="body2">
                          {getActivityLevelDescription(user.activityLevel)}
                        </Typography>
                        <Chip
                          label={user.activityLevel.replace('_', ' ')}
                          size="small"
                          color="warning"
                          variant="outlined"
                          sx={{ mt: 0.5 }}
                        />
                      </Box>
                    }
                  />
                </ListItem>
                <ListItem>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: 'success.light' }}>
                      <Person />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary="Daily Calorie Target"
                    secondary={`${Math.round(user.dailyCalorieTarget)} calories per day`}
                  />
                </ListItem>
                <ListItem>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: 'info.light' }}>
                      <TrendingDown />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary="Daily Calorie Expenditure"
                    secondary={`${Math.round(dailyExpenditure)} calories per day`}
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Box>

        {/* Weight History */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Weight History
            </Typography>
            {weightLogs.length === 0 ? (
              <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                No weight logs yet. Start tracking your progress!
              </Typography>
            ) : (
              <List>
                {weightLogs
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((log, index) => (
                  <ListItem key={log.id}>
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: 'primary.light' }}>
                        <Scale />
                      </Avatar>
                    </ListItemAvatar>
                                          <ListItemText
                        primary={`${log.weight} lbs`}
                        secondary={log.date.toLocaleDateString()}
                      />
                    {index === 0 && (
                      <Chip label="Current" color="primary" size="small" />
                    )}
                    {log.notes && (
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                        {log.notes}
                      </Typography>
                    )}
                  </ListItem>
                ))}
              </List>
            )}
          </CardContent>
        </Card>
      </Box>

      {/* Edit Profile Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Edit Profile
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                label="Name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                sx={{ flex: '1 1 200px' }}
                required
              />
              <TextField
                label="Age"
                type="number"
                value={formData.age}
                onChange={(e) => setFormData(prev => ({ ...prev, age: e.target.value }))}
                sx={{ flex: '1 1 200px' }}
                required
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                label="Height (feet)"
                type="number"
                value={formData.heightFeet}
                onChange={(e) => setFormData(prev => ({ ...prev, heightFeet: e.target.value }))}
                sx={{ flex: '1 1 100px' }}
                required
              />
              <TextField
                label="Height (inches)"
                type="number"
                value={formData.heightInches}
                onChange={(e) => setFormData(prev => ({ ...prev, heightInches: e.target.value }))}
                sx={{ flex: '1 1 100px' }}
                required
              />
              <TextField
                label="Current Weight (lbs)"
                type="number"
                value={formData.weight}
                onChange={(e) => setFormData(prev => ({ ...prev, weight: e.target.value }))}
                sx={{ flex: '1 1 200px' }}
                required
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <FormControl sx={{ flex: '1 1 200px' }}>
                <InputLabel>Gender</InputLabel>
                <Select
                  value={formData.gender}
                  label="Gender"
                  onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value as User['gender'] }))}
                >
                  <MenuItem value="male">Male</MenuItem>
                  <MenuItem value="female">Female</MenuItem>
                </Select>
              </FormControl>
              <FormControl sx={{ flex: '1 1 200px' }}>
                <InputLabel>Activity Level</InputLabel>
                <Select
                  value={formData.activityLevel}
                  label="Activity Level"
                  onChange={(e) => setFormData(prev => ({ ...prev, activityLevel: e.target.value as User['activityLevel'] }))}
                >
                  <MenuItem value="sedentary">Sedentary</MenuItem>
                  <MenuItem value="lightly_active">Lightly Active</MenuItem>
                  <MenuItem value="moderately_active">Moderately Active</MenuItem>
                  <MenuItem value="very_active">Very Active</MenuItem>
                  <MenuItem value="extremely_active">Extremely Active</MenuItem>
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <TextField
                label="Target Weight (lbs)"
                type="number"
                value={formData.targetWeight}
                onChange={(e) => setFormData(prev => ({ ...prev, targetWeight: e.target.value }))}
                sx={{ flex: '1 1 200px' }}
                required
              />
              <TextField
                label="Target Date"
                type="date"
                value={formData.targetDate}
                onChange={(e) => setFormData(prev => ({ ...prev, targetDate: e.target.value }))}
                sx={{ flex: '1 1 200px' }}
                required
                InputLabelProps={{ shrink: true }}
              />
            </Box>
            <TextField
              label="Daily Calorie Deficit"
              type="number"
              value={formData.dailyDeficitTarget}
              onChange={(e) => setFormData(prev => ({ ...prev, dailyDeficitTarget: e.target.value }))}
              fullWidth
              required
              helperText="Recommended: 500 calories for ~1 lb/week weight loss"
            />
          </Box>
        </DialogContent>
        {saveError && (
          <Alert severity="error" sx={{ mx: 2, mb: 2 }}>
            {saveError}
          </Alert>
        )}
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)} disabled={saveLoading}>
            Cancel
          </Button>
          <Button 
            onClick={handleSaveProfile}
            variant="contained"
            disabled={!formData.name || !formData.age || !formData.heightFeet || !formData.heightInches || !formData.weight || !formData.targetWeight || !formData.targetDate || !formData.dailyDeficitTarget || saveLoading}
            startIcon={saveLoading ? <CircularProgress size={20} /> : undefined}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={signOutDialogOpen} onClose={() => setSignOutDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Sign out?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            You’ll need to sign in again to access your dashboard and logs.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSignOutDialogOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirmSignOut} variant="contained" color="error" startIcon={<Logout />}>
            Sign Out
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Profile; 
