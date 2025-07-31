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
} from '@mui/material';
import { User } from '../types';

interface SetupProps {
  onComplete: (user: User) => void;
}

const Setup: React.FC<SetupProps> = ({ onComplete }) => {
  const [activeStep, setActiveStep] = useState(0);
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
    'Basic Information',
    'Physical Stats',
    'Activity Level',
    'Goals',
    'Review & Complete'
  ];

  const handleNext = () => {
    if (activeStep === steps.length - 1) {
      // Complete setup
      const completeUser: User = {
        id: '1',
        name: userData.name!,
        age: userData.age!,
        height: userData.height!,
        weight: userData.weight!,
        gender: userData.gender!,
        activityLevel: userData.activityLevel!,
        targetWeight: userData.targetWeight!,
        targetDate: userData.targetDate!,
        dailyCalorieTarget: 0, // Will be calculated
        dailyDeficitTarget: 0, // Will be calculated
      };
      onComplete(completeUser);
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
          <Box sx={{ p: 3 }}>
            <Typography variant="h5" gutterBottom>
              Let's get to know you
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              We'll use this information to create your personalized nutrition plan.
            </Typography>
            
            <TextField
              fullWidth
              label="Full Name"
              value={userData.name}
              onChange={(e) => updateUserData('name', e.target.value)}
              sx={{ mb: 3 }}
            />
            
            <TextField
              fullWidth
              label="Age"
              type="number"
              value={userData.age}
              onChange={(e) => updateUserData('age', parseInt(e.target.value))}
              inputProps={{ min: 13, max: 100 }}
              sx={{ mb: 3 }}
            />
            
            <FormControl fullWidth sx={{ mb: 3 }}>
              <FormLabel>Gender</FormLabel>
              <RadioGroup
                value={userData.gender}
                onChange={(e) => updateUserData('gender', e.target.value)}
                row
              >
                <FormControlLabel value="male" control={<Radio />} label="Male" />
                <FormControlLabel value="female" control={<Radio />} label="Female" />
              </RadioGroup>
            </FormControl>
          </Box>
        );

      case 1:
        return (
          <Box sx={{ p: 3 }}>
            <Typography variant="h5" gutterBottom>
              Physical Measurements
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              We'll use these to calculate your daily calorie needs.
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
              <TextField
                label="Height (feet)"
                type="number"
                value={userData.height?.feet}
                onChange={(e) => updateUserData('height', { 
                  ...userData.height!, 
                  feet: parseInt(e.target.value) 
                })}
                inputProps={{ min: 3, max: 8 }}
                sx={{ flex: 1 }}
              />
              <TextField
                label="Height (inches)"
                type="number"
                value={userData.height?.inches}
                onChange={(e) => updateUserData('height', { 
                  ...userData.height!, 
                  inches: parseInt(e.target.value) 
                })}
                inputProps={{ min: 0, max: 11 }}
                sx={{ flex: 1 }}
              />
            </Box>
            
            <TextField
              fullWidth
              label="Current Weight (lbs)"
              type="number"
              value={userData.weight}
              onChange={(e) => updateUserData('weight', parseInt(e.target.value))}
              inputProps={{ min: 50, max: 500 }}
              sx={{ mb: 3 }}
            />
          </Box>
        );

      case 2:
        return (
          <Box sx={{ p: 3 }}>
            <Typography variant="h5" gutterBottom>
              Activity Level
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              How active are you on a typical week?
            </Typography>
            
            <FormControl fullWidth>
              <InputLabel>Activity Level</InputLabel>
              <Select
                value={userData.activityLevel}
                onChange={(e) => updateUserData('activityLevel', e.target.value)}
                label="Activity Level"
              >
                <MenuItem value="sedentary">
                  <Box>
                    <Typography variant="body1">Sedentary</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Little or no exercise, desk job
                    </Typography>
                  </Box>
                </MenuItem>
                <MenuItem value="lightly_active">
                  <Box>
                    <Typography variant="body1">Lightly Active</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Light exercise 1-3 days/week
                    </Typography>
                  </Box>
                </MenuItem>
                <MenuItem value="moderately_active">
                  <Box>
                    <Typography variant="body1">Moderately Active</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Moderate exercise 3-5 days/week
                    </Typography>
                  </Box>
                </MenuItem>
                <MenuItem value="very_active">
                  <Box>
                    <Typography variant="body1">Very Active</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Hard exercise 6-7 days/week
                    </Typography>
                  </Box>
                </MenuItem>
                <MenuItem value="extremely_active">
                  <Box>
                    <Typography variant="body1">Extremely Active</Typography>
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
          <Box sx={{ p: 3 }}>
            <Typography variant="h5" gutterBottom>
              Your Goals
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              What are you trying to achieve?
            </Typography>
            
            <TextField
              fullWidth
              label="Target Weight (lbs)"
              type="number"
              value={userData.targetWeight}
              onChange={(e) => updateUserData('targetWeight', parseInt(e.target.value))}
              inputProps={{ min: 50, max: 500 }}
              sx={{ mb: 3 }}
            />
            
            <TextField
              fullWidth
              label="Target Date"
              type="date"
              value={userData.targetDate?.toISOString().split('T')[0]}
              onChange={(e) => updateUserData('targetDate', new Date(e.target.value))}
              InputLabelProps={{ shrink: true }}
              sx={{ mb: 3 }}
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
          <Box sx={{ p: 3 }}>
            <Typography variant="h5" gutterBottom>
              Review Your Information
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              Please review your information before we create your plan.
            </Typography>
            
            <Card variant="outlined" sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>Personal Information</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                  <Chip label={`Name: ${userData.name}`} />
                  <Chip label={`Age: ${userData.age}`} />
                  <Chip label={`Gender: ${userData.gender}`} />
                </Box>
                
                <Typography variant="h6" gutterBottom>Physical Stats</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                  <Chip label={`Height: ${userData.height?.feet}'${userData.height?.inches}"`} />
                  <Chip label={`Current Weight: ${userData.weight} lbs`} />
                  <Chip label={`Activity: ${userData.activityLevel?.replace('_', ' ')}`} />
                </Box>
                
                <Typography variant="h6" gutterBottom>Goals</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  <Chip label={`Target Weight: ${userData.targetWeight} lbs`} />
                  <Chip label={`Target Date: ${userData.targetDate?.toLocaleDateString()}`} />
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
      case 0:
        return userData.name && userData.age && userData.gender;
      case 1:
        return userData.height?.feet && userData.height?.inches && userData.weight;
      case 2:
        return userData.activityLevel;
      case 3:
        return userData.targetWeight && userData.targetDate;
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
      bgcolor: 'background.default',
      p: 2
    }}>
      <Card sx={{ maxWidth: 600, width: '100%' }}>
        <CardContent>
          <Box sx={{ mb: 4 }}>
            <Typography variant="h4" align="center" gutterBottom>
              Digital Nutritionist Setup
            </Typography>
            <Typography variant="body1" align="center" color="text.secondary">
              Create your personalized nutrition plan
            </Typography>
          </Box>

          <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {renderStepContent()}

          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
            <Button
              disabled={activeStep === 0}
              onClick={handleBack}
            >
              Back
            </Button>
            <Button
              variant="contained"
              onClick={handleNext}
              disabled={!canProceed()}
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