// Bottom Navigation Component
import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Screen } from '../types';
import { COLORS } from '../theme';

interface NavItem {
  key: Screen;
  icon: string;
  label: string;
}

interface BottomNavProps {
  current: Screen;
  onNavigate: (screen: Screen) => void;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'home', icon: '🏠', label: 'Home' },
  { key: 'wallet', icon: '💳', label: 'Wallet' },
  { key: 'profile', icon: '👤', label: 'Profile' },
];

export function BottomNav({ current, onNavigate }: BottomNavProps) {
  return (
    <View style={styles.container}>
      {NAV_ITEMS.map((item) => (
        <TouchableOpacity
          key={item.key}
          style={styles.item}
          onPress={() => onNavigate(item.key)}
        >
          <Text style={[styles.icon, current === item.key && styles.iconActive]}>
            {item.icon}
          </Text>
          <Text style={[styles.label, current === item.key && styles.labelActive]}>
            {item.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: COLORS.surface,
    paddingVertical: 12,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  item: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  icon: {
    fontSize: 24,
  },
  iconActive: {
    transform: [{ scale: 1.1 }],
  },
  label: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  labelActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
});

