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
import WbSunnyRoundedIcon from '@mui/icons-material/WbSunnyRounded';
import RestaurantMenuRoundedIcon from '@mui/icons-material/RestaurantMenuRounded';
import ChecklistRoundedIcon from '@mui/icons-material/ChecklistRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';

interface SundayFreshStartDialogProps {
  open: boolean;
  weekLabel: string;
  weeklyTargetCalories: number;
  previewMode?: boolean;
  onOpenPulse?: () => void;
  onStepReveal?: (stepIndex: number) => void;
  onClose: () => void;
  onStartWeek: () => void;
}

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

const TUTORIAL_STEPS = [
  {
    title: 'Reset your week',
    subtitle: 'Sunday is your clean slate.',
    icon: <WbSunnyRoundedIcon fontSize="small" />,
  },
  {
    title: 'Pick one anchor meal',
    subtitle: 'Plan one meal now to remove friction later.',
    icon: <RestaurantMenuRoundedIcon fontSize="small" />,
  },
  {
    title: 'Log your first meal',
    subtitle: 'A quick first win creates momentum.',
    icon: <ChecklistRoundedIcon fontSize="small" />,
  },
] as const;

const STEP_REVEAL_MS = 1050;

const SundayFreshStartDialog: React.FC<SundayFreshStartDialogProps> = ({
  open,
  weekLabel,
  weeklyTargetCalories,
  previewMode = false,
  onOpenPulse,
  onStepReveal,
  onClose,
  onStartWeek,
}) => {
  const theme = useTheme();
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    if (!open) return;

    setActiveStep(0);
    onOpenPulse?.();

    let nextStep = 1;
    const interval = window.setInterval(() => {
      if (nextStep >= TUTORIAL_STEPS.length) {
        window.clearInterval(interval);
        return;
      }
      setActiveStep(nextStep);
      onStepReveal?.(nextStep);
      nextStep += 1;
    }, STEP_REVEAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [onOpenPulse, onStepReveal, open]);

  const roundedWeeklyTargetCalories = Math.max(0, Math.round(weeklyTargetCalories || 0));

  const timelineFillPercent = useMemo(() => {
    const slices = WEEK_DAYS.length - 1;
    return Math.max(0, Math.min(100, ((activeStep + 1) / slices) * 100));
  }, [activeStep]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      BackdropProps={{
        sx: {
          backgroundColor: alpha('#0a1324', 0.74),
          backdropFilter: 'blur(2px)',
        },
      }}
      PaperProps={{
        sx: {
          overflow: 'hidden',
          borderRadius: 4,
          backgroundColor: theme.palette.background.paper,
          backgroundImage:
            theme.palette.mode === 'dark'
              ? 'linear-gradient(140deg, #1a2538 0%, #23213a 46%, #141922 100%)'
              : 'linear-gradient(140deg, #eaf8f1 0%, #ece7fb 46%, #ffffff 100%)',
          position: 'relative',
          border: `1px solid ${alpha(theme.palette.common.white, 0.26)}`,
          boxShadow: '0 30px 80px rgba(0, 0, 0, 0.4)',
          '@keyframes freshAura': {
            '0%, 100%': { opacity: 0.55, transform: 'scale(1)' },
            '50%': { opacity: 0.9, transform: 'scale(1.05)' },
          },
          '@keyframes floatSparkle': {
            '0%': { transform: 'translateY(8px)', opacity: 0 },
            '35%': { opacity: 1 },
            '100%': { transform: 'translateY(-10px)', opacity: 0 },
          },
          '@keyframes dayPop': {
            '0%': { transform: 'translateY(5px) scale(0.96)', opacity: 0.2 },
            '100%': { transform: 'translateY(0) scale(1)', opacity: 1 },
          },
          '&::before': {
            content: '""',
            position: 'absolute',
            right: -32,
            top: -28,
            width: 170,
            height: 170,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${alpha(theme.palette.warning.light, 0.44)} 0%, ${alpha(
              theme.palette.warning.light,
              0
            )} 72%)`,
            animation: 'freshAura 4.4s ease-in-out infinite',
            pointerEvents: 'none',
          },
        },
      }}
    >
      <DialogContent sx={{ p: { xs: 2.2, sm: 2.8 }, position: 'relative' }}>
        <Box
          sx={{
            position: 'absolute',
            right: { xs: 22, sm: 26 },
            top: { xs: 16, sm: 18 },
            color: alpha(theme.palette.warning.main, 0.78),
            animation: 'floatSparkle 2.3s ease-in-out infinite',
          }}
        >
          <AutoAwesomeRoundedIcon fontSize="small" />
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box>
            <Chip
              size="small"
              color="primary"
              label={previewMode ? 'Preview Mode' : 'Sunday Ritual'}
              sx={{ fontWeight: 800, mb: 1 }}
            />
            <Typography variant="h5" sx={{ fontWeight: 900, lineHeight: 1.1 }}>
              Fresh week, fresh momentum
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.6 }}>
              {weekLabel} • Weekly budget {roundedWeeklyTargetCalories.toLocaleString()} kcal
            </Typography>
          </Box>

            <Box
              sx={{
                p: 1.6,
                borderRadius: 3,
                border: `1px solid ${alpha(theme.palette.text.primary, 0.09)}`,
                bgcolor: theme.palette.background.paper,
              }}
            >
            <Box sx={{ position: 'relative', px: 0.35, pb: 0.4 }}>
              <Box
                sx={{
                  position: 'absolute',
                  left: 10,
                  right: 10,
                  top: 11,
                  height: 3,
                  zIndex: 0,
                  borderRadius: 99,
                  bgcolor: alpha(theme.palette.text.primary, 0.13),
                  overflow: 'hidden',
                }}
              >
                <Box
                  sx={{
                    width: `${timelineFillPercent}%`,
                    height: '100%',
                    borderRadius: 99,
                    background: `linear-gradient(90deg, ${theme.palette.warning.main} 0%, ${theme.palette.success.main} 100%)`,
                    transition: 'width 760ms ease',
                  }}
                />
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 0.45, position: 'relative', zIndex: 1 }}>
                {WEEK_DAYS.map((day, idx) => {
                  const isActive = idx <= activeStep + 1;
                  const isSunday = idx === 0;
                  return (
                    <Box
                      key={day}
                      sx={{
                        textAlign: 'center',
                        animation: isActive ? 'dayPop 380ms ease forwards' : undefined,
                      }}
                    >
                      <Box
                        sx={{
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          display: 'grid',
                          placeItems: 'center',
                          mx: 'auto',
                          fontSize: 10,
                          fontWeight: 800,
                          color: isActive
                            ? isSunday
                              ? theme.palette.common.black
                              : theme.palette.common.white
                            : alpha(theme.palette.text.primary, 0.42),
                          bgcolor: isActive
                            ? isSunday
                              ? theme.palette.warning.light
                              : theme.palette.primary.main
                            : theme.palette.background.paper,
                          border: `1px solid ${alpha(
                            isActive
                              ? isSunday
                                ? theme.palette.warning.main
                                : theme.palette.primary.main
                              : theme.palette.text.primary,
                            isActive ? 0.6 : 0.16
                          )}`,
                        }}
                      >
                        {day[0]}
                      </Box>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 10, mt: 0.2 }}>
                        {day}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {TUTORIAL_STEPS.map((step, index) => {
              const visible = index <= activeStep;
              const highlighted = index === activeStep;
              return (
                <Box
                  key={step.title}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.25,
                    px: 1.35,
                    py: 1.05,
                    borderRadius: 2,
                    border: `1px solid ${alpha(
                      highlighted ? theme.palette.primary.main : theme.palette.text.primary,
                      highlighted ? 0.32 : 0.12
                    )}`,
                    bgcolor: alpha(
                      highlighted ? theme.palette.primary.main : theme.palette.text.primary,
                      highlighted ? 0.12 : 0.02
                    ),
                    opacity: visible ? 1 : 0.42,
                    transform: visible ? 'translateX(0)' : 'translateX(9px)',
                    transition: 'opacity 220ms ease, transform 220ms ease, background-color 220ms ease',
                  }}
                >
                  <Box
                    sx={{
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      display: 'grid',
                      placeItems: 'center',
                      color: highlighted ? theme.palette.primary.contrastText : theme.palette.text.secondary,
                      bgcolor: highlighted
                        ? theme.palette.primary.main
                        : alpha(theme.palette.text.primary, 0.08),
                    }}
                  >
                    {step.icon}
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 900, lineHeight: 1.15 }}>
                      {step.title}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {step.subtitle}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="contained" onClick={onStartWeek} sx={{ fontWeight: 900, textTransform: 'none' }}>
              Start this week
            </Button>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default SundayFreshStartDialog;
