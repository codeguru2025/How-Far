// Reusable Card Component
import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { COLORS } from '../theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'default' | 'elevated' | 'outlined';
}

export function Card({ children, style, variant = 'default' }: CardProps) {
  return (
    <View style={[styles.card, styles[variant], style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
  },
  default: {
    // Base styles
  },
  elevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  outlined: {
    borderWidth: 1,
    borderColor: COLORS.border,
  },
});

