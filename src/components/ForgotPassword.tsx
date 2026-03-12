import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  IconButton,
  InputAdornment,
  Link,
  TextField,
  Typography,
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { authService } from '../services/auth';
import { getUserFacingErrorMessage } from '../utils/errors';

const isLikelyEmail = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.length > 320) return false;
  return trimmed.includes('@');
};

// Converts feet + inches inputs to total inches
const toTotalInches = (feet: string, inches: string): number | null => {
  const f = parseInt(feet, 10);
  const i = parseInt(inches, 10);
  if (Number.isNaN(f) || Number.isNaN(i)) return null;
  if (f < 0 || i < 0 || i > 11) return null;
  return f * 12 + i;
};

type Step = 'email' | 'verify' | 'done';

const ForgotPassword: React.FC = () => {
  const location = useLocation();
  const initialEmail = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('email') || '';
  }, [location.search]);

  const [step, setStep] = useState<Step>('email');

  // Step 1
  const [email, setEmail] = useState('');

  // Step 2 — verification fields
  const [lastName, setLastName] = useState('');
  const [age, setAge] = useState('');
  const [heightFeet, setHeightFeet] = useState('');
  const [heightInches, setHeightInches] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setEmail((prev) => prev || initialEmail);
  }, [initialEmail]);

  const canContinue = isLikelyEmail(email);

  const heightIn = toTotalInches(heightFeet, heightInches);
  const canSubmit =
    lastName.trim().length > 0 &&
    age.trim().length > 0 &&
    heightIn !== null &&
    password.length > 0 &&
    !loading;

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canContinue) return;
    setErr(null);
    setStep('verify');
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || heightIn === null) return;
    setErr(null);
    setLoading(true);
    try {
      await authService.betaResetPassword(email.trim(), lastName.trim(), parseInt(age, 10), heightIn, password);
      setStep('done');
    } catch (e) {
      setErr(
        getUserFacingErrorMessage(e, {
          action: 'update your password',
          fallback: "We couldn't update your password. Please try again.",
        })
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 420 }}>
        <Box sx={{ textAlign: 'center', mb: 2.5 }}>
          <Typography variant="h4" sx={{ fontWeight: 900, mb: 0.5 }}>
            Sunday Mornings
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Quick check-ins. Clear progress. Calm coaching.
          </Typography>
        </Box>

        <Card>
          <CardContent>
            {step === 'email' && (
              <>
                <Typography variant="h5" gutterBottom sx={{ fontWeight: 900 }}>
                  Reset your password
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                  Enter the email you use to sign in.
                </Typography>

                {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

                <Box component="form" onSubmit={handleEmailSubmit}>
                  <TextField
                    fullWidth
                    autoFocus
                    label="Email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    sx={{ mb: 2 }}
                  />
                  <Button type="submit" variant="contained" fullWidth disabled={!canContinue}>
                    Continue
                  </Button>
                </Box>

                <Typography variant="body2" sx={{ mt: 2 }}>
                  <Link component={RouterLink} to="/signin">
                    Back to sign in
                  </Link>
                </Typography>
              </>
            )}

            {step === 'verify' && (
              <>
                <Typography variant="h5" gutterBottom sx={{ fontWeight: 900 }}>
                  Verify your identity
                </Typography>
                <Alert severity="info" sx={{ mb: 2 }}>
                  Beta: answer a few questions from your profile to reset your password.
                </Alert>

                {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

                <Box component="form" onSubmit={handleVerifySubmit}>
                  <TextField
                    fullWidth
                    autoFocus
                    label="Last name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    sx={{ mb: 2 }}
                  />
                  <TextField
                    fullWidth
                    label="Age"
                    type="number"
                    inputProps={{ min: 1, max: 150 }}
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    sx={{ mb: 2 }}
                  />
                  <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                    <TextField
                      label="Height (ft)"
                      type="number"
                      inputProps={{ min: 0, max: 9 }}
                      value={heightFeet}
                      onChange={(e) => setHeightFeet(e.target.value)}
                      sx={{ flex: 1 }}
                    />
                    <TextField
                      label="Height (in)"
                      type="number"
                      inputProps={{ min: 0, max: 11 }}
                      value={heightInches}
                      onChange={(e) => setHeightInches(e.target.value)}
                      sx={{ flex: 1 }}
                    />
                  </Box>

                  <TextField
                    fullWidth
                    label="New password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    sx={{ mb: 1 }}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            onClick={() => setShowPassword((v) => !v)}
                            edge="end"
                          >
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    fullWidth
                    disabled={!canSubmit}
                    startIcon={loading ? <CircularProgress size={18} /> : undefined}
                  >
                    Reset password
                  </Button>
                </Box>

                <Typography variant="body2" sx={{ mt: 2 }}>
                  <Link component={RouterLink} to="/signin">
                    Back to sign in
                  </Link>
                  {' · '}
                  <Link
                    component="button"
                    variant="body2"
                    onClick={() => { setErr(null); setStep('email'); }}
                  >
                    Change email
                  </Link>
                </Typography>
              </>
            )}

            {step === 'done' && (
              <>
                <Typography variant="h5" gutterBottom sx={{ fontWeight: 900 }}>
                  Password updated
                </Typography>
                <Alert severity="success" sx={{ mb: 2 }}>
                  Your password has been reset. You can now sign in with your new password.
                </Alert>
                <Button component={RouterLink} to="/signin" variant="contained" fullWidth>
                  Sign in
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default ForgotPassword;
