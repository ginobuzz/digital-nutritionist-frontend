import React from 'react';
import { Box, Typography, Avatar, Tooltip } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import DirectionsWalkIcon from '@mui/icons-material/DirectionsWalk';
import CelebrationIcon from '@mui/icons-material/Celebration';
import CancelIcon from '@mui/icons-material/Cancel';
import { User } from '../types';

interface JourneyMapProps {
  user: User;
  completedDays: number; // Number of days completed (mocked for now)
}

const getDayLabel = (index: number, todayIndex: number, total: number) => {
  if (index === 0) return 'Start';
  if (index === total - 1) return 'Goal!';
  if (index === todayIndex) return 'Today';
  return `Day ${index}`;
};

const getNodeIcon = (status: 'complete' | 'missed' | 'today' | 'locked' | 'goal') => {
  switch (status) {
    case 'complete':
      return <CelebrationIcon color="success" fontSize="large" />;
    case 'missed':
      return <CancelIcon color="error" fontSize="large" />;
    case 'today':
      return <DirectionsWalkIcon color="primary" fontSize="large" />;
    case 'goal':
      return <EmojiEventsIcon color="warning" fontSize="large" />;
    case 'locked':
    default:
      return <LockIcon color="disabled" fontSize="large" />;
  }
};

const JourneyMap: React.FC<JourneyMapProps> = ({ user, completedDays }) => {
  // Set goal to be day 52
  const totalDays = 53; // 0-52 = 53 total days

  // Always place "Today" in the center of the map
  const todayIndex = Math.floor(totalDays / 2);

  // Create demo data with some missed days peppered in
  const nodes = Array.from({ length: totalDays }, (_, i) => {
    if (i === totalDays - 1) return 'goal'; // Day 52 is the goal
    if (i === todayIndex) return 'today';
    if (i > todayIndex) return 'locked';
    
    // For days before today, mix completed and missed
    if (i === 0) return 'complete'; // Start is always complete
    if (i === 2) return 'missed'; // Day 2 was missed
    if (i === 5) return 'missed'; // Day 5 was missed
    if (i === 8) return 'missed'; // Day 8 was missed
    if (i === 23) return 'missed'; // Day 41 was missed
    return 'complete'; // Most other days are complete
  });

  return (
    <Box sx={{
      width: '100%',
      overflowX: 'auto',
      py: 3,
      mb: 4,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      background: 'linear-gradient(90deg, #e3f2fd 0%, #fffde7 100%)',
      borderRadius: 4,
      boxShadow: 2,
    }}>
      <Typography variant="h5" align="center" sx={{ mb: 2, fontWeight: 700 }}>
        Your Weight Loss Journey <span role="img" aria-label="map">🗺️</span>
      </Typography>
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'flex-end', 
        gap: 3, 
        px: 2,
        minWidth: `${totalDays * 80}px`, // Ensure enough width for all nodes
        justifyContent: 'flex-start', // Align to start for proper scrolling
        pl: 8, // Add left padding to ensure day 0 is scrollable
        pr: 8, // Add right padding for balance
      }}>
        {nodes.map((status, i) => (
          <Box key={i} sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            position: 'relative',
            minWidth: 56,
            zIndex: 1,
            flexShrink: 0, // Prevent nodes from shrinking
          }}>
            <Tooltip title={getDayLabel(i, todayIndex, totalDays)} arrow>
              <Avatar
                sx={{
                  bgcolor:
                    status === 'goal' ? 'warning.light'
                    : status === 'complete' ? 'success.light'
                    : status === 'missed' ? 'error.light'
                    : status === 'today' ? 'primary.light'
                    : 'grey.200',
                  width: 56,
                  height: 56,
                  border: status === 'today' ? '3px solid #1976d2' : undefined,
                  boxShadow: status === 'goal' ? '0 0 12px 2px #ffeb3b' : undefined,
                  fontSize: 32,
                  mb: 1,
                  transition: 'all 0.3s',
                  position: 'relative',
                  opacity: status === 'missed' ? 0.7 : 1,
                }}
              >
                {getNodeIcon(status as any)}
              </Avatar>
            </Tooltip>
            <Typography variant="caption" sx={{ fontWeight: status === 'goal' ? 700 : 400 }}>
              {getDayLabel(i, todayIndex, totalDays)}
            </Typography>
            {/* Draw whimsical path line */}
            {i < nodes.length - 1 && (
              <Box
                sx={{
                  width: 40,
                  height: 16,
                  borderBottom: '4px dotted #90caf9',
                  borderRadius: '0 0 16px 16px',
                  position: 'absolute',
                  left: '50%',
                  top: 40,
                  transform: `translateX(0) rotate(${i % 2 === 0 ? 20 : -20}deg)`
                }}
              />
            )}
          </Box>
        ))}
      </Box>
      <Typography variant="body2" align="center" sx={{ mt: 2, color: 'text.secondary' }}>
        Scroll left and right to see your full journey! <span role="img" aria-label="sparkles">✨</span>
      </Typography>
    </Box>
  );
};

export default JourneyMap; 