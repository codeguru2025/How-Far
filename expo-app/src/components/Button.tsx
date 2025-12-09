// Reusable Button Component
import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { COLORS } from '../theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  size?: 'small' | 'medium' | 'large';
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({ 
  title, 
  onPress, 
  loading = false, 
  disabled = false, 
  variant = 'primary',
  size = 'medium',
  style,
  textStyle,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const buttonStyles = [
    styles.button,
    styles[variant],
    styles[size],
    isDisabled && styles.disabled,
    style,
  ];

  const textStyles = [
    styles.text,
    styles[`${variant}Text`],
    styles[`${size}Text`],
    textStyle,
  ];

  return (
    <TouchableOpacity
      style={buttonStyles}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' ? COLORS.primary : '#FFFFFF'} />
      ) : (
        <Text style={textStyles}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Variants
  primary: {
    backgroundColor: COLORS.primary,
  },
  secondary: {
    backgroundColor: COLORS.textSecondary,
  },
  danger: {
    backgroundColor: COLORS.error,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  
  // Sizes
  small: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  medium: {
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  large: {
    paddingVertical: 18,
    paddingHorizontal: 32,
  },
  
  // Disabled
  disabled: {
    opacity: 0.6,
  },
  
  // Text
  text: {
    fontWeight: '600',
  },
  primaryText: {
    color: '#FFFFFF',
  },
  secondaryText: {
    color: '#FFFFFF',
  },
  dangerText: {
    color: '#FFFFFF',
  },
  outlineText: {
    color: COLORS.primary,
  },
  smallText: {
    fontSize: 14,
  },
  mediumText: {
    fontSize: 16,
  },
  largeText: {
    fontSize: 18,
  },
});

