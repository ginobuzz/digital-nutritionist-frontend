import React from 'react';
import { Box, Typography, Avatar, Tooltip } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LockIcon from '@mui/icons-material/Lock';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import DirectionsWalkIcon from '@mui/icons-material/DirectionsWalk';
import { User } from '../types';

interface JourneyMapProps {
  user: User;
  completedDays: number; // Number of days completed (mocked for now)
}

const getDayLabel = (index: number, total: number) => {
  if (index === 0) return 'Start';
  if (index === total - 1) return 'Goal!';
  return `Day ${index}`;
};

const getNodeIcon = (status: 'complete' | 'current' | 'locked' | 'goal') => {
  switch (status) {
    case 'complete':
      return <CheckCircleIcon color="success" fontSize="large" />;
    case 'current':
      return <DirectionsWalkIcon color="primary" fontSize="large" />;
    case 'goal':
      return <EmojiEventsIcon color="warning" fontSize="large" />;
    case 'locked':
    default:
      return <LockIcon color="disabled" fontSize="large" />;
  }
};

const JourneyMap: React.FC<JourneyMapProps> = ({ user, completedDays }) => {
  // Calculate number of days in journey
  const start = new Date();
  const end = user.targetDate;
  const totalDays = Math.max(2, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

  // For demo, create an array of statuses: 'complete', 'current', 'locked', 'goal'
  const nodes = Array.from({ length: totalDays }, (_, i) => {
    if (i < completedDays) return 'complete';
    if (i === completedDays && i !== totalDays - 1) return 'current';
    if (i === totalDays - 1) return 'goal';
    return 'locked';
  });

  // Whimsical path: alternate up/down, use emoji backgrounds, playful spacing
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
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 3, px: 2 }}>
        {nodes.map((status, i) => (
          <Box key={i} sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            position: 'relative',
            minWidth: 56,
            zIndex: 1,
          }}>
            <Tooltip title={getDayLabel(i, totalDays)} arrow>
              <Avatar
                sx={{
                  bgcolor:
                    status === 'goal' ? 'warning.light'
                    : status === 'complete' ? 'success.light'
                    : status === 'current' ? 'primary.light'
                    : 'grey.200',
                  width: 56,
                  height: 56,
                  border: status === 'current' ? '3px solid #1976d2' : undefined,
                  boxShadow: status === 'goal' ? '0 0 12px 2px #ffeb3b' : undefined,
                  fontSize: 32,
                  mb: 1,
                  transition: 'all 0.3s',
                }}
              >
                {getNodeIcon(status as any)}
              </Avatar>
            </Tooltip>
            <Typography variant="caption" sx={{ fontWeight: status === 'goal' ? 700 : 400 }}>
              {getDayLabel(i, totalDays)}
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
        Check off each day by completing your plan and reality! <span role="img" aria-label="sparkles">✨</span>
      </Typography>
    </Box>
  );
};

export default JourneyMap; 