// Home Screen
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BottomNav } from '../../components';
import { useAuthStore } from '../../stores';
import { COLORS } from '../../theme';
import { Screen } from '../../types';

interface Props {
  onNavigate: (screen: Screen) => void;
}

export function HomeScreen({ onNavigate }: Props) {
  const { user } = useAuthStore();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.first_name}! 👋</Text>
          <Text style={styles.greetingSub}>Where are you going today?</Text>
        </View>
        <TouchableOpacity style={styles.avatar} onPress={() => onNavigate('profile')}>
          <Text style={styles.avatarText}>{user?.first_name?.[0] || 'U'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.mapPlaceholder}>
        <Text style={styles.mapIcon}>🗺️</Text>
        <Text style={styles.mapText}>Map View</Text>
        <Text style={styles.mapSubtext}>Tap to set destination</Text>
      </View>

      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>🔍</Text>
        <Text style={styles.searchText}>Where to?</Text>
      </View>

      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.quickAction}>
          <Text style={styles.quickIcon}>🏠</Text>
          <Text style={styles.quickLabel}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickAction}>
          <Text style={styles.quickIcon}>💼</Text>
          <Text style={styles.quickLabel}>Work</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickAction} onPress={() => onNavigate('wallet')}>
          <Text style={styles.quickIcon}>💳</Text>
          <Text style={styles.quickLabel}>Wallet</Text>
        </TouchableOpacity>
        {user?.role === 'driver' && (
          <TouchableOpacity style={styles.quickAction} onPress={() => onNavigate('driver')}>
            <Text style={styles.quickIcon}>🚗</Text>
            <Text style={styles.quickLabel}>Drive</Text>
          </TouchableOpacity>
        )}
      </View>

      <BottomNav current="home" onNavigate={onNavigate} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  greetingSub: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    margin: 16,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
  mapIcon: {
    fontSize: 64,
  },
  mapText: {
    fontSize: 18,
    color: COLORS.textSecondary,
    marginTop: 8,
  },
  mapSubtext: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  searchText: {
    color: COLORS.textMuted,
    fontSize: 16,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  quickAction: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 16,
    borderRadius: 16,
    minWidth: 80,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  quickIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  quickLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.text,
  },
});

