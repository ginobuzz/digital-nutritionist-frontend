import { alpha, createTheme, responsiveFontSizes } from '@mui/material/styles';

const fontFamily = [
  'ui-sans-serif',
  'system-ui',
  '-apple-system',
  'BlinkMacSystemFont',
  '"SF Pro Display"',
  '"SF Pro Text"',
  '"Segoe UI"',
  'Roboto',
  'Helvetica',
  'Arial',
  'sans-serif',
].join(', ');

let theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#22C55E',
      light: '#86EFAC',
      dark: '#16A34A',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#7C3AED',
      light: '#C4B5FD',
      dark: '#5B21B6',
      contrastText: '#FFFFFF',
    },
    info: {
      main: '#0EA5E9',
    },
    warning: {
      main: '#F59E0B',
    },
    error: {
      main: '#F43F5E',
    },
    success: {
      main: '#22C55E',
    },
    background: {
      default: '#F6F7FB',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#0B1220',
      secondary: '#475569',
    },
    divider: alpha('#0B1220', 0.08),
  },
  shape: {
    borderRadius: 18,
  },
  typography: {
    fontFamily,
    h4: {
      fontWeight: 800,
      letterSpacing: '-0.04em',
    },
    h5: {
      fontWeight: 800,
      letterSpacing: '-0.03em',
    },
    h6: {
      fontWeight: 800,
      letterSpacing: '-0.02em',
    },
    subtitle1: {
      fontWeight: 700,
      letterSpacing: '-0.01em',
    },
    button: {
      fontWeight: 800,
      letterSpacing: '-0.01em',
    },
  },
});

theme = createTheme(theme, {
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          background: `radial-gradient(1200px circle at 0% 0%, ${alpha(
            theme.palette.primary.main,
            0.14
          )} 0%, transparent 55%),
radial-gradient(900px circle at 100% 20%, ${alpha(
            theme.palette.secondary.main,
            0.12
          )} 0%, transparent 55%),
${theme.palette.background.default}`,
          color: theme.palette.text.primary,
        },
      },
    },
    MuiAppBar: {
      defaultProps: {
        color: 'transparent',
        elevation: 0,
      },
      styleOverrides: {
        root: {
          backgroundColor: alpha(theme.palette.background.paper, 0.78),
          backdropFilter: 'blur(14px)',
          borderBottom: `1px solid ${theme.palette.divider}`,
        },
      },
    },
    MuiToolbar: {
      styleOverrides: {
        root: {
          minHeight: 60,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        rounded: {
          borderRadius: theme.shape.borderRadius,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: theme.shape.borderRadius + 4,
          border: `1px solid ${theme.palette.divider}`,
          boxShadow: `0 10px 28px ${alpha('#0B1220', 0.08)}`,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          textTransform: 'none',
          paddingInline: 16,
          paddingBlock: 10,
        },
        containedPrimary: {
          boxShadow: `0 10px 22px ${alpha(theme.palette.primary.main, 0.22)}`,
        },
        containedSecondary: {
          boxShadow: `0 10px 22px ${alpha(theme.palette.secondary.main, 0.22)}`,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          fontWeight: 700,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          backgroundColor: theme.palette.background.paper,
        },
        notchedOutline: {
          borderColor: theme.palette.divider,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 24,
        },
      },
    },
    MuiBottomNavigation: {
      styleOverrides: {
        root: {
          height: 72,
          paddingBottom: 'env(safe-area-inset-bottom)',
          backgroundColor: alpha(theme.palette.background.paper, 0.72),
          backdropFilter: 'blur(14px)',
          borderTop: `1px solid ${theme.palette.divider}`,
        },
      },
    },
    MuiBottomNavigationAction: {
      styleOverrides: {
        root: {
          minWidth: 0,
          borderRadius: 16,
          marginInline: 6,
          paddingTop: 10,
          paddingBottom: 10,
          '&.Mui-selected': {
            color: theme.palette.primary.main,
            backgroundColor: alpha(theme.palette.primary.main, 0.1),
          },
        },
        label: {
          fontWeight: 800,
          fontSize: 12,
        },
      },
    },
  },
});

theme = responsiveFontSizes(theme, { factor: 2.2 });

export default theme;
