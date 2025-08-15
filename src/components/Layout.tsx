import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Container,
  Avatar,
  useTheme,
  useMediaQuery,
  BottomNavigation,
  BottomNavigationAction,
  Paper
} from '@mui/material';
import {
  Home,
  Timeline,
  Person,
  Settings,
  Chat,
} from '@mui/icons-material';
import { User } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  user: User;
}

const Layout: React.FC<LayoutProps> = ({ children, user }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();

  const handleNavigationChange = (event: React.SyntheticEvent, newValue: number) => {
    switch (newValue) {
      case 0:
        navigate('/');
        break;
      case 1:
        navigate('/plan');
        break;
      case 2:
        navigate('/reality');
        break;
      case 3:
        navigate('/chat');
        break;
      case 4:
        navigate('/profile');
        break;
      default:
        navigate('/');
    }
  };

  const navigationItems = [
    { label: 'Home', icon: <Home />, path: '/' },
    { label: 'Plan', icon: <Settings />, path: '/plan' },
    { label: 'Reality', icon: <Timeline />, path: '/reality' },
    { label: 'Chat', icon: <Chat />, path: '/chat' },
    { label: 'Profile', icon: <Person />, path: '/profile' },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          <Typography 
            variant="h6" 
            component="div" 
            sx={{ 
              flexGrow: 1, 
              textAlign: 'center',
              fontWeight: 'bold'
            }}
          >
            Digital Nutritionist
          </Typography>
          {!isMobile && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar sx={{ bgcolor: 'primary.light' }}>
                {user.name.charAt(0)}
              </Avatar>
            </Box>
          )}
        </Toolbar>
      </AppBar>

      <Box sx={{ display: 'flex', flex: 1 }}>
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            p: 3,
            pb: 8, // Add bottom padding to account for fixed bottom navigation
            backgroundColor: 'grey.50',
            minHeight: 'calc(100vh - 64px)',
          }}
        >
          <Container maxWidth="lg">
            {children}
          </Container>
        </Box>
      </Box>
      
      {/* Bottom Navigation */}
      <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0 }} elevation={3}>
        <BottomNavigation
          showLabels
          value={navigationItems.findIndex(item => item.path === location.pathname) || 0}
          onChange={handleNavigationChange}
        >
          {navigationItems.map((item) => (
            <BottomNavigationAction
              key={item.label}
              label={item.label}
              icon={item.icon}
            />
          ))}
        </BottomNavigation>
      </Paper>
    </Box>
  );
};

export default Layout; 