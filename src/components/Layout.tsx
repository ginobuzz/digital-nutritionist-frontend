import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Container,
  Avatar,
  IconButton,
  useTheme,
  useMediaQuery,
  BottomNavigation,
  BottomNavigationAction,
  Paper,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Chip,
} from '@mui/material';
import {
  Home,
  Timeline,
  Person,
  Chat,
  BrightnessAuto,
  DarkMode,
  LightMode,
  Check,
} from '@mui/icons-material';
import { type PaletteMode } from '@mui/material/styles';
import { User } from '../types';
import { type ThemePreference } from '../theme';
import { triggerSubmitHaptic } from '../services/haptics';

interface LayoutProps {
  children: React.ReactNode;
  user: User;
  themePreference: ThemePreference;
  resolvedThemeMode: PaletteMode;
  onThemePreferenceChange: (next: ThemePreference) => void;
}

const Layout: React.FC<LayoutProps> = ({
  children,
  user,
  themePreference,
  resolvedThemeMode,
  onThemePreferenceChange,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const location = useLocation();
  const [themeMenuAnchorEl, setThemeMenuAnchorEl] = useState<null | HTMLElement>(null);
  const safeAreaTopInset = 'max(env(safe-area-inset-top), var(--dn-ios-safe-area-top-fallback, 0px))';
  const topNavHeight = `calc(${safeAreaTopInset} + 60px)`;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const { navigator } = window;
    const isIPad = /iPad/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isIOS = /iPhone|iPod/.test(navigator.userAgent) || isIPad;

    if (!isIOS) return;

    const rootStyle = document.documentElement.style;
    const visualViewport = window.visualViewport;

    const updateSafeAreaFallback = () => {
      if (window.matchMedia('(orientation: landscape)').matches) {
        rootStyle.setProperty('--dn-ios-safe-area-top-fallback', '0px');
        return;
      }

      const viewportTop = Math.round(visualViewport?.offsetTop ?? 0);
      if (viewportTop > 0) {
        rootStyle.setProperty('--dn-ios-safe-area-top-fallback', `${viewportTop}px`);
        return;
      }

      const longestScreenSide = Math.max(window.screen.width, window.screen.height);
      const fallbackTop = isIPad ? 24 : longestScreenSide >= 852 ? 54 : longestScreenSide >= 812 ? 47 : 20;
      rootStyle.setProperty('--dn-ios-safe-area-top-fallback', `${fallbackTop}px`);
    };

    updateSafeAreaFallback();
    window.addEventListener('resize', updateSafeAreaFallback);
    window.addEventListener('orientationchange', updateSafeAreaFallback);
    visualViewport?.addEventListener('resize', updateSafeAreaFallback);
    visualViewport?.addEventListener('scroll', updateSafeAreaFallback);

    return () => {
      window.removeEventListener('resize', updateSafeAreaFallback);
      window.removeEventListener('orientationchange', updateSafeAreaFallback);
      visualViewport?.removeEventListener('resize', updateSafeAreaFallback);
      visualViewport?.removeEventListener('scroll', updateSafeAreaFallback);
    };
  }, []);

  const themeMenuOpen = Boolean(themeMenuAnchorEl);
  const handleThemeMenuOpen = (event: React.MouseEvent<HTMLElement>) => setThemeMenuAnchorEl(event.currentTarget);
  const handleThemeMenuClose = () => setThemeMenuAnchorEl(null);
  const handleThemeSelect = (next: ThemePreference) => {
    onThemePreferenceChange(next);
    handleThemeMenuClose();
  };

  const themeButtonLabel =
    themePreference === 'system'
      ? `Theme: System (${resolvedThemeMode})`
      : `Theme: ${themePreference.charAt(0).toUpperCase()}${themePreference.slice(1)}`;
  const themeButtonIcon =
    themePreference === 'system' ? (
      <BrightnessAuto fontSize="small" />
    ) : themePreference === 'dark' ? (
      <DarkMode fontSize="small" />
    ) : (
      <LightMode fontSize="small" />
    );

  const handleLogoClick = () => {
    navigate('/profile');
  };

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
  const isChatRoute = location.pathname === '/chat';

  const activeIndexRaw = navigationItems.findIndex(item => item.path === location.pathname);
  const activeIndex = activeIndexRaw >= 0 ? activeIndexRaw : 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        sx={{
          pt: safeAreaTopInset,
        }}
      >
        <Toolbar
          sx={{
            px: 2,
            minHeight: 60,
          }}
        >
          <IconButton
            aria-label="Go to profile"
            onClick={handleLogoClick}
            sx={{ p: 0 }}
          >
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
          </IconButton>
          <Typography 
            variant="h6"
            component="div" 
            sx={{ 
              flexGrow: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
              textAlign: 'center',
              fontWeight: 900,
              letterSpacing: '-0.02em',
            }}
          >
            Sunday Mornings
            <Chip
              label="Beta"
              size="small"
              color="secondary"
              sx={{
                height: 20,
                fontSize: '0.65rem',
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            />
          </Typography>
          <Tooltip title={themeButtonLabel}>
            <IconButton
              aria-label={themeButtonLabel}
              onClick={handleThemeMenuOpen}
              size="small"
              sx={{ width: 34, height: 34, flexShrink: 0 }}
            >
              {themeButtonIcon}
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Menu
        anchorEl={themeMenuAnchorEl}
        open={themeMenuOpen}
        onClose={handleThemeMenuClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem selected={themePreference === 'system'} onClick={() => handleThemeSelect('system')}>
          <ListItemIcon>
            <BrightnessAuto fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="System" secondary={`Currently: ${resolvedThemeMode}`} />
          <Box sx={{ width: 24, display: 'flex', justifyContent: 'flex-end' }}>
            {themePreference === 'system' ? <Check fontSize="small" /> : null}
          </Box>
        </MenuItem>
        <MenuItem selected={themePreference === 'light'} onClick={() => handleThemeSelect('light')}>
          <ListItemIcon>
            <LightMode fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Light" />
          <Box sx={{ width: 24, display: 'flex', justifyContent: 'flex-end' }}>
            {themePreference === 'light' ? <Check fontSize="small" /> : null}
          </Box>
        </MenuItem>
        <MenuItem selected={themePreference === 'dark'} onClick={() => handleThemeSelect('dark')}>
          <ListItemIcon>
            <DarkMode fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Dark" />
          <Box sx={{ width: 24, display: 'flex', justifyContent: 'flex-end' }}>
            {themePreference === 'dark' ? <Check fontSize="small" /> : null}
          </Box>
        </MenuItem>
      </Menu>

      <Box sx={{ display: 'flex', flex: 1 }}>
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            px: isChatRoute ? 0 : { xs: 2, sm: 3 },
            pt: isChatRoute ? 0 : { xs: 2, sm: 3 },
            mt: topNavHeight,
            pb: 'calc(88px + env(safe-area-inset-bottom))',
            minHeight: `calc(100vh - ${topNavHeight})`,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Container
            maxWidth={isChatRoute ? false : isMobile ? 'sm' : 'md'}
            disableGutters
            sx={{ px: 0, flexGrow: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
          >
            {children}
          </Container>
        </Box>
      </Box>
      
      {/* Bottom Navigation */}
      <Paper
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
        elevation={0}
        square={false}
      >
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
              onClick={() => {
                void triggerSubmitHaptic();
              }}
            />
          ))}
        </BottomNavigation>
      </Paper>
    </Box>
  );
};

export default Layout; 
