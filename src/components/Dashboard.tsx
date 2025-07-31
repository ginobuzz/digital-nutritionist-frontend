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
  Divider
} from '@mui/material';
import {
  Restaurant,
  FitnessCenter,
  Timeline,
  CheckCircle,
  Warning
} from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { User, DailyProgress, WeightLog } from '../types';
import { calculateProgressPercentage, caloriesToWeight } from '../utils/calculations';
import { mockAPI } from '../data/mockData';
import JourneyMap from './JourneyMap';

interface DashboardProps {
  user: User;
}

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
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

  return (
    <Box>
      <JourneyMap user={user} completedDays={completedDays} />
      <Typography variant="h4" gutterBottom>
        Welcome back, {user.name}! 👋
      </Typography>
      
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Progress Overview and Deficit */}
        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          <Card sx={{ flex: '1 1 600px' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Weight Loss Progress
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <LinearProgress
                  variant="determinate"
                  value={progressPercentage}
                  sx={{ flexGrow: 1, mr: 2, height: 10, borderRadius: 5 }}
                />
                <Typography variant="body2" color="text.secondary">
                  {progressPercentage.toFixed(1)}%
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="body2">
                  Starting: {user.weight}lbs
                </Typography>
                <Typography variant="body2">
                  Current: {currentWeight}lbs
                </Typography>
                <Typography variant="body2">
                  Target: {user.targetWeight}lbs
                </Typography>
              </Box>
              <Typography variant="h6" color="primary">
                {weightLost.toFixed(1)}lbs lost so far! 🎉
              </Typography>
            </CardContent>
          </Card>

          <Card sx={{ flex: '0 1 300px' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Today's Deficit
              </Typography>
              <Box sx={{ textAlign: 'center', mb: 2 }}>
                <Typography variant="h3" color="primary" gutterBottom>
                  {dailyProgress.deficit}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  calories
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Chip
                  icon={deficitStatus.icon}
                  label={deficitStatus.text}
                  color={deficitStatus.color as any}
                  variant="outlined"
                />
              </Box>
              <Typography variant="body2" sx={{ mt: 1, textAlign: 'center' }}>
                Target: {user.dailyDeficitTarget} calories
              </Typography>
            </CardContent>
          </Card>
        </Box>

        {/* Daily Summary and Weight Chart */}
        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          <Card sx={{ flex: '1 1 400px' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Today's Summary
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: 'primary.light' }}>
                      <Restaurant />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary="Planned Calories"
                    secondary={`${dailyProgress.totalPlanned} calories`}
                  />
                </ListItem>
                <Divider />
                <ListItem>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: 'secondary.light' }}>
                      <Timeline />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary="Actual Calories"
                    secondary={`${dailyProgress.totalActual} calories`}
                  />
                </ListItem>
                <Divider />
                <ListItem>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: 'success.light' }}>
                      <FitnessCenter />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary="Calories Burned"
                    secondary={`${dailyProgress.totalBurned} calories`}
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>

          <Card sx={{ flex: '1 1 400px' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Weight Progress
              </Typography>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="weight"
                    stroke="#8884d8"
                    strokeWidth={2}
                    dot={{ fill: '#8884d8', strokeWidth: 2, r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="target"
                    stroke="#82ca9d"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                  />
                </LineChart>
              </ResponsiveContainer>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Estimated weight loss from deficit: {estimatedWeightLoss.toFixed(2)}lbs
              </Typography>
            </CardContent>
          </Card>
        </Box>

        {/* Recent Meals */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Today's Meals
            </Typography>
            <List>
              {dailyProgress.meals.slice(0, 5).map((meal) => (
                <ListItem key={meal.id}>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: meal.isPlanned ? 'primary.light' : 'secondary.light' }}>
                      <Restaurant />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={meal.name}
                    secondary={`${meal.calories} calories • ${meal.type} • ${new Date(meal.time).toLocaleTimeString()}`}
                  />
                  <Chip
                    label={meal.isPlanned ? 'Planned' : 'Actual'}
                    color={meal.isPlanned ? 'primary' : 'secondary'}
                    size="small"
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