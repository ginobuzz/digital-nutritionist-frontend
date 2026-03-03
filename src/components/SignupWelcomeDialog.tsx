import React, { useEffect, useMemo, useState } from 'react';
import { alpha } from '@mui/material/styles';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  Typography,
  useTheme,
} from '@mui/material';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import RestaurantRoundedIcon from '@mui/icons-material/RestaurantRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import ForumRoundedIcon from '@mui/icons-material/ForumRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';

interface SignupWelcomeDialogProps {
  open: boolean;
  previewMode?: boolean;
  onOpenPulse?: () => void;
  onStageReveal?: (stageIndex: number) => void;
  onGetStarted: () => void;
}

const TOUR_STAGES = [
  {
    title: 'Log in seconds',
    description: 'Type a quick meal note and let AI estimate calories + macros.',
    icon: <RestaurantRoundedIcon fontSize="small" />,
    colorToken: 'success' as const,
  },
  {
    title: 'Plan your week',
    description: 'A weekly candence lets you rebalance each day as life happens.',
    icon: <CalendarMonthRoundedIcon fontSize="small" />,
    colorToken: 'info' as const,
  },
  {
    title: 'Ask your coach',
    description: 'Get practical guidance for meals, habits, and consistency.',
    icon: <ForumRoundedIcon fontSize="small" />,
    colorToken: 'secondary' as const,
  },
  {
    title: 'See the trend',
    description: 'Track progress over time without worrying if one day slips.',
    icon: <InsightsRoundedIcon fontSize="small" />,
    colorToken: 'warning' as const,
  },
] as const;

const REVEAL_INTERVAL_MS = 900;

const SignupWelcomeDialog: React.FC<SignupWelcomeDialogProps> = ({
  open,
  previewMode = false,
  onOpenPulse,
  onStageReveal,
  onGetStarted,
}) => {
  const theme = useTheme();
  const [activeStage, setActiveStage] = useState(0);

  useEffect(() => {
    if (!open) return;

    setActiveStage(0);
    onOpenPulse?.();

    let next = 1;
    const id = window.setInterval(() => {
      if (next >= TOUR_STAGES.length) {
        window.clearInterval(id);
        return;
      }
      setActiveStage(next);
      onStageReveal?.(next);
      next += 1;
    }, REVEAL_INTERVAL_MS);

    return () => {
      window.clearInterval(id);
    };
  }, [onOpenPulse, onStageReveal, open]);

  const progressPercent = useMemo(() => {
    const maxStageIndex = Math.max(1, TOUR_STAGES.length - 1);
    return Math.min(100, (activeStage / maxStageIndex) * 100);
  }, [activeStage]);

  return (
    <Dialog
      open={open}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          borderRadius: 4,
          overflow: 'hidden',
          backgroundColor: theme.palette.background.paper,
          backgroundImage:
            theme.palette.mode === 'dark'
              ? 'linear-gradient(146deg, #121a2c 0%, #152230 52%, #1b2138 100%)'
              : 'linear-gradient(146deg, #f7faf5 0%, #f3f7ff 52%, #eef6ff 100%)',
          boxShadow: '0 36px 90px rgba(0, 0, 0, 0.42)',
          border: `1px solid ${alpha(theme.palette.common.white, 0.24)}`,
          '@keyframes welcomePulse': {
            '0%, 100%': { transform: 'scale(1)', opacity: 0.64 },
            '50%': { transform: 'scale(1.07)', opacity: 1 },
          },
          '@keyframes riseIn': {
            from: { opacity: 0, transform: 'translateY(12px)' },
            to: { opacity: 1, transform: 'translateY(0)' },
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            right: -40,
            top: -40,
            width: 180,
            height: 180,
            borderRadius: '50%',
            pointerEvents: 'none',
            background: `radial-gradient(circle, ${alpha(theme.palette.primary.main, 0.35)} 0%, ${alpha(
              theme.palette.primary.main,
              0
            )} 72%)`,
            animation: 'welcomePulse 5s ease-in-out infinite',
          },
        },
      }}
    >
      <DialogContent sx={{ p: { xs: 2.2, sm: 2.8 }, position: 'relative' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box>
            <Chip
              size="small"
              icon={<AutoAwesomeRoundedIcon />}
              label={previewMode ? 'Preview Mode' : 'New Member Tour'}
              color="primary"
              sx={{ fontWeight: 800, mb: 1, '& .MuiChip-icon': { color: 'inherit' } }}
            />
            <Typography variant="h4" sx={{ fontWeight: 900, lineHeight: 1.08, letterSpacing: '-0.02em' }}>
              Welcome to Sunday Mornings
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary', mt: 0.8 }}>
              You are set up. Here is how this app helps you win your week.
            </Typography>
          </Box>

          <Box
            sx={{
              borderRadius: 3,
              p: 1.6,
              bgcolor: theme.palette.background.paper,
              border: `1px solid ${alpha(theme.palette.text.primary, 0.1)}`,
            }}
          >
            <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 800 }}>
              Your Week Flow
            </Typography>
            <Box
              sx={{
                mt: 0.6,
                height: 7,
                borderRadius: 99,
                bgcolor: alpha(theme.palette.text.primary, 0.1),
                overflow: 'hidden',
              }}
            >
              <Box
                sx={{
                  width: `${progressPercent}%`,
                  height: '100%',
                  borderRadius: 99,
                  transition: 'width 820ms ease',
                  background: `linear-gradient(90deg, ${theme.palette.success.main} 0%, ${theme.palette.primary.main} 55%, ${theme.palette.secondary.main} 100%)`,
                }}
              />
            </Box>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {TOUR_STAGES.map((stage, index) => {
              const isVisible = index <= activeStage;
              const isActive = index === activeStage;
              const stageColor = theme.palette[stage.colorToken].main;
              return (
                <Box
                  key={stage.title}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.25,
                    px: 1.3,
                    py: 1.05,
                    borderRadius: 2,
                    border: `1px solid ${alpha(isActive ? stageColor : theme.palette.text.primary, isActive ? 0.34 : 0.13)}`,
                    bgcolor: alpha(isActive ? stageColor : theme.palette.text.primary, isActive ? 0.13 : 0.02),
                    opacity: isVisible ? 1 : 0.32,
                    transform: isVisible ? 'translateX(0)' : 'translateX(10px)',
                    transition: 'opacity 220ms ease, transform 220ms ease, background-color 220ms ease',
                    animation: isVisible ? 'riseIn 280ms ease both' : undefined,
                  }}
                >
                  <Box
                    sx={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      display: 'grid',
                      placeItems: 'center',
                      color: isActive ? theme.palette.common.white : theme.palette.text.secondary,
                      bgcolor: isActive ? stageColor : alpha(theme.palette.text.primary, 0.08),
                    }}
                  >
                    {stage.icon}
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 900, lineHeight: 1.15 }}>
                      {stage.title}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {stage.description}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              onClick={onGetStarted}
              sx={{
                fontWeight: 900,
                px: 2.2,
                textTransform: 'none',
              }}
            >
              Let&apos;s Go
            </Button>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default SignupWelcomeDialog;
