import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  LinearProgress,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Divider,
  Button,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Restaurant,
  FitnessCenter,
  Timeline,
  CheckCircle,
  Warning,
  Add,
  Chat
} from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { User, DailyProgress, WeightLog } from '../types';
import { calculateProgressPercentage, caloriesToWeight } from '../utils/calculations';
import { mockAPI } from '../data/mockData';
import JourneyMap from './JourneyMap';

interface DashboardProps {
  user: User;
  onNavigateToChat?: () => void; // Add navigation callback
}

const Dashboard: React.FC<DashboardProps> = ({ user, onNavigateToChat }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  
  const [dailyProgress, setDailyProgress] = useState<DailyProgress | null>(null);
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [progress, logs] = await Promise.all([
          mockAPI.getDailyProgress(new Date()),
          mockAPI.getWeightLogs()
        ]);
        setDailyProgress(progress);
        setWeightLogs(logs);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return <LinearProgress />;
  }

  if (!dailyProgress) {
    return <Typography>No data available</Typography>;
  }

  const currentWeight = weightLogs[weightLogs.length - 1]?.weight || user.weight;
  const progressPercentage = calculateProgressPercentage(user, currentWeight);
  const weightLost = user.weight - currentWeight;
  const totalDeficit = dailyProgress.deficit;
  const estimatedWeightLoss = caloriesToWeight(totalDeficit);

  // Prepare chart data
  const chartData = weightLogs.map(log => ({
    date: new Date(log.date).toLocaleDateString(),
    weight: log.weight,
    target: user.targetWeight
  }));

  const getDeficitStatus = (deficit: number) => {
    if (deficit >= user.dailyDeficitTarget) {
      return { color: 'success', icon: <CheckCircle />, text: 'On Track' };
    } else if (deficit >= user.dailyDeficitTarget * 0.5) {
      return { color: 'warning', icon: <Warning />, text: 'Close' };
    } else {
      return { color: 'error', icon: <Warning />, text: 'Behind' };
    }
  };

  const deficitStatus = getDeficitStatus(dailyProgress.deficit);

  // For demo, mock completedDays as 3
  const completedDays = 3;

  const handleAddFood = () => {
    if (onNavigateToChat) {
      onNavigateToChat();
    } else {
      // Fallback: could navigate to chat route or show chat modal
      console.log('Navigate to chat to add food');
    }
  };

  return (
    <Box sx={{ 
      p: { xs: 1, sm: 2, md: 3 },
      width: '100%',
      overflow: 'hidden',
      boxSizing: 'border-box'
    }}>
      <JourneyMap user={user} completedDays={completedDays} />
      
      <Typography 
        variant={isMobile ? "h5" : "h4"} 
        gutterBottom 
        sx={{ 
          mb: { xs: 2, sm: 3 },
          fontSize: { xs: '1.5rem', sm: '2.125rem' }
        }}
      >
        Welcome back, {user.name}! 👋
      </Typography>

      {/* Prominent Calorie Deficit Display */}
      <Card sx={{ 
        width: '100%',
        mb: { xs: 2, sm: 3 },
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        '& .MuiCardContent-root': { p: { xs: 3, sm: 4 } }
      }}>
        <CardContent>
          <Box sx={{ 
            display: 'flex', 
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: { xs: 2, sm: 3 }
          }}>
            <Box sx={{ textAlign: { xs: 'center', sm: 'left' }, flex: 1 }}>
              <Typography 
                variant={isMobile ? "h6" : "h5"} 
                sx={{ 
                  mb: 1,
                  opacity: 0.9,
                  fontSize: { xs: '1rem', sm: '1.25rem' }
                }}
              >
                Today's Calorie Deficit
              </Typography>
              <Typography 
                variant={isMobile ? "h3" : "h2"} 
                sx={{ 
                  fontWeight: 700,
                  mb: 1,
                  fontSize: { xs: '2.5rem', sm: '3.75rem' }
                }}
              >
                {dailyProgress.deficit}
              </Typography>
              <Typography 
                variant="body1" 
                sx={{ 
                  opacity: 0.8,
                  fontSize: { xs: '1rem', sm: '1.125rem' }
                }}
              >
                calories
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Chip
                  icon={deficitStatus.icon}
                  label={deficitStatus.text}
                  color={deficitStatus.color as any}
                  variant="filled"
                  size={isMobile ? "small" : "medium"}
                  sx={{ 
                    bgcolor: 'rgba(255,255,255,0.2)',
                    color: 'white',
                    border: '1px solid rgba(255,255,255,0.3)'
                  }}
                />
              </Box>
            </Box>
            
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column',
              alignItems: { xs: 'center', sm: 'flex-end' },
              gap: 2
            }}>
              <Typography 
                variant="body2" 
                sx={{ 
                  opacity: 0.8,
                  textAlign: { xs: 'center', sm: 'right' },
                  fontSize: { xs: '0.875rem', sm: '1rem' }
                }}
              >
                Target: {user.dailyDeficitTarget} calories
              </Typography>
              
              {/* Add Food CTA Button */}
              <Button
                variant="contained"
                size={isMobile ? "large" : "large"}
                startIcon={<Add />}
                onClick={handleAddFood}
                sx={{
                  bgcolor: 'rgba(255,255,255,0.9)',
                  color: '#667eea',
                  fontWeight: 600,
                  px: { xs: 3, sm: 4 },
                  py: { xs: 1.5, sm: 2 },
                  fontSize: { xs: '1rem', sm: '1.125rem' },
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,1)',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 25px rgba(0,0,0,0.15)'
                  },
                  transition: 'all 0.3s ease',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
                }}
              >
                Add Food
              </Button>
              
              <Typography 
                variant="caption" 
                sx={{ 
                  opacity: 0.7,
                  textAlign: { xs: 'center', sm: 'right' },
                  fontSize: { xs: '0.75rem', sm: '0.875rem' }
                }}
              >
                Chat with AI to log meals
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>
      
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: { xs: 2, sm: 3 },
        width: '100%',
        overflow: 'hidden'
      }}>
        {/* Progress Overview */}
        <Box sx={{ 
          display: 'flex', 
          flexDirection: { xs: 'column', md: 'row' },
          gap: { xs: 2, sm: 3 },
          width: '100%'
        }}>
          <Card sx={{ 
            flex: { xs: '1 1 auto', md: '1 1 600px' },
            width: '100%',
            '& .MuiCardContent-root': { p: { xs: 2, sm: 3 } }
          }}>
            <CardContent>
              <Typography 
                variant={isMobile ? "h6" : "h6"} 
                gutterBottom
                sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}
              >
                Weight Loss Progress
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <LinearProgress
                  variant="determinate"
                  value={progressPercentage}
                  sx={{ 
                    flexGrow: 1, 
                    mr: 2, 
                    height: { xs: 8, sm: 10 }, 
                    borderRadius: { xs: 4, sm: 5 } 
                  }}
                />
                <Typography 
                  variant="body2" 
                  color="text.secondary"
                  sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                >
                  {progressPercentage.toFixed(1)}%
                </Typography>
              </Box>
              <Box sx={{ 
                display: 'flex', 
                flexDirection: { xs: 'column', sm: 'row' },
                justifyContent: 'space-between', 
                mb: 2,
                gap: { xs: 1, sm: 0 }
              }}>
                <Typography variant="body2" sx={{ fontSize: { xs: '0.875rem', sm: '0.875rem' } }}>
                  Starting: {user.weight}lbs
                </Typography>
                <Typography variant="body2" sx={{ fontSize: { xs: '0.875rem', sm: '0.875rem' } }}>
                  Current: {currentWeight}lbs
                </Typography>
                <Typography variant="body2" sx={{ fontSize: { xs: '0.875rem', sm: '0.875rem' } }}>
                  Target: {user.targetWeight}lbs
                </Typography>
              </Box>
              <Typography 
                variant={isMobile ? "h6" : "h6"} 
                color="primary"
                sx={{ fontSize: { xs: '1.125rem', sm: '1.25rem' } }}
              >
                {weightLost.toFixed(1)}lbs lost so far! 🎉
              </Typography>
            </CardContent>
          </Card>

          {/* Quick Add Food Card */}
          <Card sx={{ 
            flex: { xs: '1 1 auto', md: '0 1 300px' },
            width: '100%',
            '& .MuiCardContent-root': { p: { xs: 2, sm: 3 } }
          }}>
            <CardContent>
              <Typography 
                variant={isMobile ? "h6" : "h6"} 
                gutterBottom
                sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}
              >
                Quick Actions
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Button
                  variant="outlined"
                  size="large"
                  startIcon={<Chat />}
                  onClick={handleAddFood}
                  fullWidth
                  sx={{
                    py: 1.5,
                    fontSize: { xs: '0.875rem', sm: '1rem' },
                    borderColor: 'primary.main',
                    color: 'primary.main',
                    '&:hover': {
                      borderColor: 'primary.dark',
                      bgcolor: 'primary.light',
                      color: 'primary.dark'
                    }
                  }}
                >
                  Chat with AI
                </Button>
                
                <Typography 
                  variant="body2" 
                  color="text.secondary"
                  sx={{ 
                    textAlign: 'center',
                    fontSize: { xs: '0.75rem', sm: '0.875rem' }
                  }}
                >
                  Get personalized nutrition advice
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Box>

        {/* Daily Summary and Weight Chart */}
        <Box sx={{ 
          display: 'flex', 
          flexDirection: { xs: 'column', lg: 'row' },
          gap: { xs: 2, sm: 3 },
          width: '100%'
        }}>
          <Card sx={{ 
            flex: { xs: '1 1 auto', lg: '1 1 400px' },
            width: '100%',
            '& .MuiCardContent-root': { p: { xs: 2, sm: 3 } }
          }}>
            <CardContent>
              <Typography 
                variant={isMobile ? "h6" : "h6"} 
                gutterBottom
                sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}
              >
                Today's Summary
              </Typography>
              <List dense sx={{ py: 0 }}>
                <ListItem sx={{ px: 0 }}>
                  <ListItemAvatar>
                    <Avatar 
                      sx={{ 
                        bgcolor: 'primary.light',
                        width: { xs: 32, sm: 40 },
                        height: { xs: 32, sm: 40 }
                      }}
                    >
                      <Restaurant sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }} />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Typography sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>
                        Planned Calories
                      </Typography>
                    }
                    secondary={
                      <Typography sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                        {dailyProgress.totalPlanned} calories
                      </Typography>
                    }
                  />
                </ListItem>
                <Divider />
                <ListItem sx={{ px: 0 }}>
                  <ListItemAvatar>
                    <Avatar 
                      sx={{ 
                        bgcolor: 'secondary.light',
                        width: { xs: 32, sm: 40 },
                        height: { xs: 32, sm: 40 }
                      }}
                    >
                      <Timeline sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }} />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Typography sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>
                        Actual Calories
                      </Typography>
                    }
                    secondary={
                      <Typography sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                        {dailyProgress.totalActual} calories
                      </Typography>
                    }
                  />
                </ListItem>
                <Divider />
                <ListItem sx={{ px: 0 }}>
                  <ListItemAvatar>
                    <Avatar 
                      sx={{ 
                        bgcolor: 'success.light',
                        width: { xs: 32, sm: 40 },
                        height: { xs: 32, sm: 40 }
                      }}
                    >
                      <FitnessCenter sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }} />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Typography sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>
                        Calories Burned
                      </Typography>
                    }
                    secondary={
                      <Typography sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                        {dailyProgress.totalBurned} calories
                      </Typography>
                    }
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>

          <Card sx={{ 
            flex: { xs: '1 1 auto', lg: '1 1 400px' },
            width: '100%',
            '& .MuiCardContent-root': { p: { xs: 2, sm: 3 } }
          }}>
            <CardContent>
              <Typography 
                variant={isMobile ? "h6" : "h6"} 
                gutterBottom
                sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}
              >
                Weight Progress
              </Typography>
              <ResponsiveContainer width="100%" height={isMobile ? 150 : 200}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: isMobile ? 10 : 12 }}
                  />
                  <YAxis tick={{ fontSize: isMobile ? 10 : 12 }} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="weight"
                    stroke="#8884d8"
                    strokeWidth={isMobile ? 1.5 : 2}
                    dot={{ fill: '#8884d8', strokeWidth: isMobile ? 1.5 : 2, r: isMobile ? 3 : 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="target"
                    stroke="#82ca9d"
                    strokeWidth={isMobile ? 1.5 : 2}
                    strokeDasharray="5 5"
                  />
                </LineChart>
              </ResponsiveContainer>
              <Typography 
                variant="body2" 
                color="text.secondary" 
                sx={{ 
                  mt: 1,
                  fontSize: { xs: '0.75rem', sm: '0.875rem' }
                }}
              >
                Estimated weight loss from deficit: {estimatedWeightLoss.toFixed(2)}lbs
              </Typography>
            </CardContent>
          </Card>
        </Box>

        {/* Recent Meals */}
        <Card sx={{ 
          width: '100%',
          '& .MuiCardContent-root': { p: { xs: 2, sm: 3 } }
        }}>
          <CardContent>
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              mb: 2
            }}>
              <Typography 
                variant={isMobile ? "h6" : "h6"} 
                sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}
              >
                Today's Meals
              </Typography>
              
              <Button
                variant="text"
                size="small"
                startIcon={<Add />}
                onClick={handleAddFood}
                sx={{
                  color: 'primary.main',
                  fontSize: { xs: '0.75rem', sm: '0.875rem' }
                }}
              >
                Add Meal
              </Button>
            </Box>
            
            <List sx={{ py: 0 }}>
              {dailyProgress.meals.slice(0, isMobile ? 3 : 5).map((meal) => (
                <ListItem 
                  key={meal.id} 
                  sx={{ 
                    px: 0,
                    flexDirection: { xs: 'column', sm: 'row' },
                    alignItems: { xs: 'flex-start', sm: 'center' },
                    gap: { xs: 1, sm: 0 }
                  }}
                >
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    width: '100%',
                    gap: 1
                  }}>
                    <ListItemAvatar>
                      <Avatar 
                        sx={{ 
                          bgcolor: meal.isPlanned ? 'primary.light' : 'secondary.light',
                          width: { xs: 32, sm: 40 },
                          height: { xs: 32, sm: 40 }
                        }}
                      >
                        <Restaurant sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }} />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Typography sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>
                          {meal.name}
                        </Typography>
                      }
                      secondary={
                        <Typography sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                          {meal.calories} calories • {meal.type} • {new Date(meal.time).toLocaleTimeString()}
                        </Typography>
                      }
                    />
                  </Box>
                  <Chip
                    label={meal.isPlanned ? 'Planned' : 'Actual'}
                    color={meal.isPlanned ? 'primary' : 'secondary'}
                    size={isMobile ? "small" : "small"}
                    sx={{ alignSelf: { xs: 'flex-end', sm: 'center' } }}
                  />
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default Dashboard; 