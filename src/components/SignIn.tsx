import React, { useState } from 'react';
import { Box, Card, CardContent, TextField, Button, Typography, Alert, CircularProgress, Link } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { authService } from '../services/auth';
import { apiService, convertUserFromBackend } from '../services/api';
import { User } from '../types';

interface SignInProps {
  onSignedIn: (user: User) => void;
}

const SignIn: React.FC<SignInProps> = ({ onSignedIn }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const { access_token } = await authService.login(email, password);
      authService.setToken(access_token);
      apiService.setAuthToken(access_token);

      let userResponse;
      try {
        userResponse = await apiService.getCurrentUser();
      } catch {
        // Fallback: decode user id from token and fetch by id
        const id = authService.getUserIdFromToken(access_token);
        if (id === null || id === undefined) throw new Error('Unable to resolve user from token');
        userResponse = await apiService.getUser(String(id));
      }
      const user = convertUserFromBackend(userResponse);
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('setupComplete', 'true');
      onSignedIn(user);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
      <Card sx={{ maxWidth: 420, width: '100%' }}>
        <CardContent>
          <Typography variant="h5" gutterBottom>Sign In</Typography>
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
        </CardContent>
      </Card>
    </Box>
  );
};

export default SignIn;


