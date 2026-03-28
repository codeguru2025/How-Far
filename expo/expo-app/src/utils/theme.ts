// Ndeip-Zthin Theme
export const colors = {
  primary: '#E85A24',
  primaryLight: '#F7A26B',
  primaryDark: '#B94419',
  secondary: '#FFB300',
  accent: '#00897B',
  background: '#FFFBF7',
  surface: '#FFFFFF',
  text: '#1A1A2E',
  textSecondary: '#6B7280',
  textLight: '#9CA3AF',
  textMuted: '#9CA3AF',
  textOnPrimary: '#FFFFFF',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };
export const borderRadius = { sm: 8, md: 12, lg: 16, xl: 24, full: 9999 };
export const fontSize = { xs: 11, sm: 13, md: 15, lg: 17, xl: 20, xxl: 24, xxxl: 32 };
// Font weights as numbers for React Native 0.76+
export const fontWeight = { 
  normal: 'normal' as const, 
  medium: '500' as '500', 
  semibold: '600' as '600', 
  bold: 'bold' as const 
};
export const shadows = {
  sm: { 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 1 }, 
    shadowOpacity: 0.05, 
    shadowRadius: 2, 
    elevation: 1 
  },
  md: { 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 8, 
    elevation: 4 
  },
  lg: { 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 10 }, 
    shadowOpacity: 0.15, 
    shadowRadius: 20, 
    elevation: 8 
  },
};
