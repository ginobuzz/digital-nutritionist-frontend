import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  ListItemButton,
  ListItemText,
  ListItemAvatar,
  Alert,
  CircularProgress,
  InputAdornment,
} from '@mui/material';
import {
  Edit,
  Person,
  FitnessCenter,
  TrendingDown,
  CalendarToday,
  Scale,
  Logout,
  Info,
  Gavel,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { User, WeightLog } from '../types';
import { calculateDailyExpenditure, calculateWeightLossTimeline, calculateProgressPercentage } from '../utils/calculations';
import { apiService, convertUserToBackend, convertUserFromBackend, convertWeightLogFromBackend, isUserNotFoundError } from '../services/api';
import { getUserFacingErrorMessage } from '../utils/errors';

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
  const [checkInWeight, setCheckInWeight] = useState('');
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [checkInSuccess, setCheckInSuccess] = useState<string | null>(null);
  const checkInTouchedRef = useRef(false);
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

  const latestWeightLog = useMemo(() => {
    if (!weightLogs.length) return null;
    return weightLogs.reduce((latest, current) => (current.date > latest.date ? current : latest), weightLogs[0]);
  }, [weightLogs]);

  const currentWeight = latestWeightLog?.weight || user.weight;

  useEffect(() => {
    if (checkInTouchedRef.current) return;
    setCheckInWeight(String(currentWeight));
  }, [currentWeight]);

  const handleEditProfile = () => {
    const dailyExpenditure = calculateDailyExpenditure(user);
    const derivedDailyDeficitTarget =
      user.dailyCalorieTarget > 0 ? Math.max(0, dailyExpenditure - user.dailyCalorieTarget) : 0;

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
      dailyDeficitTarget: Math.round(derivedDailyDeficitTarget).toString(),
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
      if (isUserNotFoundError(err)) {
        return;
      }
      setSaveError(
        getUserFacingErrorMessage(err, {
          action: 'save your profile changes',
          fallback: 'We couldn’t save your profile changes. Please try again.',
        })
      );
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

  const progressPercentage = calculateProgressPercentage(user, currentWeight);
  const weightLost = user.weight - currentWeight;
  const dailyExpenditure = calculateDailyExpenditure(user);
  const dailyDeficitTarget =
    user.dailyCalorieTarget > 0 ? Math.max(0, dailyExpenditure - user.dailyCalorieTarget) : 0;
  const timelineDays =
    dailyDeficitTarget > 0 && currentWeight > user.targetWeight
      ? calculateWeightLossTimeline({ ...user, weight: currentWeight, dailyDeficitTarget })
      : null;
  const timelineText =
    currentWeight <= user.targetWeight
      ? 'Goal reached'
      : timelineDays !== null && Number.isFinite(timelineDays)
        ? `${timelineDays} days to reach goal`
        : '—';

  const getWeightCheckInValidationError = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return 'Enter a weight.';
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) return 'Enter a valid number.';
    if (parsed < 50 || parsed > 1000) return 'Enter a realistic weight.';
    return null;
  };

  const handleWeightCheckIn = async () => {
    const validationError = getWeightCheckInValidationError(checkInWeight);
    if (validationError) {
      setCheckInError(validationError);
      setCheckInSuccess(null);
      return;
    }

    setCheckInLoading(true);
    setCheckInError(null);
    setCheckInSuccess(null);

    try {
      const todayIso = format(new Date(), 'yyyy-MM-dd');
      const weight = Number(checkInWeight.trim());
      const existingToday = weightLogs.find((log) => format(log.date, 'yyyy-MM-dd') === todayIso);

      const updated = existingToday
        ? await apiService.updateWeightLog(existingToday.id, { weight, date: todayIso, user_id: user.id })
        : await apiService.createWeightLog({ user_id: user.id, weight, date: todayIso });

      const nextLog = convertWeightLogFromBackend(updated);

      setWeightLogs((prev) => {
        if (!existingToday) return [...prev, nextLog];
        const replaced = prev.map((log) => (log.id === existingToday.id ? nextLog : log));
        if (replaced.some((log) => log.id === nextLog.id)) return replaced;
        return [...replaced, nextLog];
      });

      setCheckInSuccess(existingToday ? 'Updated today’s check-in.' : 'Saved today’s check-in.');
    } catch (err) {
      if (isUserNotFoundError(err)) {
        return;
      }
      setCheckInError(
        getUserFacingErrorMessage(err, {
          action: 'save your check-in',
          fallback: 'We couldn’t save your check-in. Please try again.',
        })
      );
    } finally {
      setCheckInLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        My Profile 👤
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Profile Overview and Progress */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Card>
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

          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'stretch' }}>
            <Card sx={{ flex: '1 1 400px' }}>
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

            <Card sx={{ flex: '1 1 400px' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Weight Check-in
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  Log today’s weight to keep your progress up to date.
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                  <TextField
                    label="Today’s weight"
                    value={checkInWeight}
                    onChange={(e) => {
                      checkInTouchedRef.current = true;
                      setCheckInWeight(e.target.value);
                      setCheckInError(null);
                      setCheckInSuccess(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleWeightCheckIn();
                      }
                    }}
                    type="number"
                    size="small"
                    fullWidth
                    disabled={checkInLoading}
                    placeholder={`${currentWeight}`}
                    inputProps={{ inputMode: 'decimal', step: '0.1', min: 50, max: 1000 }}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">lbs</InputAdornment>,
                    }}
                  />
                  <Button
                    variant="contained"
                    onClick={handleWeightCheckIn}
                    disabled={Boolean(getWeightCheckInValidationError(checkInWeight)) || checkInLoading}
                    startIcon={checkInLoading ? <CircularProgress size={18} /> : undefined}
                    sx={{ whiteSpace: 'nowrap' }}
                  >
                    Check in
                  </Button>
                </Box>
                {checkInError && (
                  <Alert severity="error" sx={{ mt: 1.5 }}>
                    {checkInError}
                  </Alert>
                )}
                {checkInSuccess && (
                  <Alert severity="success" sx={{ mt: 1.5 }}>
                    {checkInSuccess}
                  </Alert>
                )}
              </CardContent>
            </Card>
          </Box>
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
                    secondary={`${Math.round(dailyDeficitTarget)} calories per day`}
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
                    secondary={timelineText}
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
                    secondaryTypographyProps={{ component: 'div' }}
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
                  .slice()
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

        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              App
            </Typography>
            <List>
              <ListItem disablePadding>
                <ListItemButton onClick={() => navigate('/about')}>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: 'info.light' }}>
                      <Info />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary="About Sunday Mornings"
                    secondary="Learn how the app works"
                  />
                </ListItemButton>
              </ListItem>
              <ListItem disablePadding>
                <ListItemButton onClick={() => navigate('/legal')}>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: 'secondary.light' }}>
                      <Gavel />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary="Privacy, terms & consent"
                    secondary="See what data is stored and the medical disclaimer"
                  />
                </ListItemButton>
              </ListItem>
            </List>
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
