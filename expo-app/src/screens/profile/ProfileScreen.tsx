// Profile Screen
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { BottomNav, Button } from '../../components';
import { useAuthStore } from '../../stores';
import { updateUserRole } from '../../api/users';
import { COLORS } from '../../theme';
import { Screen } from '../../types';

interface Props {
  onNavigate: (screen: Screen) => void;
}

function MenuItem({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <Text style={styles.menuIcon}>{icon}</Text>
      <Text style={styles.menuLabel}>{label}</Text>
      <Text style={styles.menuArrow}>›</Text>
    </TouchableOpacity>
  );
}

export function ProfileScreen({ onNavigate }: Props) {
  const { user, signOut, updateUser } = useAuthStore();
  const [isDriver, setIsDriver] = useState(user?.role === 'driver');

  async function toggleDriverMode() {
    if (!user) return;
    const newRole = isDriver ? 'passenger' : 'driver';
    const success = await updateUserRole(user.id, newRole);
    if (success) {
      setIsDriver(!isDriver);
      updateUser({ role: newRole });
      Alert.alert('Success', `Switched to ${newRole} mode`);
    } else {
      Alert.alert('Error', 'Failed to switch mode');
    }
  }

  function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>

      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.first_name?.[0] || 'U'}</Text>
        </View>
        <Text style={styles.profileName}>{user?.first_name} {user?.last_name}</Text>
        <Text style={styles.profilePhone}>{user?.phone_number}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>{isDriver ? '🚗 Driver' : '👤 Passenger'}</Text>
        </View>
      </View>

      <View style={styles.menuSection}>
        <MenuItem icon="👤" label="Edit Profile" onPress={() => {}} />
        <MenuItem icon="🔔" label="Notifications" onPress={() => {}} />
        <MenuItem icon="🛡️" label="Safety & Guardians" onPress={() => {}} />
        <MenuItem icon="💳" label="Payment Methods" onPress={() => {}} />
        <MenuItem 
          icon="🚗" 
          label={isDriver ? 'Switch to Passenger' : 'Become a Driver'} 
          onPress={toggleDriverMode} 
        />
        <MenuItem icon="❓" label="Help & Support" onPress={() => {}} />
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      <BottomNav current="profile" onNavigate={onNavigate} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: 60,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 24,
  },
  profileCard: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  profileName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  profilePhone: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  roleBadge: {
    backgroundColor: COLORS.primaryLight + '30',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 12,
  },
  roleBadgeText: {
    color: COLORS.primary,
    fontWeight: '500',
  },
  menuSection: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 16,
    marginTop: 24,
    borderRadius: 16,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  menuIcon: {
    fontSize: 20,
    marginRight: 16,
  },
  menuLabel: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
  },
  menuArrow: {
    fontSize: 20,
    color: COLORS.textMuted,
  },
  signOutButton: {
    marginHorizontal: 16,
    marginTop: 24,
    padding: 16,
    alignItems: 'center',
    backgroundColor: COLORS.error + '15',
    borderRadius: 12,
  },
  signOutText: {
    color: COLORS.error,
    fontWeight: '600',
    fontSize: 16,
  },
});

