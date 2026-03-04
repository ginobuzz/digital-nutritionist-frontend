import React from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Stack,
  Typography,
  useTheme,
  Link,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import InfoRoundedIcon from '@mui/icons-material/InfoRounded';
import PersonAddRoundedIcon from '@mui/icons-material/PersonAddRounded';
import LoginRoundedIcon from '@mui/icons-material/LoginRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import WbSunnyRoundedIcon from '@mui/icons-material/WbSunnyRounded';
import RestaurantMenuRoundedIcon from '@mui/icons-material/RestaurantMenuRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';

const BUILD_VERSION = process.env.REACT_APP_BUILD_VERSION ?? '0 (beta)';
const BUILD_DATETIME = process.env.REACT_APP_BUILD_DATETIME ?? 'unknown';
const BUILD_NUMBER = process.env.REACT_APP_BUILD_NUMBER ?? 'unknown';
const BUILD_COMMIT = process.env.REACT_APP_BUILD_COMMIT ?? 'unknown';

interface FeatureBulletProps {
  icon: React.ReactNode;
  iconColor: string;
  label: string;
  description: string;
}

const FeatureBullet: React.FC<FeatureBulletProps> = ({ icon, iconColor, label, description }) => (
  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
    <Box
      sx={{
        width: 30,
        height: 30,
        borderRadius: '50%',
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
        mt: 0.1,
        color: iconColor,
        bgcolor: alpha(iconColor, 0.1),
      }}
    >
      {icon}
    </Box>
    <Box>
      <Typography variant="body2" sx={{ fontWeight: 800, color: 'text.primary', lineHeight: 1.25 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.45 }}>
        {description}
      </Typography>
    </Box>
  </Box>
);

const About: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const authed = Boolean(localStorage.getItem('dn_access_token'));

  return (
    <Box
      sx={{
        minHeight: '100vh',
        py: { xs: 3, sm: 5 },
        background: `radial-gradient(1200px circle at 20% -10%, ${alpha(
          theme.palette.primary.main,
          0.14
        )} 0%, transparent 55%),
          radial-gradient(900px circle at 110% 10%, ${alpha(theme.palette.secondary.main, 0.12)} 0%, transparent 50%),
          ${theme.palette.background.default}`,
      }}
    >
      <Container maxWidth="sm">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <InfoRoundedIcon color="primary" />
          <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: '0.12em' }}>
            About
          </Typography>
        </Box>

        <Chip
          size="small"
          color="primary"
          label="Weekly reset"
          sx={{ fontWeight: 800, mb: 1.25 }}
        />
        <Typography variant="h3" sx={{ fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
          Sunday Mornings
        </Typography>
        <Typography variant="h6" sx={{ color: 'text.secondary', mt: 1.25, lineHeight: 1.4 }}>
          Every Sunday, a fresh plan. Every week, a calorie budget that bends to your life — not the other way around.
        </Typography>

        <Card
          sx={{
            mt: 3,
            borderRadius: 3,
            overflow: 'hidden',
            border: `1px solid ${alpha(theme.palette.text.primary, 0.08)}`,
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.10)} 0%, ${alpha(
              theme.palette.secondary.main,
              0.08
            )} 55%, ${alpha(theme.palette.background.paper, 0.9)} 100%)`,
          }}
        >
          <CardContent sx={{ p: 2.75 }}>
            <Typography variant="h6" sx={{ fontWeight: 900, mb: 1.25 }}>
              The Sunday ritual
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.primary', lineHeight: 1.55 }}>
              Once a week, on Sunday morning, you open the app. Your calorie budget is already adjusted for the week
              ahead, and you make a plan. That single habit — ten minutes, one morning — is how consistent people
              stay consistent.
            </Typography>

            <Divider sx={{ my: 2.25 }} />

            <Typography variant="h6" sx={{ fontWeight: 900, mb: 1.5 }}>
              How it works
            </Typography>
            <Stack spacing={1.6}>
              <FeatureBullet
                icon={<AutorenewRoundedIcon fontSize="small" />}
                iconColor={theme.palette.primary.main}
                label="Dynamic weekly budget"
                description="Your daily calorie target reshapes every week around your real plans — a dinner out, a rest day, a celebration."
              />
              <FeatureBullet
                icon={<WbSunnyRoundedIcon fontSize="small" />}
                iconColor={theme.palette.warning.main}
                label="Sunday planning ritual"
                description="Open the app each Sunday morning, set your week's anchor meals, and start with momentum."
              />
              <FeatureBullet
                icon={<RestaurantMenuRoundedIcon fontSize="small" />}
                iconColor={theme.palette.secondary.main}
                label="Effortless logging"
                description="Tell it what you ate in plain language or snap a photo. No barcodes, no spreadsheets."
              />
              <FeatureBullet
                icon={<AutoAwesomeRoundedIcon fontSize="small" />}
                iconColor={theme.palette.secondary.main}
                label="A coach, not just a tracker"
                description="Ask questions, get back on track after a rough day, and stay inspired — whenever you need it."
              />
            </Stack>

            <Divider sx={{ my: 2.25 }} />

            <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.55 }}>
              Some weeks you'll nail it. Others, life happens. Sunday Mornings meets you there.
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', color: 'text.disabled', mt: 1.5 }}>
              Not medical advice. For health concerns, talk to a clinician.
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', color: 'text.disabled', mt: 0.5 }}>
              Legal details are available on demand in our <Link component={RouterLink} to="/legal" underline="hover">Privacy & Terms</Link>.
            </Typography>
          </CardContent>
        </Card>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ mt: 3 }}>
          {authed ? (
            <Button
              variant="contained"
              fullWidth
              startIcon={<ArrowBackRoundedIcon />}
              onClick={() => navigate('/')}
            >
              Back to dashboard
            </Button>
          ) : (
            <>
              <Button
                variant="contained"
                fullWidth
                startIcon={<LoginRoundedIcon />}
                onClick={() => navigate('/signin')}
              >
                Sign in
              </Button>
              <Button
                variant="outlined"
                fullWidth
                startIcon={<PersonAddRoundedIcon />}
                onClick={() => navigate('/setup')}
              >
                Create account
              </Button>
            </>
          )}
        </Stack>

        <Stack spacing={0.25} sx={{ mt: 3, textAlign: 'center' }}>
          <Typography variant="caption" sx={{ display: 'block', color: 'text.disabled' }}>
            Version {BUILD_VERSION}
          </Typography>
          <Typography variant="caption" sx={{ display: 'block', color: 'text.disabled' }}>
            Build {BUILD_DATETIME} · #{BUILD_NUMBER} · {BUILD_COMMIT}
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
};

export default About;
