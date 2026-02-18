import React, { useMemo, useState } from 'react';
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

const ResetPassword: React.FC = () => {
  const location = useLocation();
  const token = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('token') || '';
  }, [location.search]);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const passwordsMatch = password.length > 0 && password === confirm;
  const canSubmit = !!token && passwordsMatch && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await authService.resetPassword(token, password);
      setDone(true);
      setPassword('');
      setConfirm('');
    } catch (e) {
      setErr(
        getUserFacingErrorMessage(e, {
          action: 'update your password',
          fallback: 'We couldn’t update your password. Please try again.',
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
            <Typography variant="h5" gutterBottom sx={{ fontWeight: 900 }}>
              Choose a new password
            </Typography>

            {!token && (
              <Alert severity="error" sx={{ mb: 2 }}>
                This reset link doesn’t look right. Please request a new one.
              </Alert>
            )}
            {done && (
              <Alert severity="success" sx={{ mb: 2 }}>
                Password updated. You can sign in with your new password.
              </Alert>
            )}
            {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

            <Box component="form" onSubmit={handleSubmit}>
              <TextField
                fullWidth
                autoFocus
                label="New password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={!token || done}
                sx={{ mb: 2 }}
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
              <TextField
                fullWidth
                label="Confirm new password"
                type={showConfirm ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={!token || done}
                error={confirm.length > 0 && password !== confirm}
                helperText={confirm.length > 0 && password !== confirm ? 'Passwords don’t match.' : ' '}
                sx={{ mb: 1 }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label={showConfirm ? 'Hide password confirmation' : 'Show password confirmation'}
                        onClick={() => setShowConfirm((v) => !v)}
                        edge="end"
                      >
                        {showConfirm ? <VisibilityOff /> : <Visibility />}
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
                Update password
              </Button>
            </Box>

            <Typography variant="body2" sx={{ mt: 2 }}>
              <Link component={RouterLink} to="/signin">
                Back to sign in
              </Link>
              {' · '}
              <Link component={RouterLink} to="/forgot-password">
                Request a new link
              </Link>
            </Typography>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default ResetPassword;
