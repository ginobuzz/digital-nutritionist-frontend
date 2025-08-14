import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  CircularProgress,
} from '@mui/material';
import { testApiConnection, testUserCreation } from '../utils/apiTest';
import { testMinimalUserCreation, testFullUserCreation } from '../utils/debugApi';

const ApiTest: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [connectionResult, setConnectionResult] = useState<{ success: boolean; message: string } | null>(null);
  const [userTestResult, setUserTestResult] = useState<{ success: boolean; message: string; userId?: string } | null>(null);
  const [minimalTestResult, setMinimalTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [fullTestResult, setFullTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestConnection = async () => {
    setLoading(true);
    const result = await testApiConnection();
    setConnectionResult(result);
    setLoading(false);
  };

  const handleTestUserCreation = async () => {
    setLoading(true);
    const result = await testUserCreation();
    setUserTestResult(result);
    setLoading(false);
  };

  const handleTestMinimalUserCreation = async () => {
    setLoading(true);
    const result = await testMinimalUserCreation();
    setMinimalTestResult({
      success: result.success,
      message: result.success ? 'Minimal user creation successful' : (result.error || 'Unknown error')
    });
    setLoading(false);
  };

  const handleTestFullUserCreation = async () => {
    setLoading(true);
    const result = await testFullUserCreation();
    setFullTestResult({
      success: result.success,
      message: result.success ? 'Full user creation successful' : (result.error || 'Unknown error')
    });
    setLoading(false);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        API Connection Test
      </Typography>
      
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Button
          variant="contained"
          onClick={handleTestConnection}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : undefined}
        >
          Test API Connection
        </Button>
        
        <Button
          variant="contained"
          onClick={handleTestUserCreation}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : undefined}
        >
          Test User Creation
        </Button>

        <Button
          variant="outlined"
          onClick={handleTestMinimalUserCreation}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : undefined}
        >
          Test Minimal User
        </Button>

        <Button
          variant="outlined"
          onClick={handleTestFullUserCreation}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : undefined}
        >
          Test Full User
        </Button>
      </Box>

      {connectionResult && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Connection Test Result
            </Typography>
            <Alert severity={connectionResult.success ? 'success' : 'error'}>
              {connectionResult.message}
            </Alert>
          </CardContent>
        </Card>
      )}

      {userTestResult && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              User Creation Test Result
            </Typography>
            <Alert severity={userTestResult.success ? 'success' : 'error'}>
              {userTestResult.message}
              {userTestResult.userId && (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Created user ID: {userTestResult.userId}
                </Typography>
              )}
            </Alert>
          </CardContent>
        </Card>
      )}

      {minimalTestResult && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Minimal User Test Result
            </Typography>
            <Alert severity={minimalTestResult.success ? 'success' : 'error'}>
              {minimalTestResult.message}
            </Alert>
          </CardContent>
        </Card>
      )}

      {fullTestResult && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Full User Test Result
            </Typography>
            <Alert severity={fullTestResult.success ? 'success' : 'error'}>
              {fullTestResult.message}
            </Alert>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default ApiTest; 