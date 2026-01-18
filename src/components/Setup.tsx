import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stepper,
  Step,
  StepLabel,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormLabel,
  Chip, 
  Alert,
  CircularProgress,
  useTheme,
  useMediaQuery,
  Link,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { User } from '../types';
import { apiService, convertUserToBackend, convertUserFromBackend, isUserNotFoundError } from '../services/api';
import { authService } from '../services/auth';
import { calculateDailyCalorieTarget, calculateDailyExpenditure } from '../utils/calculations';

interface SetupProps {
  onComplete: (user: User) => void;
}

const Setup: React.FC<SetupProps> = ({ onComplete }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [heightFeetInput, setHeightFeetInput] = useState<string>(() => (5).toString());
  const [heightInchesInput, setHeightInchesInput] = useState<string>(() => (8).toString());
  const [weightInput, setWeightInput] = useState<string>(() => (150).toString());
  const [userData, setUserData] = useState<Partial<User>>({
    name: '',
    age: 25,
    height: { feet: 5, inches: 8 },
    weight: 150,
    gender: 'male',
    activityLevel: 'moderately_active',
    targetWeight: 140,
    targetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
  });

  const steps = [
    'Basic Info',
    'Physical Stats',
    'Activity',
    'Goals',
    'Review'
  ];

  const handleNext = async () => {
    if (activeStep === steps.length - 1) {
      // Complete setup
      setLoading(true);
      setError(null);
      
      try {
        // Calculate daily calorie target and deficit
        const dailyExpenditure = calculateDailyExpenditure({
          id: '',
          name: userData.name!,
          age: userData.age!,
          height: userData.height!,
          weight: userData.weight!,
          gender: userData.gender!,
          activityLevel: userData.activityLevel!,
          targetWeight: userData.targetWeight!,
          targetDate: userData.targetDate!,
          dailyCalorieTarget: 0,
          dailyDeficitTarget: 0,
        });
        
        const weightToLose = userData.weight! - userData.targetWeight!;
        const daysToTarget = Math.ceil((userData.targetDate!.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        const desiredDeficitTarget = Math.round(weightToLose * 3500 / daysToTarget); // 3500 calories = 1 lb
        const dailyCalorieTarget = calculateDailyCalorieTarget({
          id: '',
          name: userData.name!,
          age: userData.age!,
          height: userData.height!,
          weight: userData.weight!,
          gender: userData.gender!,
          activityLevel: userData.activityLevel!,
          targetWeight: userData.targetWeight!,
          targetDate: userData.targetDate!,
          dailyCalorieTarget: 0,
          dailyDeficitTarget: desiredDeficitTarget,
        });
        const dailyDeficitTarget = Math.max(0, dailyExpenditure - dailyCalorieTarget);

        const completeUser: User = {
          id: '', // Will be set by backend
          name: userData.name!,
          age: userData.age!,
          height: userData.height!,
          weight: userData.weight!,
          gender: userData.gender!,
          activityLevel: userData.activityLevel!,
          targetWeight: userData.targetWeight!,
          targetDate: userData.targetDate!,
          dailyCalorieTarget: dailyCalorieTarget,
          dailyDeficitTarget: dailyDeficitTarget,
        };

        // Convert to backend format and signup user via auth
        const backendUserData = convertUserToBackend(completeUser);
        const signupPayload = { ...backendUserData, email: email || backendUserData.email, password: password || backendUserData.password } as any;
        const signupResult = await authService.signup(signupPayload);

        // Immediately log in to obtain token
        const loginResult = await authService.login(signupPayload.email, signupPayload.password);
        authService.setToken(loginResult.access_token);
        apiService.setAuthToken(loginResult.access_token);

        // Resolve user id from auth response first, falling back to token
        const idFromAuth = loginResult.user?.id ?? signupResult.id;
        const id = (idFromAuth !== undefined && idFromAuth !== null)
          ? idFromAuth
          : authService.getUserIdFromToken(loginResult.access_token);
        if (id === null || id === undefined) throw new Error('Unable to resolve user from token');
        const createdUser = await apiService.getUser(String(id));
        
        // Convert back to frontend format
        const frontendUser = convertUserFromBackend(createdUser);
        onComplete(frontendUser);
      } catch (err) {
        if (isUserNotFoundError(err)) {
          return;
        }
        setError(err instanceof Error ? err.message : 'Failed to create user profile');
        console.error('Error creating user:', err);
      } finally {
        setLoading(false);
      }
    } else {
      setActiveStep((prevStep) => prevStep + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  const updateUserData = (field: keyof User, value: any) => {
    setUserData(prev => ({ ...prev, [field]: value }));
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Box sx={{ 
            p: { xs: 1, sm: 3 },
            minHeight: { xs: 'auto', sm: 'auto' },
            '& .MuiTextField-root': { mb: 3 },
            '& .MuiFormControl-root': { mb: 3 }
          }}>
            <Typography 
              variant={isMobile ? "h6" : "h5"} 
              gutterBottom 
              sx={{ 
                fontSize: { xs: '1.25rem', sm: '1.5rem' },
                mb: { xs: 2, sm: 3 }
              }}
            >
              Let's get to know you
            </Typography>
            <Typography 
              variant="body2" 
              color="text.secondary" 
              sx={{ 
                mb: { xs: 2, sm: 3 },
                fontSize: { xs: '0.875rem', sm: '1rem' }
              }}
            >
              We'll use this information to create your personalized nutrition plan.
            </Typography>
            
            <TextField
              fullWidth
              label="Full Name"
              value={userData.name}
              onChange={(e) => updateUserData('name', e.target.value)}
              size={isMobile ? "small" : "medium"}
              sx={{ 
                '& .MuiInputBase-root': {
                  height: { xs: '48px', sm: '56px' }
                }
              }}
            />

            <TextField
              fullWidth
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              size={isMobile ? "small" : "medium"}
              sx={{ 
                '& .MuiInputBase-root': {
                  height: { xs: '48px', sm: '56px' }
                }
              }}
            />

            <TextField
              fullWidth
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              size={isMobile ? "small" : "medium"}
              sx={{ 
                '& .MuiInputBase-root': {
                  height: { xs: '48px', sm: '56px' }
                }
              }}
            />
            
            <TextField
              fullWidth
              label="Age"
              type="number"
              value={userData.age?.toString() ?? ''}
              onChange={(e) => {
                const next = e.target.value;
                updateUserData('age', next === '' ? 0 : parseInt(next, 10));
              }}
              inputProps={{ min: 13, max: 100 }}
              size={isMobile ? "small" : "medium"}
              sx={{ 
                '& .MuiInputBase-root': {
                  height: { xs: '48px', sm: '56px' }
                }
              }}
            />
            
            <FormControl fullWidth>
              <FormLabel sx={{ mb: 1, fontSize: { xs: '0.875rem', sm: '1rem' } }}>
                Gender
              </FormLabel>
              <RadioGroup
                value={userData.gender}
                onChange={(e) => updateUserData('gender', e.target.value)}
                sx={{ 
                  '& .MuiFormControlLabel-root': {
                    margin: { xs: '8px 0', sm: '0 16px 0 0' },
                    '& .MuiRadio-root': {
                      padding: { xs: '8px', sm: '9px' }
                    }
                  }
                }}
              >
                <FormControlLabel 
                  value="male" 
                  control={<Radio />} 
                  label="Male" 
                  sx={{ 
                    '& .MuiFormControlLabel-label': {
                      fontSize: { xs: '0.875rem', sm: '1rem' }
                    }
                  }}
                />
                <FormControlLabel 
                  value="female" 
                  control={<Radio />} 
                  label="Female" 
                  sx={{ 
                    '& .MuiFormControlLabel-label': {
                      fontSize: { xs: '0.875rem', sm: '1rem' }
                    }
                  }}
                />
              </RadioGroup>
            </FormControl>
          </Box>
        );

      case 1:
        return (
          <Box sx={{ 
            p: { xs: 1, sm: 3 },
            minHeight: { xs: 'auto', sm: 'auto' },
            '& .MuiTextField-root': { mb: 3 },
            '& .MuiFormControl-root': { mb: 3 }
          }}>
            <Typography 
              variant={isMobile ? "h6" : "h5"} 
              gutterBottom 
              sx={{ 
                fontSize: { xs: '1.25rem', sm: '1.5rem' },
                mb: { xs: 2, sm: 3 }
              }}
            >
              Physical Measurements
            </Typography>
            <Typography 
              variant="body2" 
              color="text.secondary" 
              sx={{ 
                mb: { xs: 2, sm: 3 },
                fontSize: { xs: '0.875rem', sm: '1rem' }
              }}
            >
              We'll use these to calculate your daily calorie needs.
            </Typography>
            
            <Box sx={{ 
              display: 'flex', 
              flexDirection: { xs: 'column', sm: 'row' },
              gap: { xs: 2, sm: 2 }, 
              mb: 3 
            }}>
              <TextField
                label="Height (feet)"
                type="number"
                value={heightFeetInput}
                onChange={(e) => {
                  const next = e.target.value;
                  setHeightFeetInput(next);
                  updateUserData('height', {
                    ...userData.height!,
                    feet: next === '' ? 0 : parseInt(next, 10)
                  });
                }}
                inputProps={{ min: 3, max: 8 }}
                size={isMobile ? "small" : "medium"}
                sx={{ 
                  flex: 1,
                  '& .MuiInputBase-root': {
                    height: { xs: '48px', sm: '56px' }
                  }
                }}
              />
              <TextField
                label="Height (inches)"
                type="number"
                value={heightInchesInput}
                onChange={(e) => {
                  const next = e.target.value;
                  setHeightInchesInput(next);
                  updateUserData('height', {
                    ...userData.height!,
                    inches: next === '' ? 0 : parseInt(next, 10)
                  });
                }}
                inputProps={{ min: 0, max: 11 }}
                size={isMobile ? "small" : "medium"}
                sx={{ 
                  flex: 1,
                  '& .MuiInputBase-root': {
                    height: { xs: '48px', sm: '56px' }
                  }
                }}
              />
            </Box>
            
            <TextField
              fullWidth
              label="Current Weight (lbs)"
              type="number"
              value={weightInput}
              onChange={(e) => {
                const next = e.target.value;
                setWeightInput(next);
                updateUserData('weight', next === '' ? 0 : parseInt(next, 10));
              }}
              inputProps={{ min: 50, max: 500 }}
              size={isMobile ? "small" : "medium"}
              sx={{ 
                '& .MuiInputBase-root': {
                  height: { xs: '48px', sm: '56px' }
                }
              }}
            />
          </Box>
        );

      case 2:
        return (
          <Box sx={{ 
            p: { xs: 1, sm: 3 },
            minHeight: { xs: 'auto', sm: 'auto' },
            '& .MuiTextField-root': { mb: 3 },
            '& .MuiFormControl-root': { mb: 3 }
          }}>
            <Typography 
              variant={isMobile ? "h6" : "h5"} 
              gutterBottom 
              sx={{ 
                fontSize: { xs: '1.25rem', sm: '1.5rem' },
                mb: { xs: 2, sm: 3 }
              }}
            >
              Activity Level
            </Typography>
            <Typography 
              variant="body2" 
              color="text.secondary" 
              sx={{ 
                mb: { xs: 2, sm: 3 },
                fontSize: { xs: '0.875rem', sm: '1rem' }
              }}
            >
              How active are you on a typical week?
            </Typography>
            
            <FormControl fullWidth>
              <InputLabel>Activity Level</InputLabel>
              <Select
                value={userData.activityLevel}
                onChange={(e) => updateUserData('activityLevel', e.target.value)}
                label="Activity Level"
                size={isMobile ? "small" : "medium"}
                sx={{ 
                  '& .MuiInputBase-root': {
                    height: { xs: '48px', sm: '56px' }
                  }
                }}
              >
                <MenuItem value="sedentary">
                  <Box>
                    <Typography variant="body2">Sedentary</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Little or no exercise, desk job
                    </Typography>
                  </Box>
                </MenuItem>
                <MenuItem value="lightly_active">
                  <Box>
                    <Typography variant="body2">Lightly Active</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Light exercise 1-3 days/week
                    </Typography>
                  </Box>
                </MenuItem>
                <MenuItem value="moderately_active">
                  <Box>
                    <Typography variant="body2">Moderately Active</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Moderate exercise 3-5 days/week
                    </Typography>
                  </Box>
                </MenuItem>
                <MenuItem value="very_active">
                  <Box>
                    <Typography variant="body2">Very Active</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Hard exercise 6-7 days/week
                    </Typography>
                  </Box>
                </MenuItem>
                <MenuItem value="extremely_active">
                  <Box>
                    <Typography variant="body2">Extremely Active</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Very hard exercise, physical job
                    </Typography>
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>
          </Box>
        );

      case 3:
        return (
          <Box sx={{ 
            p: { xs: 1, sm: 3 },
            minHeight: { xs: 'auto', sm: 'auto' },
            '& .MuiTextField-root': { mb: 3 },
            '& .MuiFormControl-root': { mb: 3 }
          }}>
            <Typography 
              variant={isMobile ? "h6" : "h5"} 
              gutterBottom 
              sx={{ 
                fontSize: { xs: '1.25rem', sm: '1.5rem' },
                mb: 3
              }}
            >
              Your Goals
            </Typography>
            <Typography 
              variant="body2" 
              color="text.secondary" 
              sx={{ 
                mb: { xs: 2, sm: 3 },
                fontSize: { xs: '0.875rem', sm: '1rem' }
              }}
            >
              What are you trying to achieve?
            </Typography>
            
            <TextField
              fullWidth
              label="Target Weight (lbs)"
              type="number"
              value={userData.targetWeight?.toString() ?? ''}
              onChange={(e) => {
                const next = e.target.value;
                updateUserData('targetWeight', next === '' ? 0 : parseInt(next, 10));
              }}
              inputProps={{ min: 50, max: 500 }}
              size={isMobile ? "small" : "medium"}
              sx={{ 
                '& .MuiInputBase-root': {
                  height: { xs: '48px', sm: '56px' }
                }
              }}
            />
            
            <TextField
              fullWidth
              label="Target Date"
              type="date"
              value={userData.targetDate?.toISOString().split('T')[0]}
              onChange={(e) => updateUserData('targetDate', new Date(e.target.value))}
              InputLabelProps={{ shrink: true }}
              size={isMobile ? "small" : "medium"}
              sx={{ 
                '& .MuiInputBase-root': {
                  height: { xs: '48px', sm: '56px' }
                }
              }}
            />
            
            {userData.weight && userData.targetWeight && (
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  You want to {userData.targetWeight > userData.weight ? 'gain' : 'lose'} {' '}
                  {Math.abs(userData.weight - userData.targetWeight)} lbs
                </Typography>
              </Alert>
            )}
          </Box>
        );

      case 4:
        return (
          <Box sx={{ 
            p: { xs: 1, sm: 3 },
            minHeight: { xs: 'auto', sm: 'auto' },
            '& .MuiTextField-root': { mb: 3 },
            '& .MuiFormControl-root': { mb: 3 }
          }}>
            <Typography 
              variant={isMobile ? "h6" : "h5"} 
              gutterBottom 
              sx={{ 
                fontSize: { xs: '1.25rem', sm: '1.5rem' },
                mb: { xs: 2, sm: 3 }
              }}
            >
              Review Your Information
            </Typography>
            <Typography 
              variant="body2" 
              color="text.secondary" 
              sx={{ 
                mb: { xs: 2, sm: 3 },
                fontSize: { xs: '0.875rem', sm: '1rem' }
              }}
            >
              Please review your information before we create your plan.
            </Typography>
            
            <Card variant="outlined" sx={{ mb: 3 }}>
              <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                <Typography variant="h6" gutterBottom sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                  Personal Information
                </Typography>
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  gap: 1, 
                  mb: 2 
                }}>
                  <Chip label={`Name: ${userData.name}`} size="small" />
                  <Chip label={`Age: ${userData.age}`} size="small" />
                  <Chip label={`Gender: ${userData.gender}`} size="small" />
                </Box>
                
                <Typography variant="h6" gutterBottom sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                  Physical Stats
                </Typography>
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  gap: 1, 
                  mb: 2 
                }}>
                  <Chip label={`Height: ${userData.height?.feet}'${userData.height?.inches}"`} size="small" />
                  <Chip label={`Current Weight: ${userData.weight} lbs`} size="small" />
                  <Chip label={`Activity: ${userData.activityLevel?.replace('_', ' ')}`} size="small" />
                </Box>
                
                <Typography variant="h6" gutterBottom sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                  Goals
                </Typography>
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  gap: 1 
                }}>
                  <Chip label={`Target Weight: ${userData.targetWeight} lbs`} size="small" />
                  <Chip label={`Target Date: ${userData.targetDate?.toLocaleDateString()}`} size="small" />
                </Box>
              </CardContent>
            </Card>
            
            <Alert severity="success">
              <Typography variant="body2">
                Ready to create your personalized nutrition plan! Click "Complete Setup" to get started.
              </Typography>
            </Alert>
          </Box>
        );

      default:
        return null;
    }
  };

  const canProceed = () => {
    switch (activeStep) {
      case 0: {
        const hasName = Boolean(userData.name);
        const hasAge = typeof userData.age === 'number' && !Number.isNaN(userData.age) && userData.age >= 13;
        const hasGender = Boolean(userData.gender);
        return hasName && hasAge && hasGender;
      }
      case 1: {
        const feet = userData.height?.feet;
        const inches = userData.height?.inches;
        const weight = userData.weight;
        const feetOk = typeof feet === 'number' && !Number.isNaN(feet) && feet >= 3 && feet <= 8;
        const inchesOk = typeof inches === 'number' && !Number.isNaN(inches) && inches >= 0 && inches <= 11; // allow 0
        const weightOk = typeof weight === 'number' && !Number.isNaN(weight) && weight >= 50;
        return feetOk && inchesOk && weightOk;
      }
      case 2:
        return Boolean(userData.activityLevel);
      case 3: {
        const tw = userData.targetWeight;
        const td = userData.targetDate;
        const twOk = typeof tw === 'number' && !Number.isNaN(tw) && tw >= 50;
        const tdOk = td instanceof Date && !Number.isNaN(td.getTime());
        return twOk && tdOk;
      }
      default:
        return true;
    }
  };

  return (
    <Box sx={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      p: { xs: 0, sm: 2 },
      WebkitOverflowScrolling: 'touch'
    }}>
      <Card 
        className={isMobile ? 'mobile-setup-container' : ''}
        sx={{
          maxWidth: { xs: '100%', sm: 600 }, 
          width: '100%',
          mx: { xs: 0, sm: 0 },
          ...(isMobile
            ? {
                borderRadius: 0,
                boxShadow: 'none',
                border: 0,
              }
            : {}),
          display: 'flex',
          flexDirection: 'column',
          height: { xs: '100vh', sm: 'auto' },
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        <CardContent sx={{ 
          p: { xs: 1, sm: 3 },
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          overflow: 'hidden',
          height: '100%'
        }}>
          <Box sx={{ mb: { xs: 2, sm: 4 } }}>
            <Typography 
              variant={isMobile ? "h5" : "h4"} 
              align="center" 
              gutterBottom
              sx={{ fontSize: { xs: '1.5rem', sm: '2.125rem' }, fontWeight: 900 }}
            >
              Sunday Mornings
            </Typography>
            <Typography 
              variant="body2" 
              align="center" 
              color="text.secondary"
              sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
            >
              Create your personalized nutrition plan
            </Typography>
            <Typography variant="body2" align="center" sx={{ mt: 1 }}>
              Already have an account?{' '}
              <Link component={RouterLink} to="/signin">Sign in</Link>
            </Typography>
            <Typography variant="body2" align="center" sx={{ mt: 0.5 }}>
              Want to learn more?{' '}
              <Link component={RouterLink} to="/about">About Sunday Mornings</Link>
            </Typography>
          </Box>

          {isMobile ? (
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'center', 
              mb: 3,
              gap: 1
            }}>
              {steps.map((_, index) => (
                <Box
                  key={index}
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: index === activeStep ? 'primary.main' : 'grey.300',
                    transition: 'background-color 0.2s'
                  }}
                />
              ))}
            </Box>
          ) : (
            <Stepper 
              activeStep={activeStep} 
              sx={{ mb: 4 }}
            >
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>
          )}

          <Box 
            className="mobile-scroll-container"
            sx={{ 
              flex: 1, 
              display: 'flex', 
              flexDirection: 'column',
              overflow: 'auto',
              minHeight: 0,
              pb: 2,
              WebkitOverflowScrolling: 'touch',
              border: '1px solid transparent'
            }}
          >
            {renderStepContent()}
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          
          <Box sx={{ 
            display: 'flex', 
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between', 
            mt: 'auto',
            pt: 3,
            gap: { xs: 2, sm: 0 },
            flexShrink: 0
          }}>
            <Button
              disabled={activeStep === 0 || loading}
              onClick={handleBack}
              fullWidth={isMobile}
              variant={isMobile ? "outlined" : "text"}
              sx={{ 
                height: { xs: '48px', sm: '36px' },
                fontSize: { xs: '0.875rem', sm: '0.875rem' }
              }}
            >
              Back
            </Button>
            <Button
              variant="contained"
              onClick={handleNext}
              disabled={!canProceed() || loading}
              startIcon={loading ? <CircularProgress size={20} /> : undefined}
              fullWidth={isMobile}
              sx={{ 
                height: { xs: '48px', sm: '36px' },
                fontSize: { xs: '0.875rem', sm: '0.875rem' }
              }}
            >
              {activeStep === steps.length - 1 ? 'Complete Setup' : 'Next'}
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Setup; 
