import React from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
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

const BUILD_VERSION = process.env.REACT_APP_BUILD_VERSION ?? '0 (beta)';
const BUILD_DATETIME = process.env.REACT_APP_BUILD_DATETIME ?? 'unknown';
const BUILD_NUMBER = process.env.REACT_APP_BUILD_NUMBER ?? 'unknown';
const BUILD_COMMIT = process.env.REACT_APP_BUILD_COMMIT ?? 'unknown';

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

        <Typography variant="h3" sx={{ fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
          Sunday Mornings
        </Typography>
        <Typography variant="h6" sx={{ color: 'text.secondary', mt: 1.25, lineHeight: 1.4 }}>
          Your personal nutritionist for losing weight — simple, calm, and built for real life.
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
              What it does
            </Typography>
            <Stack spacing={1.2}>
              <Typography variant="body1" sx={{ color: 'text.primary' }}>
                Sunday Mornings helps you find the right goal for you, then makes it easy to stay consistent.
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.primary' }}>
                Track what you eat with plain language or pictures, and get the kind of support you’d expect from a
                real-life nutritionist — whenever you need it.
              </Typography>
            </Stack>

            <Divider sx={{ my: 2.25 }} />

            <Typography variant="h6" sx={{ fontWeight: 900, mb: 1.25 }}>
              How it feels
            </Typography>
            <Stack spacing={1.1}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                - Remembers your preferences and patterns
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                - Helps you get back on track if you slip
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                - Can stay passive, or check in on you — your choice
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                - Supports planning meals for the whole week (a Sunday morning ritual)
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                - Answers questions along the way, like a coach on your shoulder
              </Typography>
            </Stack>

            <Divider sx={{ my: 2.25 }} />

            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              It’s a no-fuss, simple way to reach your weight loss goals.
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', color: 'text.disabled', mt: 1 }}>
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
