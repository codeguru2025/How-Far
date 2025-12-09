import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { colors, spacing, borderRadius, fontSize } from '../../utils/theme';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.headerTitle}>Profile</Text>

      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.first_name?.[0] || 'U'}</Text>
        </View>
        <Text style={styles.name}>{user?.first_name || 'User'}</Text>
        <Text style={styles.phone}>{user?.phone_number}</Text>
      </View>

      <View style={styles.menu}>
        {[
          { icon: '👤', label: 'Edit Profile' },
          { icon: '👨‍👩‍👧', label: 'Guardians' },
          { icon: '📋', label: 'Ride History' },
          { icon: '❓', label: 'Help & Support' },
        ].map((item, i) => (
          <TouchableOpacity key={i} style={styles.menuItem}>
            <Text style={styles.menuIcon}>{item.icon}</Text>
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  headerTitle: { fontSize: fontSize.xl, fontWeight: 'bold', textAlign: 'center', padding: spacing.lg },
  profileCard: { alignItems: 'center', padding: spacing.lg, backgroundColor: colors.surface, marginHorizontal: spacing.lg, borderRadius: borderRadius.xl },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md },
  avatarText: { fontSize: 32, fontWeight: 'bold', color: colors.textOnPrimary },
  name: { fontSize: fontSize.xl, fontWeight: 'bold' },
  phone: { fontSize: fontSize.md, color: colors.textSecondary, marginTop: spacing.xs },
  menu: { marginTop: spacing.lg, marginHorizontal: spacing.lg, backgroundColor: colors.surface, borderRadius: borderRadius.lg },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  menuIcon: { fontSize: 20, marginRight: spacing.md },
  menuLabel: { flex: 1, fontSize: fontSize.md },
  menuArrow: { fontSize: 20, color: colors.textMuted },
  signOutButton: { margin: spacing.lg, padding: spacing.md, alignItems: 'center', backgroundColor: '#ff000015', borderRadius: borderRadius.lg },
  signOutText: { color: colors.error, fontWeight: '600' },
});
