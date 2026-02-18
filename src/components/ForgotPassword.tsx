import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, CircularProgress, Link, TextField, Typography } from '@mui/material';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { authService } from '../services/auth';
import { getUserFacingErrorMessage } from '../utils/errors';

const isLikelyEmail = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.length > 320) return false;
  return trimmed.includes('@');
};

const ForgotPassword: React.FC = () => {
  const location = useLocation();
  const initialEmail = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('email') || '';
  }, [location.search]);

  const [email, setEmail] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    setEmail((prev) => prev || initialEmail);
  }, [initialEmail]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await authService.requestPasswordReset(email.trim());
      setSent(true);
    } catch (e) {
      setErr(
        getUserFacingErrorMessage(e, {
          action: 'send the reset link',
          fallback: 'We couldn’t send the reset link. Please try again.',
        })
      );
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = isLikelyEmail(email) && !loading;

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
            <Typography variant="h5" gutterBottom sx={{ fontWeight: 900 }}>
              Reset your password
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
              Enter the email you use to sign in. We&apos;ll send a reset link if we find a match.
            </Typography>

            {sent && (
              <Alert severity="success" sx={{ mb: 2 }}>
                If an account exists for that email, you&apos;ll receive a reset link shortly.
              </Alert>
            )}
            {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

            <Box component="form" onSubmit={handleSubmit}>
              <TextField
                fullWidth
                autoFocus
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                sx={{ mb: 2 }}
              />
              <Button
                type="submit"
                variant="contained"
                fullWidth
                disabled={!canSubmit}
                startIcon={loading ? <CircularProgress size={18} /> : undefined}
              >
                {sent ? 'Resend reset link' : 'Send reset link'}
              </Button>
            </Box>

            <Typography variant="body2" sx={{ mt: 2 }}>
              <Link component={RouterLink} to="/signin">
                Back to sign in
              </Link>
            </Typography>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default ForgotPassword;
