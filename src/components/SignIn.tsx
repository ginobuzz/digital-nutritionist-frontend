import React, { useState } from 'react';
import { Box, Card, CardContent, TextField, Button, Typography, Alert, CircularProgress, Link } from '@mui/material';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { authService } from '../services/auth';
import { apiService, convertUserFromBackend, isUserNotFoundError } from '../services/api';
import { User } from '../types';

interface SignInProps {
  onSignedIn: (user: User) => void;
}

const SignIn: React.FC<SignInProps> = ({ onSignedIn }) => {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const reason = params.get('reason');
  const infoMessage =
    reason === 'expired'
      ? 'Your session expired. Please sign in again.'
      : reason === 'unauthorized'
        ? 'Please sign in to continue.'
        : null;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const loginResult = await authService.login(email, password);
      const accessToken = loginResult.access_token;
      authService.setToken(accessToken);
      apiService.setAuthToken(accessToken);

      // Prefer user id returned from auth response; fall back to token decoding
      const idFromAuth = loginResult.user?.id;
      const id = (idFromAuth !== undefined && idFromAuth !== null)
        ? idFromAuth
        : authService.getUserIdFromToken(accessToken);
      if (id === null || id === undefined) throw new Error('Unable to resolve user from token');
      const userResponse = await apiService.getUser(String(id));
      const user = convertUserFromBackend(userResponse);
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('setupComplete', 'true');
      onSignedIn(user);
    } catch (e) {
      if (isUserNotFoundError(e)) {
        return;
      }
      setErr(e instanceof Error ? e.message : 'Login failed');
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
            Welcome back
          </Typography>
          {infoMessage && <Alert severity="info" sx={{ mb: 2 }}>{infoMessage}</Alert>}
          {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
          <Box component="form" onSubmit={handleSubmit}>
            <TextField fullWidth label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} sx={{ mb: 2 }} />
            <TextField fullWidth label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} sx={{ mb: 2 }} />
            <Button type="submit" variant="contained" fullWidth disabled={loading} startIcon={loading ? <CircularProgress size={18} /> : undefined}>
              Sign In
            </Button>
          </Box>
          <Typography variant="body2" sx={{ mt: 2 }}>
            Don't have an account?{' '}
            <Link component={RouterLink} to="/setup">Create one</Link>
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Want to learn more?{' '}
            <Link component={RouterLink} to="/about">About Sunday Mornings</Link>
          </Typography>
        </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default SignIn;
