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
        navigate('/log');
        break;
      case 2:
        navigate('/chat');
        break;
      case 3:
        navigate('/profile');
        break;
      default:
        navigate('/');
    }
  };

  const navigationItems = [
    { label: 'Home', icon: <Home />, path: '/' },
    { label: 'Log', icon: <Timeline />, path: '/log' },
    { label: 'Chat', icon: <Chat />, path: '/chat' },
    { label: 'Profile', icon: <Person />, path: '/profile' },
  ];

  const activeIndexRaw = navigationItems.findIndex(item => item.path === location.pathname);
  const activeIndex = activeIndexRaw >= 0 ? activeIndexRaw : 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="sticky">
        <Toolbar sx={{ px: 2 }}>
          <Avatar
            sx={{
              width: 34,
              height: 34,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              fontWeight: 900,
              boxShadow: 1,
            }}
          >
            {user.name.charAt(0)}
          </Avatar>
          <Typography 
            variant="h6"
            component="div" 
            sx={{ 
              flexGrow: 1, 
              textAlign: 'center',
              fontWeight: 900,
              letterSpacing: '-0.02em',
            }}
          >
            Digital Nutritionist
          </Typography>
          <Box sx={{ width: 34, height: 34, flexShrink: 0 }} />
        </Toolbar>
      </AppBar>

      <Box sx={{ display: 'flex', flex: 1 }}>
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            px: { xs: 2, sm: 3 },
            pt: { xs: 2, sm: 3 },
            pb: 'calc(88px + env(safe-area-inset-bottom))',
            minHeight: 'calc(100vh - 60px)',
          }}
        >
          <Container maxWidth={isMobile ? 'sm' : 'md'} disableGutters sx={{ px: 0 }}>
            {children}
          </Container>
        </Box>
      </Box>
      
      {/* Bottom Navigation */}
      <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0 }} elevation={0} square={false}>
        <BottomNavigation
          showLabels
          value={activeIndex}
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
